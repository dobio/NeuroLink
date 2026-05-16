export interface AnthropicConfig {
  apiKey?: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

export function readAnthropicConfig(env: NodeJS.ProcessEnv): AnthropicConfig {
  const apiKey = normalizeOptional(env.ANTHROPIC_API_KEY);
  const model = normalizeOptional(env.ANTHROPIC_MODEL) ?? DEFAULT_ANTHROPIC_MODEL;
  const baseUrl = normalizeOptional(env.ANTHROPIC_BASE_URL) ?? DEFAULT_ANTHROPIC_BASE_URL;

  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error("ANTHROPIC_BASE_URL must be an absolute http(s) URL");
  }

  return { apiKey, model, baseUrl };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
