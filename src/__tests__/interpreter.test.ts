import { readFileSync } from 'fs';
import { join } from 'path';
import { Interpreter } from '../interpreter';

describe('Interpreter', () => {
  let testProgram: any;

  beforeAll(() => {
    const programPath = join(__dirname, '../examples/test_program.json');
    testProgram = JSON.parse(readFileSync(programPath, 'utf8'));
  });

  describe('greeting program', () => {
    it('should generate morning greeting', () => {
      const interpreter = new Interpreter(testProgram);
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
      const interpreter = new Interpreter(testProgram);
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
      const interpreter = new Interpreter(testProgram);
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

      const interpreter = new Interpreter(badProgram);
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

      const interpreter = new Interpreter(badProgram);
      expect(() => {
        interpreter.run({});
      }).toThrow("Unknown routine type: invalid_type");
    });
  });
});
