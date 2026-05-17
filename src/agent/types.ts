import type { Tool } from "../tools/types.js";

export type AgentMessageRole = "user" | "tool" | "assistant";

export type AgentAssistantContent =
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
      type: "tool_call";
      id: string;
      toolName: string;
      input: unknown;
    };

export type AgentMessage =
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: AgentAssistantContent[];
    }
  | {
      role: "tool";
      toolCallId: string;
      toolName: string;
      content: string;
    };

export type ModelResult =
  | {
      type: "final";
      text: string;
    }
  | {
      type: "tool_calls";
      toolCalls: {
        id?: string;
        toolName: string;
        input: unknown;
      }[];
      thinking?: { thinking: string; signature: string }[];
    };

export interface ModelClient {
  next(messages: AgentMessage[], tools: Tool[]): Promise<ModelResult>;
}
