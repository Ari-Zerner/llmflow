import { readFileSync, writeFileSync } from 'fs';
import { O1LLMService } from './llm';
import { Interpreter } from './interpreter';
import dotenv from 'dotenv';

dotenv.config();

function parseInputs(inputString?: string): Record<string, string> {
  if (!inputString) return {};
  
  return inputString
    .split(',')
    .map(pair => pair.trim())
    .reduce((acc, pair) => {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: ts-node cli.ts <program_file.json> [--inputs \"key:value, key2:value2\"] [--output output.json]");
    process.exit(1);
  }

  const programFile = args[0];
  const inputsIndex = args.indexOf('--inputs');
  const outputIndex = args.indexOf('--output');
  
  const inputsString = inputsIndex !== -1 ? args[inputsIndex + 1] : undefined;
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'output.json';

  try {
    // Read program
    const program = JSON.parse(readFileSync(programFile, 'utf8'));

    // Parse inputs if provided
    const inputs = parseInputs(inputsString);
    console.log('Parsed inputs:', inputs); // Add logging to debug

    // Create interpreter with O1 service
    const llmService = new O1LLMService();
    const interpreter = new Interpreter(program, llmService);

    // Run program
    const result = await interpreter.run(inputs);

    // Write output
    const output = {
      program: result.program,
      inputs,
      outputs: result.outputs,
      trace: result.trace
    };
    writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`Output written to ${outputFile}`);

  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error("Error:", e);
    process.exit(1);
  });
}
