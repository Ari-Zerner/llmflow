import { readFileSync } from 'fs';
import { join } from 'path';
import { Interpreter } from '../interpreter';
import { LLMService } from '../llm';
import { Program } from '../types';

describe('Interpreter', () => {
  let testProgram: any;

  beforeAll(() => {
    const programPath = join(__dirname, '../examples/test_program.json');
    testProgram = JSON.parse(readFileSync(programPath, 'utf8'));
  });

  describe('greeting program', () => {
    it('should generate morning greeting', () => {
      const interpreter = new Interpreter(testProgram, new MockLLMService());
      const result = interpreter.run({
        name: "Alice",
        time_of_day: "morning"
      });

      expect(result.outputs).toMatchObject({
        greeting: expect.stringContaining("Alice"),
        activity: "Would you like some coffee?",
        emoji: "👋"
      });
    });

    it('should generate evening greeting', () => {
      const interpreter = new Interpreter(testProgram, new MockLLMService());
      const result = interpreter.run({
        name: "Bob",
        time_of_day: "evening"
      });

      expect(result.outputs).toMatchObject({
        greeting: expect.stringContaining("Bob"),
        activity: "How about some tea?",
        emoji: "👋"
      });
    });

    it('should handle missing inputs gracefully', () => {
      const interpreter = new Interpreter(testProgram, new MockLLMService());
      const result = interpreter.run({});

      expect(result.outputs).toMatchObject({
        greeting: expect.any(String),
        activity: expect.any(String),
        emoji: "👋"
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for missing routine', () => {
      const badProgram = {
        ...testProgram,
        routines: {
          ...testProgram.routines,
          time_based_greeting: {
            type: 'compose',
            routines: ['check_time', 'non_existent_routine']
          }
        }
      };

      const mockLLM = new MockLLMService();
      const interpreter = new Interpreter(badProgram, mockLLM);
      expect(() => {
        interpreter.run({ time_of_day: "morning" });
      }).toThrow("Routine 'non_existent_routine' not found");
    });

    it('should throw error for unknown routine type', () => {
      const badProgram = {
        ...testProgram,
        routines: {
          ...testProgram.routines,
          bad_routine: {
            type: 'invalid_type'
          }
        },
        main: 'bad_routine'
      };

      const mockLLM = new MockLLMService();
      const interpreter = new Interpreter(badProgram, mockLLM);
      expect(() => {
        interpreter.run({});
      }).toThrow("Unknown routine type: invalid_type");
    });
  });

  describe('optional types', () => {
    it('should handle optional input references', () => {
      const program: Program = {
        routines: {
          test_define: {
            type: 'define',
            outputs: {
              required: 'input_var',
              optional: 'missing_var?'
            }
          }
        },
        main: 'test_define'
      };

      const mockLLM = new MockLLMService();
      const interpreter = new Interpreter(program, mockLLM);
      const result = interpreter.run({ input_var: 'test' });
      
      expect(result.outputs).toEqual({
        required: 'test',
        optional: undefined
      });
    });

    it('should handle optional outputs in define routine', () => {
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
                value: undefined,
                optional: true
              }
            }
          }
        },
        main: 'test_define'
      };

      const mockLLM = new MockLLMService();
      const interpreter = new Interpreter(program, mockLLM);
      const result = interpreter.run({});
      
      expect(result.outputs).toEqual({
        required: 'test'
        // optional field should not be present
      });
    });
  });
});

class MockLLMService implements LLMService {
  callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Record<string, any> {
    // Extract name from user message for greeting
    const nameMatch = userMsg.match(/for\s+(\w+)/);
    const name = nameMatch ? nameMatch[1] : 'there';

    return Object.fromEntries(
      Object.entries(outputs).map(([key, type]) => {
        switch (type) {
          case 'string':
            if (key === 'greeting') {
              return [key, `[MOCK] Hello ${name}!`];
            }
            return [key, `[MOCK] ${key}_response`];
          case 'boolean':
            return [key, Math.random() > 0.5];
          case 'number':
            return [key, Math.floor(Math.random() * 100)];
          case 'string[]':
            return [key, [`[MOCK] ${key}_item1`, `[MOCK] ${key}_item2`]];
          case 'number[]':
            return [key, [Math.random() * 100, Math.random() * 100]];
          case 'boolean[]':
            return [key, [Math.random() > 0.5, Math.random() > 0.5]];
          default:
            return [key, `[MOCK] Unsupported type: ${type}`];
        }
      })
    );
  }
}
