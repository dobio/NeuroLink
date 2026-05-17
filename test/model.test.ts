import assert from "node:assert/strict";
import test from "node:test";
import { AnthropicMessagesClient } from "../src/providers/anthropic.js";

test("AnthropicMessagesClient posts Anthropic messages format to a custom base URL", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const requestedHeaders: Headers[] = [];
  const requestedBodies: string[] = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input));
    requestedHeaders.push(new Headers(init?.headers));
    requestedBodies.push(String(init?.body));
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "ok" }]
      }),
      { status: 200 }
    );
  };

  const client = new AnthropicMessagesClient(
    "test-key",
    "test-model",
    "https://proxy.example.com/anthropic/v1/"
  );

  const result = await client.next(
    [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "tool_call", id: "toolu_1", toolName: "read_file", input: { path: "a.ts" } }]
      },
      { role: "tool", toolCallId: "toolu_1", toolName: "read_file", content: "tool output" }
    ],
    []
  );
  const requestBody = JSON.parse(requestedBodies[0] ?? "{}");

  assert.deepEqual(requestedUrls, ["https://proxy.example.com/anthropic/v1/messages"]);
  assert.equal(requestedHeaders[0]?.get("content-type"), "application/json");
  assert.equal(requestedHeaders[0]?.get("x-api-key"), "test-key");
  assert.equal(requestedHeaders[0]?.get("anthropic-version"), "2023-06-01");
  assert.equal(requestBody.model, "test-model");
  assert.equal(requestBody.max_tokens, 4096);
  assert.match(requestBody.system, /Use tools when you need local context/);
  assert.deepEqual(requestBody.messages, [
    { role: "user", content: "hello" },
    {
      role: "assistant",
      content: [{ type: "tool_use", id: "toolu_1", name: "read_file", input: { path: "a.ts" } }]
    },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "tool output" }]
    }
  ]);
  assert.deepEqual(result, { type: "final", text: "ok" });
});

test("AnthropicMessagesClient maps internal tools to Anthropic tool_use", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedBodies: string[] = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    requestedBodies.push(String(init?.body));
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "tool_use",
            id: "toolu_read",
            name: "read_file",
            input: { path: "src/app/bootstrap.ts" }
          }
        ]
      }),
      { status: 200 }
    );
  };

  const client = new AnthropicMessagesClient("test-key", "test-model", "https://proxy.example.com");

  const result = await client.next([{ role: "user", content: "inspect files" }], [
    {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false
      },
      execute: async () => ""
    }
  ]);
  const requestBody = JSON.parse(requestedBodies[0] ?? "{}");

  assert.deepEqual(requestBody.tools, [
    {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace.",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false
      }
    }
  ]);
  assert.deepEqual(result, {
    type: "tool_calls",
    toolCalls: [{ id: "toolu_read", toolName: "read_file", input: { path: "src/app/bootstrap.ts" } }]
  });
});

test("AnthropicMessagesClient returns every Anthropic tool_use block", async (t) => {
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        content: [
          { type: "thinking", thinking: "inspect several files", signature: "sig_multi" },
          { type: "tool_use", id: "toolu_readme", name: "read_file", input: { path: "README.md" } },
          { type: "tool_use", id: "toolu_provider", name: "read_file", input: { path: "src/providers/anthropic.ts" } },
          { type: "tool_use", id: "toolu_package", name: "read_file", input: { path: "package.json" } }
        ]
      }),
      { status: 200 }
    );

  const client = new AnthropicMessagesClient("test-key", "test-model", "https://proxy.example.com");

  const result = await client.next([{ role: "user", content: "inspect files" }], []);

  assert.deepEqual(result, {
    type: "tool_calls",
    toolCalls: [
      { id: "toolu_readme", toolName: "read_file", input: { path: "README.md" } },
      { id: "toolu_provider", toolName: "read_file", input: { path: "src/providers/anthropic.ts" } },
      { id: "toolu_package", toolName: "read_file", input: { path: "package.json" } }
    ],
    thinking: [{ thinking: "inspect several files", signature: "sig_multi" }]
  });
});

