import { Workspace } from "../workspace/workspace.js";
import { createFileTools } from "./files.js";
import { createPatchTool } from "./workspace-patch.js";
import { createShellTool } from "./shell.js";
import type { Tool } from "./types.js";

export function createTools(workspace: Workspace): Tool[] {
  return [...createFileTools(workspace), createPatchTool(workspace), createShellTool(workspace)];
}
