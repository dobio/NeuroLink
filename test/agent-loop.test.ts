import assert from "node:assert/strict";
import test from "node:test";
import { runAgentLoop } from "../src/agent/loop.js";
import type { ModelClient } from "../src/agent/types.js";
import type { Tool } from "../src/tools/types.js";

test("agent loop executes requested tools until the model returns a final answer", async () => {
  const calls: string[] = [];
  const model: ModelClient = {
    async next(messages, tools) {
      if (messages.length === 1) {
        assert.equal(tools.length, 1);
        return { type: "tool_calls", toolCalls: [{ toolName: "echo", input: { text: "hello" } }] };
      }

      assert.deepEqual(messages[1], {
        role: "assistant",
        content: [{ type: "tool_call", id: "tool_call_1", toolName: "echo", input: { text: "hello" } }]
      });
      assert.deepEqual(messages[2], {
        role: "tool",
        toolCallId: "tool_call_1",
        toolName: "echo",
        content: "hello"
      });

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
        return { type: "tool_calls", toolCalls: [{ toolName: "echo", input: { text: "hello" } }] };
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

test("agent loop executes every tool call returned in a single model step", async () => {
  const calls: string[] = [];
  const model: ModelClient = {
    async next(messages) {
      if (messages.length === 1) {
        return {
          type: "tool_calls",
          toolCalls: [
            { id: "toolu_a", toolName: "echo", input: { text: "alpha" } },
            { id: "toolu_b", toolName: "echo", input: { text: "beta" } }
          ],
          thinking: [{ thinking: "read both values", signature: "sig123" }]
        };
      }

      assert.deepEqual(messages[1], {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "read both values", signature: "sig123" },
          { type: "tool_call", id: "toolu_a", toolName: "echo", input: { text: "alpha" } },
          { type: "tool_call", id: "toolu_b", toolName: "echo", input: { text: "beta" } }
        ]
      });
      assert.deepEqual(messages[2], {
        role: "tool",
        toolCallId: "toolu_a",
        toolName: "echo",
        content: "alpha"
      });
      assert.deepEqual(messages[3], {
        role: "tool",
        toolCallId: "toolu_b",
        toolName: "echo",
        content: "beta"
      });

      return { type: "final", text: "done" };
    }
  };
  const echoTool: Tool = {
    name: "echo",
    description: "Echo text",
    async execute(input) {
      const text = String((input as { text: string }).text);
      calls.push(text);
      return text;
    }
  };

  const result = await runAgentLoop({
    prompt: "say hello",
    model,
    tools: [echoTool],
    maxSteps: 3
  });

  assert.deepEqual(calls, ["alpha", "beta"]);
  assert.equal(result, "done");
});

test("agent loop reports assistant text before executing tool calls", async () => {
  const textOutputs: string[] = [];
  const model: ModelClient = {
    async next(messages) {
      if (messages.length === 1) {
        return {
          type: "tool_calls",
          text: "找到了 `xiaozuowen.md` 文件，让我先看看它目前的内容。",
          toolCalls: [{ id: "toolu_read", toolName: "echo", input: { text: "content" } }]
        };
      }

      assert.deepEqual(messages[1], {
        role: "assistant",
        content: [
          { type: "text", text: "找到了 `xiaozuowen.md` 文件，让我先看看它目前的内容。" },
          { type: "tool_call", id: "toolu_read", toolName: "echo", input: { text: "content" } }
        ]
      });

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

  const result = await runAgentLoop({
    prompt: "读取小作文",
    model,
    tools: [echoTool],
    maxSteps: 3,
    onModelText(text) {
      textOutputs.push(text);
    }
  });

  assert.deepEqual(textOutputs, ["找到了 `xiaozuowen.md` 文件，让我先看看它目前的内容。"]);
  assert.equal(result, "done");
});
