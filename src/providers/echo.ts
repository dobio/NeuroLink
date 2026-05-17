import type { AgentMessage, ModelClient, ModelResult } from "../agent/types.js";

export class EchoModelClient implements ModelClient {
  async next(messages: AgentMessage[]): Promise<ModelResult> {
    const last = messageText(messages.at(-1));
    return {
      type: "final",
      text: [
        "No model provider is configured.",
        "",
        "Set ANTHROPIC_API_KEY and use the Anthropic provider, or add another provider adapter.",
        "",
        `Last prompt: ${last}`
      ].join("\n")
    };
  }
}

function messageText(message: AgentMessage | undefined): string {
  if (!message) {
    return "";
  }
  if (message.role === "assistant") {
    return message.content
      .map((block) => (block.type === "text" ? block.text : block.type === "thinking" ? `<thinking>` : `${block.toolName}(${JSON.stringify(block.input)})`))
      .join("\n");
  }
  return message.content;
}
