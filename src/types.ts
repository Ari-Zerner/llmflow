// Base routine interface
export interface BaseRoutine {
  type: string;
  doc?: string;
  passthrough?: string[];
}

// Specific routine types
export interface PromptRoutine extends BaseRoutine {
  type: 'prompt';
  dev_msg: string;
  user_msg: string;
  outputs: Record<string, string>;
}

export interface CodeRoutine extends BaseRoutine {
  type: 'code';
  code: string;
}

export interface DefineRoutine extends BaseRoutine {
  type: 'define';
  outputs: Record<string, string | { type: string; value: any; optional?: boolean }>;
}

export interface IfRoutine extends BaseRoutine {
  type: 'if';
  condition: string;
  then: string;
  else: string;
}

export interface ComposeRoutine extends BaseRoutine {
  type: 'compose';
  routines: string[];
}

export interface JoinRoutine extends BaseRoutine {
  type: 'join';
  routines: string[];
}

// Union type for all routines
export type Routine = 
  | PromptRoutine 
  | CodeRoutine 
  | DefineRoutine 
  | IfRoutine 
  | ComposeRoutine 
  | JoinRoutine;

// Program interface
export interface Program {
  doc?: string;
  routines: Record<string, Routine>;
  main: string;
}

// Base trace interface
export interface BaseTrace {
  routine: string;
  type: string;
  inputs: any;
  outputs?: any;
}

// Specific trace types
export interface PromptTrace extends BaseTrace {
  type: 'prompt';
  llm_call: {
    dev_msg: string;
    user_msg: string;
  };
}

export interface CodeTrace extends BaseTrace {
  type: 'code';
}

export interface DefineTrace extends BaseTrace {
  type: 'define';
}

export interface IfTrace extends BaseTrace {
  type: 'if';
  branch_taken: 'then' | 'else';
  subtrace: Trace;
}

export interface ComposeTrace extends BaseTrace {
  type: 'compose';
  subtraces: Trace[];
}

export interface JoinTrace extends BaseTrace {
  type: 'join';
  subtraces: Trace[];
}

// Union type for all traces
export type Trace = 
  | PromptTrace 
  | CodeTrace 
  | DefineTrace 
  | IfTrace 
  | ComposeTrace 
  | JoinTrace;
