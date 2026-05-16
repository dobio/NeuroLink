import assert from "node:assert/strict";
import test from "node:test";
import { runAgentLoop } from "../src/agent/loop.js";
import type { ModelClient } from "../src/agent/model.js";
import type { Tool } from "../src/tools/types.js";

test("agent loop executes requested tools until the model returns a final answer", async () => {
  const calls: string[] = [];
  const model: ModelClient = {
    async next(messages, tools) {
      if (messages.length === 1) {
        assert.equal(tools.length, 1);
        return { type: "tool_call", toolName: "echo", input: { text: "hello" } };
      }

      return { type: "final", text: `done: ${messages.at(-1)?.content}` };
    }
  };
  const echoTool: Tool = {
    name: "echo",
    description: "Echo text",
    async execute(input) {
      calls.push("echo");
      return String((input as { text: string }).text);
    }
  };

  const result = await runAgentLoop({
    prompt: "say hello",
    model,
    tools: [echoTool],
    maxSteps: 3
  });

  assert.deepEqual(calls, ["echo"]);
  assert.equal(result, "done: hello");
});

test("agent loop reports tool output after execution", async () => {
  const outputs: Array<{ toolName: string; output: string }> = [];
  const model: ModelClient = {
    async next(messages) {
      if (messages.length === 1) {
        return { type: "tool_call", toolName: "echo", input: { text: "hello" } };
      }

      return { type: "final", text: "done" };
    }
  };
  const echoTool: Tool = {
    name: "echo",
    description: "Echo text",
    async execute(input) {
      return String((input as { text: string }).text);
    }
  };

  await runAgentLoop({
    prompt: "say hello",
    model,
    tools: [echoTool],
    maxSteps: 3,
    onToolOutput(toolName, output) {
      outputs.push({ toolName, output });
    }
  });

  assert.deepEqual(outputs, [{ toolName: "echo", output: "hello" }]);
});
