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
import { LLMService } from './llm';

function substitute(template: string, inputs: any): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return (inputs[varName] !== undefined) ? String(inputs[varName]) : "";
  });
}

export class Interpreter {
  program: Program;
  routines: { [name: string]: Routine };
  llmService: LLMService;

  constructor(program: Program, llmService: LLMService) {
    this.program = program;
    this.routines = program.routines || {};
    this.llmService = llmService;
  }

  private handleRoutine(routine: Routine, inputs: any, outputs: any): void {
    if (routine.passthrough) {
      for (const varName of routine.passthrough) {
        if (varName in inputs) {
          outputs[varName] = inputs[varName];
        }
      }
    }
  }

  private async handlePrompt(routine: PromptRoutine, inputs: any, trace: PromptTrace): Promise<{ outputs: any; trace: PromptTrace }> {
    const outputs: any = {};
    this.handleRoutine(routine, inputs, outputs);

    const devMsg: string = routine.dev_msg || "";
    const userMsgTemplate: string = routine.user_msg || "";
    const userMsg = substitute(userMsgTemplate, inputs);
    
    const llmOutputs = await this.llmService.callLLM(devMsg, userMsg, routine.outputs);
    Object.assign(outputs, llmOutputs);
    
    trace.llm_call = { dev_msg: devMsg, user_msg: userMsg };
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private async handleDefine(routine: DefineRoutine, inputs: any, trace: DefineTrace): Promise<{ outputs: any; trace: DefineTrace }> {
    const outputs: any = {};
    this.handleRoutine(routine, inputs, outputs);

    for (const key in routine.outputs) {
      const spec = routine.outputs[key];
      if (typeof spec === 'string') {
        const isOptional = spec.endsWith('?');
        const inputName = isOptional ? spec.slice(0, -1) : spec;
        if (inputName in inputs) {
          outputs[key] = inputs[inputName];
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

  private async handleCode(routine: CodeRoutine, inputs: any, trace: CodeTrace): Promise<{ outputs: any; trace: CodeTrace }> {
    const outputs: any = {};
    this.handleRoutine(routine, inputs, outputs);

    const codeStr: string = routine.code || "";
    try {
      const func = new Function('input', `return ${codeStr};`);
      const result = func(inputs);
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

  private async handleIf(routine: IfRoutine, inputs: any, trace: IfTrace): Promise<{ outputs: any; trace: IfTrace }> {
    const outputs: any = {};
    this.handleRoutine(routine, inputs, outputs);

    const conditionVar: string = routine.condition;
    const condValue = inputs[conditionVar];
    const branch = condValue ? "then" : "else";
    const branchRoutineName = routine[branch];
    if (!branchRoutineName) {
      throw new Error(`'if' routine missing '${branch}' branch.`);
    }
    const { outputs: branchOutputs, trace: subtrace } = await this.executeRoutine(branchRoutineName, inputs);
    trace.branch_taken = branch;
    trace.subtrace = subtrace;
    Object.assign(outputs, branchOutputs);
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private async handleCompose(routine: ComposeRoutine, inputs: any, trace: ComposeTrace): Promise<{ outputs: any; trace: ComposeTrace }> {
    let currentInputs = inputs;
    const subtraces: Trace[] = [];
    const routines: string[] = routine.routines;
    for (const rn of routines) {
      const { outputs: out, trace: subtr } = await this.executeRoutine(rn, currentInputs);
      currentInputs = out;
      subtraces.push(subtr);
    }
    trace.subtraces = subtraces;
    trace.outputs = currentInputs;
    return { outputs: currentInputs, trace };
  }

  private async handleJoin(routine: JoinRoutine, inputs: any, trace: JoinTrace): Promise<{ outputs: any; trace: JoinTrace }> {
    const outputs: any = {};
    const subtraces: Trace[] = [];
    const routines: string[] = routine.routines;
    for (const rn of routines) {
      const { outputs: out, trace: subtr } = await this.executeRoutine(rn, inputs);
      Object.assign(outputs, out);
      subtraces.push(subtr);
    }
    trace.subtraces = subtraces;
    trace.outputs = outputs;
    return { outputs, trace };
  }

  async executeRoutine(routineName: string, inputs: any): Promise<{ outputs: any; trace: Trace }> {
    const routine = this.routines[routineName];
    if (!routine) {
      throw new Error(`Routine '${routineName}' not found.`);
    }
    const routineType = routine.type;
    
    const baseTrace = {
      routine: routineName,
      type: routineType,
      inputs: { ...inputs }
    };

    switch (routineType) {
      case "prompt":
        return this.handlePrompt(routine as PromptRoutine, inputs, { ...baseTrace, type: "prompt" } as PromptTrace);
      case "code":
        return this.handleCode(routine as CodeRoutine, inputs, { ...baseTrace, type: "code" } as CodeTrace);
      case "define":
        return this.handleDefine(routine as DefineRoutine, inputs, { ...baseTrace, type: "define" } as DefineTrace);
      case "if":
        return this.handleIf(routine as IfRoutine, inputs, { ...baseTrace, type: "if", branch_taken: "then", subtrace: {} as Trace } as IfTrace);
      case "compose":
        return this.handleCompose(routine as ComposeRoutine, inputs, { ...baseTrace, type: "compose", subtraces: [] } as ComposeTrace);
      case "join":
        return this.handleJoin(routine as JoinRoutine, inputs, { ...baseTrace, type: "join", subtraces: [] } as JoinTrace);
      default:
        throw new Error(`Unknown routine type: ${routineType}`);
    }
  }

  async run(initialInputs: any = {}): Promise<any> {
    const mainRoutine = this.program.main;
    if (!mainRoutine) {
      throw new Error("Program is missing a 'main' routine.");
    }
    const { outputs, trace } = await this.executeRoutine(mainRoutine, initialInputs);
    return {
      program: this.program,
      outputs,
      trace
    };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: ts-node interpreter.ts <program_file.json> [initial_env_json]");
    process.exit(1);
  }
  const programFile = args[0];
  let initialInputs = {};
  if (args.length > 1) {
    try {
      initialInputs = JSON.parse(args[1]);
    } catch (e) {
      console.error("Error parsing initial environment JSON:", e);
      process.exit(1);
    }
  }
  try {
    console.error("Error: LLMService must be provided when running interpreter");
    process.exit(1);
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
