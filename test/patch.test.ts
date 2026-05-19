import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyUnifiedPatch } from "../src/tools/apply-patch.js";
import { createPatchTool } from "../src/tools/workspace-patch.js";
import { Workspace } from "../src/workspace/workspace.js";

test("applies a single-file unified patch", () => {
  const files = new Map<string, string>([["README.md", "old title\nbody\n"]]);
  const patch = [
    "--- README.md",
    "+++ README.md",
    "@@ -1,2 +1,2 @@",
    "-old title",
    "+new title",
    " body",
    ""
  ].join("\n");

  applyUnifiedPatch(files, patch);

  assert.equal(files.get("README.md"), "new title\nbody\n");
});

test("applies git-style multi-file patches and preserves blank lines", () => {
  const files = new Map<string, string>([
    ["README.md", "old title\n\nbody\n"],
    ["src/index.ts", "export const value = 1;\n"]
  ]);
  const patch = [
    "diff --git a/README.md b/README.md",
    "index 1111111..2222222 100644",
    "--- a/README.md",
    "+++ b/README.md",
    "@@ -1,3 +1,3 @@",
    "-old title",
    "+new title",
    " ",
    " body",
    "diff --git a/src/index.ts b/src/index.ts",
    "index 3333333..4444444 100644",
    "--- a/src/index.ts",
    "+++ b/src/index.ts",
    "@@ -1 +1 @@",
    "-export const value = 1;",
    "+export const value = 2;",
    ""
  ].join("\n");

  const result = applyUnifiedPatch(files, patch);

  assert.deepEqual(result, {
    written: new Set(["README.md", "src/index.ts"]),
    deleted: new Set<string>()
  });
  assert.equal(files.get("README.md"), "new title\n\nbody\n");
  assert.equal(files.get("src/index.ts"), "export const value = 2;\n");
});

test("treats unmarked blank hunk lines as blank context lines", () => {
  const files = new Map<string, string>([["notes.txt", "before\n\nafter\n"]]);
  const patch = [
    "--- notes.txt",
    "+++ notes.txt",
    "@@ -1,3 +1,4 @@",
    " before",
    "",
    "+inserted",
    " after",
    ""
  ].join("\n");

  applyUnifiedPatch(files, patch);

  assert.equal(files.get("notes.txt"), "before\n\ninserted\nafter\n");
});

test("applies git-style new file patches", () => {
  const files = new Map<string, string>();
  const patch = [
    "diff --git a/src/new.ts b/src/new.ts",
    "new file mode 100644",
    "index 0000000..1111111",
    "--- /dev/null",
    "+++ b/src/new.ts",
    "@@ -0,0 +1,2 @@",
    "+export const created = true;",
    "+",
    ""
  ].join("\n");

  const result = applyUnifiedPatch(files, patch);

  assert.deepEqual(result, {
    written: new Set(["src/new.ts"]),
    deleted: new Set<string>()
  });
  assert.equal(files.get("src/new.ts"), "export const created = true;\n\n");
});

test("applies git-style deleted file patches", () => {
  const files = new Map<string, string>([["src/old.ts", "export const old = true;\n"]]);
  const patch = [
    "diff --git a/src/old.ts b/src/old.ts",
    "deleted file mode 100644",
    "index 1111111..0000000",
    "--- a/src/old.ts",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-export const old = true;",
    ""
  ].join("\n");

  const result = applyUnifiedPatch(files, patch);

  assert.deepEqual(result, {
    written: new Set<string>(),
    deleted: new Set(["src/old.ts"])
  });
  assert.equal(files.has("src/old.ts"), false);
});

test("applies hunks with content lines that look like patch headers", () => {
  const files = new Map<string, string>([["notes.txt", "-- old heading\nbody\n"]]);
  const patch = [
    "diff --git a/notes.txt b/notes.txt",
    "index 1111111..2222222 100644",
    "--- a/notes.txt",
    "+++ b/notes.txt",
    "@@ -1,2 +1,2 @@",
    "--- old heading",
    "+new heading",
    " body",
    ""
  ].join("\n");

  applyUnifiedPatch(files, patch);

  assert.equal(files.get("notes.txt"), "new heading\nbody\n");
});

test("preserves missing trailing newline markers", () => {
  const files = new Map<string, string>([["notes.txt", "old"]]);
  const patch = [
    "--- notes.txt",
    "+++ notes.txt",
    "@@ -1 +1 @@",
    "-old",
    "\\ No newline at end of file",
    "+new",
    "\\ No newline at end of file",
    ""
  ].join("\n");

  applyUnifiedPatch(files, patch);

  assert.equal(files.get("notes.txt"), "new");
});

test("does not mutate files when a later hunk fails", () => {
  const files = new Map<string, string>([
    ["one.txt", "old\n"],
    ["two.txt", "actual\n"]
  ]);
  const patch = [
    "--- one.txt",
    "+++ one.txt",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "--- two.txt",
    "+++ two.txt",
    "@@ -1 +1 @@",
    "-expected",
    "+changed",
    ""
  ].join("\n");

  assert.throws(() => applyUnifiedPatch(files, patch), /Patch context mismatch/);
  assert.equal(files.get("one.txt"), "old\n");
  assert.equal(files.get("two.txt"), "actual\n");
});

test("rejects patches without file changes", () => {
  assert.throws(() => applyUnifiedPatch(new Map(), "not a patch\n"), /contains no file patches/);
});

test("patch tool creates and deletes files in the workspace", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "neurolink-patch-"));
  const workspace = new Workspace(root);
  await workspace.writeText("src/old.ts", "export const old = true;\n");
  const tool = createPatchTool(workspace);
  const patch = [
    "diff --git a/src/new.ts b/src/new.ts",
    "new file mode 100644",
    "index 0000000..1111111",
    "--- /dev/null",
    "+++ b/src/new.ts",
    "@@ -0,0 +1 @@",
    "+export const created = true;",
    "diff --git a/src/old.ts b/src/old.ts",
    "deleted file mode 100644",
    "index 1111111..0000000",
    "--- a/src/old.ts",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-export const old = true;",
    ""
  ].join("\n");

  const output = await tool.execute({ patch });

  assert.equal(output, "Applied patch: wrote 1 file(s), deleted 1 file(s)");
  assert.equal(await workspace.readText("src/new.ts"), "export const created = true;\n");
  await assert.rejects(() => workspace.readText("src/old.ts"), /ENOENT/);
});