test("AnthropicMessagesClient groups consecutive tool results after multiple tool_use blocks", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedBodies: string[] = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    requestedBodies.push(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: "text", text: "done" }] }), { status: 200 });
  };

  const client = new AnthropicMessagesClient("test-key", "test-model", "https://proxy.example.com");

  await client.next(
    [
      { role: "user", content: "inspect files" },
      {
        role: "assistant",
        content: [
          { type: "tool_call", id: "toolu_readme", toolName: "read_file", input: { path: "README.md" } },
          { type: "tool_call", id: "toolu_provider", toolName: "read_file", input: { path: "src/providers/anthropic.ts" } },
          { type: "tool_call", id: "toolu_package", toolName: "read_file", input: { path: "package.json" } }
        ]
      },
      { role: "tool", toolCallId: "toolu_readme", toolName: "read_file", content: "readme content" },
      { role: "tool", toolCallId: "toolu_provider", toolName: "read_file", content: "provider content" },
      { role: "tool", toolCallId: "toolu_package", toolName: "read_file", content: "package content" }
    ],
    []
  );

  const requestBody = JSON.parse(requestedBodies[0] ?? "{}");
  assert.deepEqual(requestBody.messages, [
    { role: "user", content: "inspect files" },
    {
      role: "assistant",
      content: [
        { type: "tool_use", id: "toolu_readme", name: "read_file", input: { path: "README.md" } },
        { type: "tool_use", id: "toolu_provider", name: "read_file", input: { path: "src/providers/anthropic.ts" } },
        { type: "tool_use", id: "toolu_package", name: "read_file", input: { path: "package.json" } }
      ]
    },
    {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_readme", content: "readme content" },
        { type: "tool_result", tool_use_id: "toolu_provider", content: "provider content" },
        { type: "tool_result", tool_use_id: "toolu_package", content: "package content" }
      ]
    }
  ]);
});

test("AnthropicMessagesClient preserves thinking blocks in assistant messages for round-trip", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedBodies: string[] = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    requestedBodies.push(String(init?.body));
    return new Response(
      JSON.stringify({ content: [{ type: "text", text: "done" }] }),
      { status: 200 }
    );
  };

  const client = new AnthropicMessagesClient("test-key", "test-model", "https://proxy.example.com");

  await client.next(
    [
      { role: "user", content: "think hard" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "let me reason...", signature: "sig123" },
          { type: "tool_call", id: "toolu_1", toolName: "read_file", input: { path: "a.ts" } }
        ]
      },
      { role: "tool", toolCallId: "toolu_1", toolName: "read_file", content: "file content" }
    ],
    []
  );

  const requestBody = JSON.parse(requestedBodies[0] ?? "{}");
  assert.deepEqual(requestBody.messages[1], {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "let me reason...", signature: "sig123" },
      { type: "tool_use", id: "toolu_1", name: "read_file", input: { path: "a.ts" } }
    ]
  });
});

test("AnthropicMessagesClient treats text content as a final answer", async (t) => {
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: [
              "我需要读取项目的关键文件来确定当前结构。",
              "```json",
              "{",
              '  "type": "tool_call",',
              '  "toolName": "read_file",',
              '  "input": { "path": "src/app/bootstrap.ts" }',
              "}",
              "```"
            ].join("\n")
          }
        ]
      }),
      { status: 200 }
    );

  const client = new AnthropicMessagesClient("test-key", "test-model", "https://proxy.example.com");

  const result = await client.next([{ role: "user", content: "inspect files" }], []);

  assert.deepEqual(result, {
    type: "final",
    text: [
      "我需要读取项目的关键文件来确定当前结构。",
      "```json",
      "{",
      '  "type": "tool_call",',
      '  "toolName": "read_file",',
      '  "input": { "path": "src/app/bootstrap.ts" }',
      "}",
      "```"
    ].join("\n")
  });
});
