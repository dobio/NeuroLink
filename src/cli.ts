#!/usr/bin/env node
import { runAgentLoop } from "./agent/loop.js";
import { bootstrap } from "./app/bootstrap.js";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    console.error("Usage: neurolink-agent <task>");
    process.exitCode = 1;
    return;
  }

  const app = bootstrap();
  const result = await runAgentLoop({ prompt, model: app.model, tools: app.tools, ...app.hooks });
  console.log(result);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
