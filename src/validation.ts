import { Program, Routine, PromptRoutine, CodeRoutine, DefineRoutine, IfRoutine, ComposeRoutine, JoinRoutine } from './types';

const VALID_TYPES = ['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]'];

function validateType(type: string): void {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }
}

function validatePromptRoutine(routine: PromptRoutine) {
  if (!routine.dev_msg || !routine.user_msg || !routine.outputs) {
    throw new Error('Prompt routine must have dev_msg, user_msg, and outputs');
  }
  
  if (Object.keys(routine.outputs).length === 0) {
    throw new Error('Prompt routine must have at least one output');
  }

  for (const [name, type] of Object.entries(routine.outputs)) {
    validateType(type);
  }
}

function validateCodeRoutine(routine: CodeRoutine) {
  if (!routine.code) {
    throw new Error('Code routine must have code field');
  }
}

function validateDefineRoutine(routine: DefineRoutine, routines: Record<string, Routine>, env: any = {}) {
  if (!routine.outputs || typeof routine.outputs !== 'object') {
    throw new Error('Define routine must have outputs object');
  }

  const outputs: any = {};
  for (const [name, spec] of Object.entries(routine.outputs)) {
    if (typeof spec === 'string') {
      if (!(spec in env) && !(spec in outputs)) {
        throw new Error(`Input "${spec}" not found`);
      }
    } else if (typeof spec === 'object') {
      validateType(spec.type);
      outputs[name] = spec.value;
    }
  }
  return outputs;
}

function validateIfRoutine(routine: IfRoutine, routines: Record<string, Routine>) {
  if (!routine.condition || !routine.then || !routine.else) {
    throw new Error('If routine must have condition, then, and else fields');
  }
  if (!(routine.then in routines)) {
    throw new Error(`Routine "${routine.then}" not found`);
  }
  if (!(routine.else in routines)) {
    throw new Error(`Routine "${routine.else}" not found`);
  }
}

function validateComposeRoutine(routine: ComposeRoutine, routines: Record<string, Routine>) {
  if (!Array.isArray(routine.routines)) {
    throw new Error('Compose routine must have routines array');
  }
  if (routine.routines.length === 0) {
    throw new Error('Compose routine must have at least one routine');
  }
  for (const routineName of routine.routines) {
    if (!(routineName in routines)) {
      throw new Error(`Routine "${routineName}" not found`);
    }
  }
}

function validateJoinRoutine(routine: JoinRoutine, routines: Record<string, Routine>) {
  if (!Array.isArray(routine.routines)) {
    throw new Error('Join routine must have routines array');
  }
  if (routine.routines.length === 0) {
    throw new Error('Join routine must have at least one routine');
  }
  for (const routineName of routine.routines) {
    if (!(routineName in routines)) {
      throw new Error(`Routine "${routineName}" not found`);
    }
  }
}

function validateRoutine(routine: Routine, routines: Record<string, Routine>, env: any = {}): any {
  const outputs: any = {};
  switch (routine.type) {
    case 'prompt':
      validatePromptRoutine(routine);
      break;
    case 'code':
      validateCodeRoutine(routine);
      break;
    case 'define':
      Object.assign(outputs, validateDefineRoutine(routine, routines, env));
      break;
    case 'if':
      validateIfRoutine(routine, routines);
      break;
    case 'compose':
      validateComposeRoutine(routine, routines);
      break;
    case 'join':
      validateJoinRoutine(routine, routines);
      break;
    default:
      const _exhaustiveCheck: never = routine;
      throw new Error(`Unknown routine type: ${(routine as any).type}`);
  }
  return outputs;
}

export function validateProgram(program: Program): void {
  if (!program.main) {
    throw new Error('Program must have a main routine');
  }

  if (!program.routines || typeof program.routines !== 'object') {
    throw new Error('Program must have routines object');
  }

  if (!(program.main in program.routines)) {
    throw new Error(`Main routine "${program.main}" not found in routines`);
  }

  const env: any = {};
  for (const [name, routine] of Object.entries(program.routines)) {
    const outputs = validateRoutine(routine, program.routines, env);
    Object.assign(env, outputs);
  }
}
