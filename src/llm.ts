export interface LLMService {
  callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Record<string, any>;
}

export class DefaultLLMService implements LLMService {
  callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Record<string, any> {
    // Simulate LLM response with the same structure as the requested outputs
    return Object.fromEntries(
      Object.entries(outputs).map(([key, type]) => 
        [key, `simulated_${key}_response_based_on_${userMsg}`]
      )
    );
  }
}
