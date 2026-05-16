#!/usr/bin/env node
import { runAgentLoop } from "./agent/loop.js";
import { AnthropicMessagesClient, EchoModelClient } from "./agent/model.js";
import { createTools } from "./tools/index.js";
import { Workspace } from "./workspace/workspace.js";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    console.error("Usage: neurolink-agent <task>");
    process.exitCode = 1;
    return;
  }

  const workspace = new Workspace(process.cwd());
  const model = process.env.ANTHROPIC_API_KEY
    ? new AnthropicMessagesClient(process.env.ANTHROPIC_API_KEY)
    : new EchoModelClient();

  const result = await runAgentLoop({
    prompt,
    model,
    tools: createTools(workspace),
    onToolCall(toolName) {
      console.error(`tool: ${toolName}`);
    },
    onToolOutput(toolName, output) {
      console.error(`tool output: ${toolName}`);
      console.error(output);
    }
  });

  console.log(result);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
