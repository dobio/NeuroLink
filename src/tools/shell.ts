import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Workspace } from "../workspace/workspace.js";
import type { Tool } from "./types.js";

export function createShellTool(workspace: Workspace): Tool {
  return {
    name: "run_command",
    description: "Run a shell command in the workspace after user confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run from the workspace root." }
      },
      required: ["command"],
      additionalProperties: false
    },
    async execute(inputValue) {
      const command = String(asObject(inputValue).command ?? "");
      if (!command) {
        throw new Error("run_command requires command");
      }
      await confirm(`Run command in ${workspace.root}? ${command}`);
      return runCommand(command, workspace.root, 30_000);
    }
  };
}

export async function runCommand(command: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve([`exit ${code}`, stdout, stderr].filter(Boolean).join("\n"));
    });
  });
}

async function confirm(question: string): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
      throw new Error("Command rejected by user");
    }
  } finally {
    rl.close();
  }
}

function asObject(inputValue: unknown): Record<string, unknown> {
  if (!inputValue || typeof inputValue !== "object") {
    return {};
  }
  return inputValue as Record<string, unknown>;
}
