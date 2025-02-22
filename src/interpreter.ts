import * as fs from "fs";
import { 
  Program, 
  Routine, 
  Trace, 
  PromptRoutine, 
  CodeRoutine, 
  DefineRoutine, 
  IfRoutine, 
  ComposeRoutine, 
  JoinRoutine,
  PromptTrace,
  CodeTrace,
  DefineTrace,
  IfTrace,
  ComposeTrace,
  JoinTrace
} from './types';
import { LLMService, DefaultLLMService } from './llm';

// Substitute variables in template of the form ${varName} using the env object.
function substitute(template: string, env: any): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return (env[varName] !== undefined) ? String(env[varName]) : "";
  });
}

export class Interpreter {
  program: Program;
  routines: { [name: string]: Routine };
  llmService: LLMService;

  constructor(program: Program, llmService?: LLMService) {
    this.program = program;
    this.routines = program.routines || {};
    this.llmService = llmService || new DefaultLLMService();
  }

  private handleRoutine(routine: Routine, env: any, outputs: any): void {
    // Handle passthrough variables first
    if (routine.passthrough) {
      for (const varName of routine.passthrough) {
        if (varName in env) {
          outputs[varName] = env[varName];
        }
      }
    }
  }

  private handlePrompt(routine: PromptRoutine, env: any, trace: PromptTrace): { outputs: any; trace: PromptTrace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    const devMsg: string = routine.dev_msg || "";
    const userMsgTemplate: string = routine.user_msg || "";
    const userMsg = substitute(userMsgTemplate, env);
    
    // Get structured outputs from LLM
    const llmOutputs = this.llmService.callLLM(devMsg, userMsg, routine.outputs);
    Object.assign(outputs, llmOutputs);
    
    trace.llm_call = { dev_msg: devMsg, user_msg: userMsg };
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleDefine(routine: DefineRoutine, env: any, trace: DefineTrace): { outputs: any; trace: DefineTrace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    for (const key in routine.outputs) {
      const spec = routine.outputs[key];
      if (typeof spec === 'string') {
        // Handle optional input references
        const isOptional = spec.endsWith('?');
        const inputName = isOptional ? spec.slice(0, -1) : spec;
        if (inputName in env) {
          outputs[key] = env[inputName];
        } else if (!isOptional) {
          outputs[key] = undefined;
        }
      } else if (typeof spec === 'object') {
        if (spec.optional && spec.value === undefined) {
          continue;
        }
        outputs[key] = spec.value;
      }
    }
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleCode(routine: CodeRoutine, env: any, trace: CodeTrace): { outputs: any; trace: CodeTrace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    const codeStr: string = routine.code || "";
    try {
      const func = new Function('input', `return ${codeStr};`);
      const result = func(env);
      if (typeof result !== "object" || result === null) {
        throw new Error("Code did not return an object.");
      }
      Object.assign(outputs, result);
    } catch (e: any) {
      outputs.error = e.message;
    }
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleIf(routine: IfRoutine, env: any, trace: IfTrace): { outputs: any; trace: IfTrace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    const conditionVar: string = routine.condition;
    const condValue = env[conditionVar];
    const branch = condValue ? "then" : "else";
    const branchRoutineName = routine[branch];
    if (!branchRoutineName) {
      throw new Error(`'if' routine missing '${branch}' branch.`);
    }
    const { outputs: branchOutputs, trace: subtrace } = this.executeRoutine(branchRoutineName, env);
    trace.branch_taken = branch;
    trace.subtrace = subtrace;
    Object.assign(outputs, branchOutputs);
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleCompose(routine: ComposeRoutine, env: any, trace: ComposeTrace): { outputs: any; trace: ComposeTrace } {
    let currentEnv = env;
    const subtraces: Trace[] = [];
    const routines: string[] = routine.routines;
    for (const rn of routines) {
      const { outputs: out, trace: subtr } = this.executeRoutine(rn, currentEnv);
      currentEnv = out;
      subtraces.push(subtr);
    }
    trace.subtraces = subtraces;
    trace.outputs = currentEnv;
    return { outputs: currentEnv, trace };
  }

  private handleJoin(routine: JoinRoutine, env: any, trace: JoinTrace): { outputs: any; trace: JoinTrace } {
    const outputs: any = {};
    const subtraces: Trace[] = [];
    const routines: string[] = routine.routines;
    for (const rn of routines) {
      const { outputs: out, trace: subtr } = this.executeRoutine(rn, env);
      Object.assign(outputs, out);
      subtraces.push(subtr);
    }
    trace.subtraces = subtraces;
    trace.outputs = outputs;
    return { outputs, trace };
  }

  executeRoutine(routineName: string, env: any): { outputs: any; trace: Trace } {
    const routine = this.routines[routineName];
    if (!routine) {
      throw new Error(`Routine '${routineName}' not found.`);
    }
    const routineType = routine.type;
    
    // Create the appropriate trace type based on routine type
    const baseTrace = {
      routine: routineName,
      type: routineType,
      inputs: { ...env }
    };

    switch (routineType) {
      case "prompt":
        return this.handlePrompt(routine as PromptRoutine, env, { ...baseTrace, type: "prompt" } as PromptTrace);
      case "code":
        return this.handleCode(routine as CodeRoutine, env, { ...baseTrace, type: "code" } as CodeTrace);
      case "define":
        return this.handleDefine(routine as DefineRoutine, env, { ...baseTrace, type: "define" } as DefineTrace);
      case "if":
        return this.handleIf(routine as IfRoutine, env, { ...baseTrace, type: "if", branch_taken: "then", subtrace: {} as Trace } as IfTrace);
      case "compose":
        return this.handleCompose(routine as ComposeRoutine, env, { ...baseTrace, type: "compose", subtraces: [] } as ComposeTrace);
      case "join":
        return this.handleJoin(routine as JoinRoutine, env, { ...baseTrace, type: "join", subtraces: [] } as JoinTrace);
      default:
        throw new Error(`Unknown routine type: ${routineType}`);
    }
  }

  run(initialEnv: any = {}): any {
    const mainRoutine = this.program.main;
    if (!mainRoutine) {
      throw new Error("Program is missing a 'main' routine.");
    }
    const { outputs, trace } = this.executeRoutine(mainRoutine, initialEnv);
    return {
      program: this.program,
      outputs,
      trace
    };
  }
}

// Command-line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: ts-node interpreter.ts <program_file.json> [initial_env_json]");
    process.exit(1);
  }
  const programFile = args[0];
  let initialEnv = {};
  if (args.length > 1) {
    try {
      initialEnv = JSON.parse(args[1]);
    } catch (e) {
      console.error("Error parsing initial environment JSON:", e);
      process.exit(1);
    }
  }
  try {
    const programData = fs.readFileSync(programFile, "utf8");
    const program: Program = JSON.parse(programData);
    const interpreter = new Interpreter(program);
    const result = interpreter.run(initialEnv);
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
