import { Workspace } from "../workspace/workspace.js";
import { applyUnifiedPatch, parseUnifiedPatch } from "./apply-patch.js";
import type { Tool } from "./types.js";

export function createPatchTool(workspace: Workspace): Tool {
  return {
    name: "apply_patch",
    description: "Apply a unified patch to existing files inside the workspace. Input: { patch }",
    async execute(input) {
      const patch = String(asObject(input).patch ?? "");
      if (!patch) {
        throw new Error("apply_patch requires patch");
      }

      const filePatches = parseUnifiedPatch(patch);
      const files = new Map<string, string>();
      for (const filePatch of filePatches) {
        files.set(filePatch.path, await workspace.readText(filePatch.path));
      }

      applyUnifiedPatch(files, patch);

      for (const [filePath, content] of files) {
        await workspace.writeText(filePath, content);
      }

      return `Applied patch to ${files.size} file(s)`;
    }
  };
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  return input as Record<string, unknown>;
}
