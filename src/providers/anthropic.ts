import type { AgentMessage, ModelClient, ModelResult } from "../agent/types.js";
import type { JsonSchema, Tool } from "../tools/types.js";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "thinking";
      thinking: string;
      signature: string;
    }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    };

type AnthropicResponseContentBlock = {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  input?: unknown;
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export class AnthropicMessagesClient implements ModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-4-5",
    private readonly baseUrl = "https://api.anthropic.com/v1"
  ) {}

  async next(messages: AgentMessage[], tools: Tool[]): Promise<ModelResult> {
    const requestBody = {
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt(),
      messages: toAnthropicMessages(messages),
      ...(tools.length > 0 ? { tools: tools.map(toAnthropicTool) } : {})
    };

    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { content?: AnthropicResponseContentBlock[] };
    return fromAnthropicContent(data.content ?? []);
  }
}

function toAnthropicTool(tool: Tool): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema ?? {
      type: "object",
      additionalProperties: true
    }
  };
}

function toAnthropicMessages(messages: AgentMessage[]): AnthropicMessage[] {
  const anthropicMessages: AnthropicMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (message.role !== "tool") {
      anthropicMessages.push(toAnthropicMessage(message));
      continue;
    }

    const toolResults: AnthropicContentBlock[] = [];
    while (index < messages.length) {
      const toolMessage = messages[index];
      if (!toolMessage || toolMessage.role !== "tool") {
        index -= 1;
        break;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolMessage.toolCallId,
        content: toolMessage.content
      });
      index += 1;
    }

    anthropicMessages.push({ role: "user", content: toolResults });
  }

  return anthropicMessages;
}

function toAnthropicMessage(message: AgentMessage): AnthropicMessage {
  if (message.role === "user") {
    return { role: "user", content: message.content };
  }

  if (message.role === "tool") {
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }]
    };
  }

  return {
    role: "assistant",
    content: message.content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      if (block.type === "thinking") {
        return { type: "thinking", thinking: block.thinking, signature: block.signature };
      }
      return {
        type: "tool_use",
        id: block.id,
        name: block.toolName,
        input: block.input
      };
    })
  };
}

function fromAnthropicContent(content: AnthropicResponseContentBlock[]): ModelResult {
  const thinkingBlocks = content
    .filter((b) => b.type === "thinking" && typeof b.thinking === "string" && typeof b.signature === "string")
    .map((b) => ({ thinking: b.thinking as string, signature: b.signature as string }));

  const toolUses = content.filter((block) => block.type === "tool_use");
  if (toolUses.length > 0) {
    const toolCalls = toolUses.map((toolUse) => {
      if (!toolUse.id || !toolUse.name) {
        throw new Error("Anthropic returned an invalid tool_use block");
      }
      return {
        id: toolUse.id,
        toolName: toolUse.name,
        input: toolUse.input
      };
    });

    return {
      type: "tool_calls",
      toolCalls,
      ...(thinkingBlocks.length > 0 ? { thinking: thinkingBlocks } : {})
    };
  }

  const outputText = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  return { type: "final", text: outputText };
}

function systemPrompt(): string {
  return [
    "You are a local code agent.",
    "Use tools when you need local context, need to inspect files, or need to edit or run something.",
    "When the task is complete or you cannot proceed, reply with the final answer as normal text."
  ].join("\n");
}
