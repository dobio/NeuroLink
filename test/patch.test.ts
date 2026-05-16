import assert from "node:assert/strict";
import test from "node:test";
import { applyUnifiedPatch } from "../src/tools/apply-patch.js";

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
