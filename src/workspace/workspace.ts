import fs from "node:fs/promises";
import path from "node:path";

export class Workspace {
  readonly root: string;

  constructor(root = process.cwd()) {
    this.root = path.resolve(root);
  }

  resolveInside(inputPath: string): string {
    const resolved = path.resolve(this.root, inputPath);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Path is outside workspace: ${inputPath}`);
    }
    return resolved;
  }

  relative(inputPath: string): string {
    return path.relative(this.root, this.resolveInside(inputPath));
  }

  async readText(inputPath: string): Promise<string> {
    return fs.readFile(this.resolveInside(inputPath), "utf8");
  }

  async writeText(inputPath: string, content: string): Promise<void> {
    const resolved = this.resolveInside(inputPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf8");
  }
}
