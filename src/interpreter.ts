import * as fs from "fs";

// Substitute variables in template of the form ${varName} using the env object.
function substitute(template: string, env: any): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return (env[varName] !== undefined) ? String(env[varName]) : "";
  });
}

export interface Routine {
  type: string;
  [key: string]: any;
}

export interface Program {
  doc?: string;
  routines: { [name: string]: Routine };
  main: string;
}

export interface Trace {
  routine: string;
  type: string;
  inputs: any;
  outputs?: any;
  llm_call?: any;
  branch_taken?: string;
  subtrace?: Trace | Trace[];
  subtraces?: Trace[];
}

export class Interpreter {
  program: Program;
  routines: { [name: string]: Routine };

  constructor(program: Program) {
    this.program = program;
    this.routines = program.routines || {};
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

  private handlePrompt(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    const devMsg: string = routine.dev_msg || "";
    const userMsgTemplate: string = routine.user_msg || "";
    const userMsg = substitute(userMsgTemplate, env);
    // For each declared output, simulate an LLM response
    for (const key in routine.outputs) {
      outputs[key] = `simulated_${key}_response_based_on_${userMsg}`;
    }
    trace.llm_call = { dev_msg: devMsg, user_msg: userMsg };
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleDefine(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    for (const key in routine.outputs) {
      const spec = routine.outputs[key];
      if (typeof spec === "string") {
        outputs[key] = env[spec];
      } else if (typeof spec === "object") {
        outputs[key] = spec.value;
      }
    }
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleCode(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
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

  private handleIf(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
    const outputs: any = {};
    this.handleRoutine(routine, env, outputs);

    const conditionVar: string = routine.condition;
    const condValue = env[conditionVar];
    const branch = condValue ? "then" : "else";
    const branchRoutine = routine[branch];
    if (!branchRoutine) {
      throw new Error(`'if' routine missing '${branch}' branch.`);
    }
    const { outputs: branchOutputs, trace: subtrace } = this.executeRoutine(branchRoutine, env);
    trace.branch_taken = branch;
    trace.subtrace = subtrace;
    Object.assign(outputs, branchOutputs);
    trace.outputs = outputs;
    return { outputs, trace };
  }

  private handleCompose(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
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

  private handleJoin(routine: Routine, env: any, trace: Trace): { outputs: any; trace: Trace } {
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
    const trace: Trace = {
      routine: routineName,
      type: routineType,
      inputs: { ...env }
    };

    switch (routineType) {
      case "prompt":
        return this.handlePrompt(routine, env, trace);
      case "define":
        return this.handleDefine(routine, env, trace);
      case "code":
        return this.handleCode(routine, env, trace);
      case "if":
        return this.handleIf(routine, env, trace);
      case "join":
        return this.handleJoin(routine, env, trace);
      case "compose":
        return this.handleCompose(routine, env, trace);
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
