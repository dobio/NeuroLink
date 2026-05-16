import type { ModelClient } from "./model.js";
import type { AgentMessage } from "./types.js";
import type { Tool } from "../tools/types.js";

export interface RunAgentLoopOptions {
  prompt: string;
  model: ModelClient;
  tools: Tool[];
  maxSteps?: number;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolOutput?: (toolName: string, output: string) => void;
}

export async function runAgentLoop(options: RunAgentLoopOptions): Promise<string> {
  const maxSteps = options.maxSteps ?? 10;
  const messages: AgentMessage[] = [{ role: "user", content: options.prompt }];
  const tools = new Map(options.tools.map((tool) => [tool.name, tool]));

  for (let step = 0; step < maxSteps; step += 1) {
    const result = await options.model.next(messages, options.tools);

    if (result.type === "final") {
      return result.text;
    }

    const tool = tools.get(result.toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${result.toolName}`);
    }

    options.onToolCall?.(result.toolName, result.input);
    const output = await tool.execute(result.input);
    options.onToolOutput?.(result.toolName, output);
    messages.push({ role: "tool", content: output });
  }

  throw new Error(`Agent stopped after ${maxSteps} tool steps`);
}
