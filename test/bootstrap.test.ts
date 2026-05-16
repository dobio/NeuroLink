import assert from "node:assert/strict";
import test from "node:test";
import { bootstrap } from "../src/app/bootstrap.js";
import type { ModelClient } from "../src/agent/model.js";
import type { Tool } from "../src/tools/types.js";

test("bootstrap wires workspace, tools, hooks, and anthropic model from env", () => {
  const calls: string[] = [];
  const mockWorkspace = { root: "/tmp/project" } as unknown as { root: string };
  const mockTools: Tool[] = [{ name: "mock", description: "mock", execute: async () => "ok" }];
  const anthropicModel: ModelClient = { next: async () => ({ type: "final", text: "anthropic" }) };

  const app = bootstrap({
    cwd: "/tmp/project",
    env: {
      ANTHROPIC_API_KEY: "key",
      ANTHROPIC_MODEL: "m1",
      ANTHROPIC_BASE_URL: "https://proxy.example.com/v1"
    },
    createWorkspace(cwd) {
      calls.push(`workspace:${cwd}`);
      return mockWorkspace as never;
    },
    createTools(workspace) {
      calls.push(`tools:${(workspace as never as { root: string }).root}`);
      return mockTools;
    },
    createAnthropicModel(apiKey, model, baseUrl) {
      calls.push(`model:${apiKey}:${model}:${baseUrl}`);
      return anthropicModel;
    }
  });

  assert.deepEqual(calls, [
    "workspace:/tmp/project",
    "tools:/tmp/project",
    "model:key:m1:https://proxy.example.com/v1"
  ]);
  assert.equal(app.model, anthropicModel);
  assert.equal(app.tools, mockTools);
  assert.equal(typeof app.hooks.onToolCall, "function");
  assert.equal(typeof app.hooks.onToolOutput, "function");
});

test("bootstrap uses fallback model when ANTHROPIC_API_KEY is missing", () => {
  const fallbackModel: ModelClient = { next: async () => ({ type: "final", text: "fallback" }) };
  const app = bootstrap({
    env: { ANTHROPIC_MODEL: "ignored-without-key" },
    createFallbackModel() {
      return fallbackModel;
    }
  });

  assert.equal(app.model, fallbackModel);
});
