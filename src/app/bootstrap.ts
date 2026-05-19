import type { ModelClient } from "../agent/types.js";
import { AnthropicMessagesClient } from "../providers/anthropic.js";
import { EchoModelClient } from "../providers/echo.js";
import { createTools } from "../tools/index.js";
import type { Tool } from "../tools/types.js";
import { Workspace } from "../workspace/workspace.js";
import { readAnthropicConfig } from "./config.js";

export interface BootstrapOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  createWorkspace?: (cwd: string) => Workspace;
  createTools?: (workspace: Workspace) => Tool[];
  createAnthropicModel?: (apiKey: string, model: string, baseUrl: string) => ModelClient;
  createFallbackModel?: () => ModelClient;
}

export interface AppRuntime {
  workspace: Workspace;
  model: ModelClient;
  tools: Tool[];
  hooks: {
    onModelText(text: string): void;
    onToolCall(toolName: string): void;
    onToolOutput(toolName: string, output: string): void;
  };
}

export function bootstrap(options: BootstrapOptions = {}): AppRuntime {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const workspaceFactory = options.createWorkspace ?? ((path) => new Workspace(path));
  const toolsFactory = options.createTools ?? createTools;
  const anthropicFactory =
    options.createAnthropicModel ?? ((apiKey, model, baseUrl) => new AnthropicMessagesClient(apiKey, model, baseUrl));
  const fallbackFactory = options.createFallbackModel ?? (() => new EchoModelClient());

  const workspace = workspaceFactory(cwd);
  const tools = toolsFactory(workspace);
  const anthropic = readAnthropicConfig(env);
  const model = anthropic.apiKey
    ? anthropicFactory(anthropic.apiKey, anthropic.model, anthropic.baseUrl)
    : fallbackFactory();

  return {
    workspace,
    model,
    tools,
    hooks: {
      onModelText(text: string) {
        console.log(text);
      },
      onToolCall(toolName: string) {
        console.log(`tool: ${toolName}`);
      },
      onToolOutput(toolName: string, output: string) {
      }
    }
  };
}
