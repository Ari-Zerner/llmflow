import { validateProgram } from '../validation';
import { Program } from '../types';

describe('Program Validation', () => {
  it('should validate a prompt routine', () => {
    const program: Program = {
      routines: {
        test_prompt: {
          type: 'prompt',
          dev_msg: 'Test dev message',
          user_msg: 'Test user message for ${name}',
          outputs: {
            response: 'string'
          }
        }
      },
      main: 'test_prompt'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject a prompt routine missing required fields', () => {
    const program: Program = {
      routines: {
        test_prompt: {
          type: 'prompt',
          // Missing dev_msg, user_msg, outputs
        } as any
      },
      main: 'test_prompt'
    };

    expect(() => validateProgram(program)).toThrow('Prompt routine must have dev_msg, user_msg, and outputs');
  });

  it('should validate a code routine', () => {
    const program: Program = {
      routines: {
        test_code: {
          type: 'code',
          code: "{'result': input.value * 2}"
        }
      },
      main: 'test_code'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject a code routine without code field', () => {
    const program: Program = {
      routines: {
        test_code: {
          type: 'code'
        } as any
      },
      main: 'test_code'
    };

    expect(() => validateProgram(program)).toThrow('Code routine must have code field');
  });

  it('should validate a define routine', () => {
    const program: Program = {
      routines: {
        input_provider: {
          type: 'define',
          outputs: {
            input_var: {
              type: 'string',
              value: 'input value'
            }
          }
        },
        test_define: {
          type: 'define',
          outputs: {
            str_var: 'input_var',
            literal_var: {
              type: 'string',
              value: 'hello'
            }
          }
        }
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject a define routine without outputs', () => {
    const program: Program = {
      routines: {
        test_define: {
          type: 'define'
        } as any
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).toThrow('Define routine must have outputs object');
  });

  it('should validate an if routine', () => {
    const program: Program = {
      routines: {
        routine1: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'yes' } }
        },
        routine2: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'no' } }
        },
        test_if: {
          type: 'if',
          condition: 'flag',
          then: 'routine1',
          else: 'routine2'
        }
      },
      main: 'test_if'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject an if routine missing branches', () => {
    const program: Program = {
      routines: {
        test_if: {
          type: 'if',
          condition: 'flag'
        } as any
      },
      main: 'test_if'
    };

    expect(() => validateProgram(program)).toThrow('If routine must have condition, then, and else fields');
  });

  it('should validate a compose routine', () => {
    const program: Program = {
      routines: {
        routine1: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'first' } }
        },
        routine2: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'second' } }
        },
        test_compose: {
          type: 'compose',
          routines: ['routine1', 'routine2']
        }
      },
      main: 'test_compose'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject a compose routine without routines array', () => {
    const program: Program = {
      routines: {
        test_compose: {
          type: 'compose'
        } as any
      },
      main: 'test_compose'
    };

    expect(() => validateProgram(program)).toThrow('Compose routine must have routines array');
  });

  it('should validate a join routine', () => {
    const program: Program = {
      routines: {
        routine1: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'first' } }
        },
        routine2: {
          type: 'define',
          outputs: { value: { type: 'string', value: 'second' } }
        },
        test_join: {
          type: 'join',
          routines: ['routine1', 'routine2']
        }
      },
      main: 'test_join'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should reject a join routine without routines array', () => {
    const program: Program = {
      routines: {
        test_join: {
          type: 'join'
        } as any
      },
      main: 'test_join'
    };

    expect(() => validateProgram(program)).toThrow('Join routine must have routines array');
  });

  it('should reject a prompt routine with invalid output type', () => {
    const program: Program = {
      routines: {
        test_prompt: {
          type: 'prompt',
          dev_msg: 'Test message',
          user_msg: 'Test ${var}',
          outputs: {
            response: 'invalid_type'
          }
        }
      },
      main: 'test_prompt'
    };

    expect(() => validateProgram(program)).toThrow('Invalid type: invalid_type');
  });

  it('should reject empty routines array in compose', () => {
    const program: Program = {
      routines: {
        test_compose: {
          type: 'compose',
          routines: []
        }
      },
      main: 'test_compose'
    };

    expect(() => validateProgram(program)).toThrow('Compose routine must have at least one routine');
  });

  it('should reject non-existent routine references', () => {
    const program: Program = {
      routines: {
        test_compose: {
          type: 'compose',
          routines: ['non_existent']
        }
      },
      main: 'test_compose'
    };

    expect(() => validateProgram(program)).toThrow('Routine "non_existent" not found');
  });

  it('should reject invalid value types in define routine', () => {
    const program: Program = {
      routines: {
        test_define: {
          type: 'define',
          outputs: {
            test: {
              type: 'invalid_type',
              value: 'test'
            }
          }
        }
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).toThrow('Invalid type: invalid_type');
  });

  it('should reject empty routines array in join', () => {
    const program: Program = {
      routines: {
        test_join: {
          type: 'join',
          routines: []
        }
      },
      main: 'test_join'
    };

    expect(() => validateProgram(program)).toThrow('Join routine must have at least one routine');
  });

  it('should reject a prompt routine with empty outputs', () => {
    const program: Program = {
      routines: {
        test_prompt: {
          type: 'prompt',
          dev_msg: 'Test message',
          user_msg: 'Test message',
          outputs: {}
        }
      },
      main: 'test_prompt'
    };

    expect(() => validateProgram(program)).toThrow('Prompt routine must have at least one output');
  });

  it('should reject a define routine with invalid input reference', () => {
    const program: Program = {
      routines: {
        test_define: {
          type: 'define',
          outputs: {
            test: 'non_existent_input'
          }
        }
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).toThrow('Input "non_existent_input" not found');
  });

  it('should validate optional types in prompt outputs', () => {
    const program: Program = {
      routines: {
        test_prompt: {
          type: 'prompt',
          dev_msg: 'Test message',
          user_msg: 'Test ${var}',
          outputs: {
            required: 'string',
            optional: 'string?'
          }
        }
      },
      main: 'test_prompt'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should validate optional input references in define routine', () => {
    const program: Program = {
      routines: {
        test_define: {
          type: 'define',
          outputs: {
            required: 'input_var',
            optional: 'input_var?',
            literal: {
              type: 'string',
              value: 'test'
            }
          }
        },
        input_provider: {
          type: 'define',
          outputs: {
            input_var: {
              type: 'string',
              value: 'test'
            }
          }
        }
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });

  it('should validate optional outputs in define routine', () => {
    const program: Program = {
      routines: {
        test_define: {
          type: 'define',
          outputs: {
            required: {
              type: 'string',
              value: 'test'
            },
            optional: {
              type: 'string',
              value: 'test',
              optional: true
            }
          }
        }
      },
      main: 'test_define'
    };

    expect(() => validateProgram(program)).not.toThrow();
  });
});
