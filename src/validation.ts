import { Program, Routine, PromptRoutine, CodeRoutine, DefineRoutine, IfRoutine, ComposeRoutine, JoinRoutine } from './types';

const VALID_TYPES = ['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]'];

function validateType(type: string): void {
  const baseType = type.replace(/\?$/, '');
  if (!VALID_TYPES.includes(baseType)) {
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

function validateDefineRoutine(routine: DefineRoutine, routines: Record<string, Routine>, inputs: any = {}) {
  if (!routine.outputs || typeof routine.outputs !== 'object') {
    throw new Error('Define routine must have outputs object');
  }

  const outputs: any = {};
  const entries = Object.entries(routine.outputs);
  
  // First pass: validate and collect all outputs to allow forward references
  for (const [name, spec] of entries) {
    if (typeof spec === 'object') {
      validateType(spec.type);
      outputs[name] = spec.value;
    } else if (typeof spec === 'string') {
      const isOptional = spec.endsWith('?');
      const inputName = isOptional ? spec.slice(0, -1) : spec;
      outputs[name] = inputName;
    }
  }

  // Second pass: validate all references exist
  for (const [name, spec] of entries) {
    if (typeof spec === 'string') {
      const isOptional = spec.endsWith('?');
      const inputName = isOptional ? spec.slice(0, -1) : spec;
      if (!isOptional && !(inputName in inputs) && !(inputName in outputs)) {
        throw new Error(`Input "${inputName}" not found`);
      }
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

function validateRoutine(routine: Routine, routines: Record<string, Routine>, inputs: any = {}): void {
  switch (routine.type) {
    case 'prompt':
      validatePromptRoutine(routine);
      break;
    case 'code':
      validateCodeRoutine(routine);
      break;
    case 'define':
      validateDefineRoutine(routine, routines, inputs);
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

  // First validate all routines have basic structure
  for (const routine of Object.values(program.routines)) {
    if (routine.type === 'define' && (!routine.outputs || typeof routine.outputs !== 'object')) {
      throw new Error('Define routine must have outputs object');
    }
  }

  // Collect all define routine outputs for validation context
  const definedOutputs: any = {};
  for (const routine of Object.values(program.routines)) {
    if (routine.type === 'define') {
      for (const [name, spec] of Object.entries(routine.outputs)) {
        if (typeof spec === 'object') {
          validateType(spec.type);
          definedOutputs[name] = spec.value;
        } else if (typeof spec === 'string') {
          definedOutputs[name] = spec;
        }
      }
    }
  }

  // Validate all routines with complete context
  for (const routine of Object.values(program.routines)) {
    validateRoutine(routine, program.routines, definedOutputs);
  }
}
