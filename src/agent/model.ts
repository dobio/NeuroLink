import type { AgentMessage, ModelResult } from "./types.js";
import type { Tool } from "../tools/types.js";

export interface ModelClient {
  next(messages: AgentMessage[], tools: Tool[]): Promise<ModelResult>;
}

export class EchoModelClient implements ModelClient {
  async next(messages: AgentMessage[]): Promise<ModelResult> {
    const last = messages.at(-1)?.content ?? "";
    return {
      type: "final",
      text: [
        "No model provider is configured.",
        "",
        "Set ANTHROPIC_API_KEY and use the Anthropic client path, or extend src/agent/model.ts.",
        "",
        `Last prompt: ${last}`
      ].join("\n")
    };
  }
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export class AnthropicMessagesClient implements ModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-4-5",
    private readonly baseUrl = "https://api.anthropic.com/v1"
  ) {}

  async next(messages: AgentMessage[], tools: Tool[]): Promise<ModelResult> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt(tools),
      messages: messages.map(toAnthropicMessage)
    });

    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { content?: AnthropicContentBlock[] };
    const outputText = data.content
      ?.filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n") ?? "";
    const parsed = JSON.parse(outputText || "{}") as Partial<ModelResult>;
    if (parsed.type === "tool_call" && "toolName" in parsed) {
      return { type: "tool_call", toolName: String(parsed.toolName), input: parsed.input };
    }
    if (parsed.type === "final") {
      return { type: "final", text: String(parsed.text ?? "") };
    }
    throw new Error("Model returned an invalid agent result");
  }
}

function toAnthropicMessage(message: AgentMessage): { role: "user" | "assistant"; content: string } {
  if (message.role === "assistant") {
    return { role: "assistant", content: message.content };
  }
  if (message.role === "tool") {
    return { role: "user", content: `TOOL RESULT:\n${message.content}` };
  }
  return { role: "user", content: message.content };
}

function systemPrompt(tools: Tool[]): string {
  return [
    "You are a local code agent. Reply only as JSON matching the requested schema.",
    "Use a tool_call when you need local context or need to edit/run something.",
    "Use final when the task is complete or you cannot proceed.",
    "Final replies must use {\"type\":\"final\",\"text\":\"...\"}.",
    "Tool calls must use {\"type\":\"tool_call\",\"toolName\":\"...\",\"input\":{...}}.",
    "Available tools:",
    ...tools.map((tool) => `- ${tool.name}: ${tool.description}`)
  ].join("\n");
}
