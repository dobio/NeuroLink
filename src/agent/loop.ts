import type { AgentMessage, ModelClient } from "./types.js";
import type { Tool } from "../tools/types.js";

export interface RunAgentLoopOptions {
  prompt: string;
  model: ModelClient;
  tools: Tool[];
  maxSteps?: number;
  onModelText?: (text: string) => void;
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

    const executableCalls = result.toolCalls.map((toolCall) => {
      const tool = tools.get(toolCall.toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolCall.toolName}`);
      }
      return { toolCall, tool };
    });

    if (executableCalls.length === 0) {
      throw new Error("Model returned no tool calls");
    }

    if (result.text) {
      options.onModelText?.(result.text);
    }

    const thinkingContent = result.thinking?.map((t) => ({ type: "thinking" as const, thinking: t.thinking, signature: t.signature })) ?? [];
    const textContent = result.text ? [{ type: "text" as const, text: result.text }] : [];
    const assistantToolCalls = executableCalls.map(({ toolCall }, index) => ({
      type: "tool_call" as const,
      id: toolCall.id ?? fallbackToolCallId(step, index, executableCalls.length),
      toolName: toolCall.toolName,
      input: toolCall.input
    }));
    messages.push({
      role: "assistant",
      content: [...thinkingContent, ...textContent, ...assistantToolCalls]
    });

    for (const [index, { toolCall, tool }] of executableCalls.entries()) {
      const toolCallId = assistantToolCalls[index]?.id ?? fallbackToolCallId(step, index, executableCalls.length);
      options.onToolCall?.(toolCall.toolName, toolCall.input);
      const output = await tool.execute(toolCall.input);
      options.onToolOutput?.(toolCall.toolName, output);
      messages.push({ role: "tool", toolCallId, toolName: toolCall.toolName, content: output });
    }
  }

  throw new Error(`Agent stopped after ${maxSteps} tool steps`);
}

function fallbackToolCallId(step: number, index: number, total: number): string {
  if (total === 1) {
    return `tool_call_${step + 1}`;
  }
  return `tool_call_${step + 1}_${index + 1}`;
}
