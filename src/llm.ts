import { OpenAI } from 'openai';

export interface LLMService {
  callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Promise<Record<string, any>>;
}

export class O1LLMService implements LLMService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }
    this.openai = new OpenAI({ apiKey });
  }

  async callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Promise<Record<string, any>> {
    // Create a JSON schema based on the outputs specification
    const properties: Record<string, { type: string }> = {};
    for (const [key, type] of Object.entries(outputs)) {
      properties[key] = { type: type.toLowerCase() };
    }

    const response = await this.openai.chat.completions.create({
      model: "o1",
      messages: [
        { role: "developer", content: devMsg },
        { role: "user", content: userMsg }
      ],
      functions: [{
        name: "output",
        parameters: {
          type: "object",
          properties,
          required: Object.keys(properties)
        }
      }],
      function_call: { name: "output" }
    });

    const functionCall = response.choices[0].message.function_call;
    if (!functionCall || !functionCall.arguments) {
      throw new Error("No function call in response");
    }

    return JSON.parse(functionCall.arguments);
  }
}
