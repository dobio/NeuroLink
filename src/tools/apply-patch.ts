interface FilePatch {
  path: string;
  hunks: Hunk[];
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  lines: string[];
}

export function applyUnifiedPatch(files: Map<string, string>, patch: string): void {
  for (const filePatch of parseUnifiedPatch(patch)) {
    const original = files.get(filePatch.path);
    if (original === undefined) {
      throw new Error(`Patch target does not exist: ${filePatch.path}`);
    }
    files.set(filePatch.path, applyFilePatch(original, filePatch.hunks));
  }
}

export function parseUnifiedPatch(patch: string): FilePatch[] {
  const lines = patch.split("\n");
  const patches: FilePatch[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].startsWith("--- ")) {
      index += 1;
      continue;
    }

    index += 1;
    const next = lines[index];
    if (!next?.startsWith("+++ ")) {
      throw new Error("Invalid unified patch: missing +++ header");
    }
    const path = cleanPatchPath(next.slice(4));
    index += 1;

    const hunks: Hunk[] = [];
    while (index < lines.length && lines[index].startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[index]);
      if (!match) {
        throw new Error(`Invalid hunk header: ${lines[index]}`);
      }
      const oldStart = Number(match[1]);
      const oldCount = Number(match[2] ?? "1");
      index += 1;

      const hunkLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith("@@") && !lines[index].startsWith("--- ")) {
        if (lines[index] !== "") {
          hunkLines.push(lines[index]);
        }
        index += 1;
      }

      hunks.push({ oldStart, oldCount, lines: hunkLines });
    }

    patches.push({ path, hunks });
  }

  return patches;
}

function applyFilePatch(original: string, hunks: Hunk[]): string {
  const hasTrailingNewline = original.endsWith("\n");
  const originalLines = original.split("\n");
  if (hasTrailingNewline) {
    originalLines.pop();
  }

  const output: string[] = [];
  let cursor = 0;

  for (const hunk of hunks) {
    const startIndex = hunk.oldStart - 1;
    output.push(...originalLines.slice(cursor, startIndex));
    cursor = startIndex;

    let consumed = 0;
    for (const line of hunk.lines) {
      const marker = line[0];
      const text = line.slice(1);

      if (marker === " ") {
        assertLine(originalLines[cursor], text);
        output.push(text);
        cursor += 1;
        consumed += 1;
      } else if (marker === "-") {
        assertLine(originalLines[cursor], text);
        cursor += 1;
        consumed += 1;
      } else if (marker === "+") {
        output.push(text);
      } else if (line.startsWith("\\ No newline")) {
        continue;
      } else {
        throw new Error(`Unsupported patch line: ${line}`);
      }
    }

    if (consumed !== hunk.oldCount) {
      throw new Error(`Hunk consumed ${consumed} lines, expected ${hunk.oldCount}`);
    }
  }

  output.push(...originalLines.slice(cursor));
  return `${output.join("\n")}${hasTrailingNewline ? "\n" : ""}`;
}

function assertLine(actual: string | undefined, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Patch context mismatch: expected "${expected}", got "${actual ?? "<EOF>"}"`);
  }
}

function cleanPatchPath(rawPath: string): string {
  return rawPath.replace(/^[ab]\//, "").trim();
}
