import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { Workspace } from "../src/workspace/workspace.js";

test("workspace resolves paths inside the project root", () => {
  const root = path.resolve("/tmp/example-project");
  const workspace = new Workspace(root);

  assert.equal(workspace.resolveInside("src/index.ts"), path.join(root, "src/index.ts"));
});

test("workspace rejects paths outside the project root", () => {
  const root = path.resolve("/tmp/example-project");
  const workspace = new Workspace(root);

  assert.throws(() => workspace.resolveInside("../secret.txt"), /outside workspace/);
});
