import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL,
  readAnthropicConfig
} from "../src/app/config.js";

test("readAnthropicConfig applies defaults and trims values", () => {
  const config = readAnthropicConfig({
    ANTHROPIC_API_KEY: "  key  ",
    ANTHROPIC_MODEL: " ",
    ANTHROPIC_BASE_URL: ""
  });

  assert.deepEqual(config, {
    apiKey: "key",
    model: DEFAULT_ANTHROPIC_MODEL,
    baseUrl: DEFAULT_ANTHROPIC_BASE_URL
  });
});

test("readAnthropicConfig validates ANTHROPIC_BASE_URL", () => {
  assert.throws(() => readAnthropicConfig({ ANTHROPIC_BASE_URL: "ftp://invalid" }), {
    message: "ANTHROPIC_BASE_URL must be an absolute http(s) URL"
  });
});
