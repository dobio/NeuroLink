export type AgentMessageRole = "user" | "tool" | "assistant";

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
}

export type ModelResult =
  | {
      type: "final";
      text: string;
    }
  | {
      type: "tool_call";
      toolName: string;
      input: unknown;
    };
