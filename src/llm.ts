export interface LLMService {
  callLLM(devMsg: string, userMsg: string, outputs: Record<string, string>): Record<string, any>;
}
