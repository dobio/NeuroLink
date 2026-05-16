import assert from "node:assert/strict";
import test from "node:test";
import { AnthropicMessagesClient } from "../src/agent/model.js";

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
        content: [{ type: "text", text: '{"type":"final","text":"ok"}' }]
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
      { role: "tool", content: "tool output" }
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
  assert.match(requestBody.system, /Reply only as JSON/);
  assert.deepEqual(requestBody.messages, [
    { role: "user", content: "hello" },
    { role: "user", content: "TOOL RESULT:\ntool output" }
  ]);
  assert.deepEqual(result, { type: "final", text: "ok" });
});
