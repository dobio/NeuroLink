import fs from "node:fs/promises";
import path from "node:path";
import { Workspace } from "../workspace/workspace.js";
import type { Tool } from "./types.js";

export function createFileTools(workspace: Workspace): Tool[] {
  return [
    {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace. Input: { path }",
      async execute(input) {
        const { path: filePath } = asObject(input);
        return workspace.readText(String(filePath));
      }
    },
    {
      name: "list_files",
      description: "List files inside the workspace. Input: { path? }",
      async execute(input) {
        const requested = String(asObject(input).path ?? ".");
        const root = workspace.resolveInside(requested);
        const files = await walk(root, workspace.root);
        return files.join("\n");
      }
    },
    {
      name: "search_files",
      description: "Search text files inside the workspace. Input: { query }",
      async execute(input) {
        const query = String(asObject(input).query ?? "");
        if (!query) {
          throw new Error("search_files requires query");
        }
        const files = await walk(workspace.root, workspace.root);
        const matches: string[] = [];
        for (const file of files) {
          const fullPath = workspace.resolveInside(file);
          const content = await fs.readFile(fullPath, "utf8").catch(() => "");
          content.split("\n").forEach((line, index) => {
            if (line.includes(query)) {
              matches.push(`${file}:${index + 1}: ${line}`);
            }
          });
        }
        return matches.join("\n") || "No matches";
      }
    }
  ];
}

async function walk(root: string, workspaceRoot: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, workspaceRoot)));
    } else if (entry.isFile()) {
      files.push(path.relative(workspaceRoot, fullPath));
    }
  }
  return files.sort();
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  return input as Record<string, unknown>;
}
