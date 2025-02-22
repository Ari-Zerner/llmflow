import { Interpreter } from "../interpreter";
import { LLMService } from "../llm";
import { readFileSync } from 'fs';
import { join } from 'path';

class MockLLMService implements LLMService {
  callCount = 0;
  async callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Promise<Record<string, any>> {
    this.callCount++;
    // Return structured output matching the requested format
    if (this.callCount >= 2) {
      return {
        text: "final version",
        is_complete: true
      };
    }
    return {
      text: "intermediate version",
      is_complete: false
    };
  }
}

describe('Refinement Program', () => {
  let testProgram: any;
  let mockLLM: MockLLMService;

  beforeAll(() => {
    const programPath = join(__dirname, '../examples/refinement_program.json');
    testProgram = JSON.parse(readFileSync(programPath, 'utf8'));
  });

  beforeEach(() => {
    mockLLM = new MockLLMService();
  });

  it('should loop refinement until LLM indicates completion', async () => {
    const interpreter = new Interpreter(testProgram, mockLLM);
    const result = await interpreter.run({ text: "start" });
    expect(result.outputs.final_text).toEqual("final version");
    expect(mockLLM.callCount).toBe(2);
  });
});
