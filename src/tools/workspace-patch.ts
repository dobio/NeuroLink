import { Workspace } from "../workspace/workspace.js";
import { applyUnifiedPatch, parseUnifiedPatch } from "./apply-patch.js";
import type { Tool } from "./types.js";

export function createPatchTool(workspace: Workspace): Tool {
  return {
    name: "apply_patch",
    description: "Apply a unified patch to existing files inside the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        patch: { type: "string", description: "Unified diff patch to apply inside the workspace." }
      },
      required: ["patch"],
      additionalProperties: false
    },
    async execute(input) {
      const patch = String(asObject(input).patch ?? "");
      if (!patch) {
        throw new Error("apply_patch requires patch");
      }

      const filePatches = parseUnifiedPatch(patch);
      const files = new Map<string, string>();
      for (const filePatch of filePatches) {
        if (filePatch.oldPath && !files.has(filePatch.oldPath)) {
          files.set(filePatch.oldPath, await workspace.readText(filePatch.oldPath));
        }
      }

      const result = applyUnifiedPatch(files, patch);

      for (const filePath of result.written) {
        const content = files.get(filePath);
        if (content === undefined) {
          throw new Error(`Patch result is missing content for ${filePath}`);
        }
        await workspace.writeText(filePath, content);
      }
      for (const filePath of result.deleted) {
        await workspace.deleteFile(filePath);
      }

      return `Applied patch: wrote ${result.written.size} file(s), deleted ${result.deleted.size} file(s)`;
    }
  };
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  return input as Record<string, unknown>;
}
