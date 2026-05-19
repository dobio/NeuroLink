export interface FilePatch {
  oldPath: string | null;
  newPath: string | null;
  hunks: Hunk[];
}

export interface PatchResult {
  written: Set<string>;
  deleted: Set<string>;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newCount: number;
  lines: HunkLine[];
}

interface HunkLine {
  marker: " " | "-" | "+";
  text: string;
  noNewline?: boolean;
}

export function applyUnifiedPatch(files: Map<string, string>, patch: string): PatchResult {
  const filePatches = parseUnifiedPatch(patch);
  if (filePatches.length === 0) {
    throw new Error("Invalid unified patch: contains no file patches");
  }

  const workingFiles = new Map(files);
  const result: PatchResult = { written: new Set<string>(), deleted: new Set<string>() };

  for (const filePatch of filePatches) {
    const targetPath = filePatch.newPath ?? filePatch.oldPath;
    if (!targetPath) {
      throw new Error("Invalid unified patch: file patch has no target path");
    }

    if (filePatch.newPath === null) {
      const original = readExistingFile(workingFiles, filePatch.oldPath);
      applyFilePatch(original, filePatch.hunks);
      workingFiles.delete(targetPath);
      result.deleted.add(targetPath);
      continue;
    }

    const original = filePatch.oldPath === null ? "" : readExistingFile(workingFiles, filePatch.oldPath);
    const updated = applyFilePatch(original, filePatch.hunks);
    if (filePatch.oldPath && filePatch.oldPath !== filePatch.newPath) {
      workingFiles.delete(filePatch.oldPath);
      result.deleted.add(filePatch.oldPath);
    }
    workingFiles.set(filePatch.newPath, updated);
    result.written.add(filePatch.newPath);
  }

  files.clear();
  for (const [filePath, content] of workingFiles) {
    files.set(filePath, content);
  }

  return result;
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

    const oldPath = cleanPatchPath(lines[index].slice(4));
    index += 1;

    const next = lines[index];
    if (!next?.startsWith("+++ ")) {
      throw new Error("Invalid unified patch: missing +++ header");
    }
    const newPath = cleanPatchPath(next.slice(4));
    index += 1;

    const hunks: Hunk[] = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith("diff --git ") || line.startsWith("--- ")) {
        break;
      }
      if (!line.startsWith("@@")) {
        index += 1;
        continue;
      }

      const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!header) {
        throw new Error(`Invalid hunk header: ${line}`);
      }

      const oldCount = Number(header[2] ?? "1");
      const newCount = Number(header[4] ?? "1");
      index += 1;

      const hunkLines: HunkLine[] = [];
      let consumed = 0;
      let produced = 0;
      while (
        index < lines.length &&
        (consumed < oldCount || produced < newCount || lines[index].startsWith("\\ No newline"))
      ) {
        const hunkLine = lines[index];
        if (hunkLine === "") {
          if (consumed < oldCount && produced < newCount) {
            hunkLines.push({ marker: " ", text: "" });
            consumed += 1;
            produced += 1;
            index += 1;
            continue;
          }
          throw new Error("Invalid hunk line: empty line is missing a patch marker");
        }
        if (hunkLine.startsWith("\\ No newline")) {
          const previous = hunkLines.at(-1);
          if (!previous) {
            throw new Error("Invalid hunk line: no newline marker has no preceding line");
          }
          previous.noNewline = true;
          index += 1;
          continue;
        }
        const marker = hunkLine[0];
        if (marker !== " " && marker !== "-" && marker !== "+") {
          throw new Error(`Unsupported patch line: ${hunkLine}`);
        }
        hunkLines.push({ marker, text: hunkLine.slice(1) });
        if (marker === " " || marker === "-") {
          consumed += 1;
        }
        if (marker === " " || marker === "+") {
          produced += 1;
        }
        index += 1;
      }

      hunks.push({
        oldStart: Number(header[1]),
        oldCount,
        newCount,
        lines: hunkLines
      });
    }

    patches.push({ oldPath, newPath, hunks });
  }

  return patches;
}

function applyFilePatch(original: string, hunks: Hunk[]): string {
  const originalText = splitPatchText(original);
  const output: string[] = [];
  let outputHasTrailingNewline = false;
  let cursor = 0;

  const pushOutput = (text: string, hasNewlineAfter: boolean): void => {
    output.push(text);
    outputHasTrailingNewline = hasNewlineAfter;
  };

  const pushOriginalRange = (start: number, end: number): void => {
    for (let lineIndex = start; lineIndex < end; lineIndex += 1) {
      pushOutput(originalText.lines[lineIndex], hasNewlineAfter(originalText, lineIndex));
    }
  };

  for (const hunk of hunks) {
    const startIndex = hunk.oldStart === 0 ? 0 : hunk.oldStart - 1;
    if (startIndex < cursor) {
      throw new Error(`Invalid hunk order at old line ${hunk.oldStart}`);
    }

    pushOriginalRange(cursor, startIndex);
    cursor = startIndex;

    let consumed = 0;
    let produced = 0;
    for (const line of hunk.lines) {
      if (line.marker === " ") {
        assertLine(originalText.lines[cursor], line.text);
        assertNewlineMarker(originalText, cursor, line);
        pushOutput(line.text, line.noNewline ? false : hasNewlineAfter(originalText, cursor));
        cursor += 1;
        consumed += 1;
        produced += 1;
      } else if (line.marker === "-") {
        assertLine(originalText.lines[cursor], line.text);
        assertNewlineMarker(originalText, cursor, line);
        cursor += 1;
        consumed += 1;
      } else {
        pushOutput(line.text, !line.noNewline);
        produced += 1;
      }
    }

    if (consumed !== hunk.oldCount) {
      throw new Error(`Hunk consumed ${consumed} lines, expected ${hunk.oldCount}`);
    }
    if (produced !== hunk.newCount) {
      throw new Error(`Hunk produced ${produced} lines, expected ${hunk.newCount}`);
    }
  }

  pushOriginalRange(cursor, originalText.lines.length);
  return output.length === 0 ? "" : `${output.join("\n")}${outputHasTrailingNewline ? "\n" : ""}`;
}

function readExistingFile(files: Map<string, string>, path: string | null): string {
  if (!path) {
    throw new Error("Patch target does not exist: /dev/null");
  }
  const original = files.get(path);
  if (original === undefined) {
    throw new Error(`Patch target does not exist: ${path}`);
  }
  return original;
}

interface SplitText {
  lines: string[];
  trailingNewline: boolean;
}

function splitPatchText(text: string): SplitText {
  if (text === "") {
    return { lines: [], trailingNewline: false };
  }
  if (!text.endsWith("\n")) {
    return { lines: text.split("\n"), trailingNewline: false };
  }
  return { lines: text.slice(0, -1).split("\n"), trailingNewline: true };
}

function hasNewlineAfter(text: SplitText, lineIndex: number): boolean {
  return lineIndex < text.lines.length - 1 || text.trailingNewline;
}

function assertLine(actual: string | undefined, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Patch context mismatch: expected "${expected}", got "${actual ?? "<EOF>"}"`);
  }
}

function assertNewlineMarker(original: SplitText, lineIndex: number, line: HunkLine): void {
  if (line.noNewline && hasNewlineAfter(original, lineIndex)) {
    throw new Error(`Patch newline marker mismatch at line ${lineIndex + 1}`);
  }
}

function cleanPatchPath(rawPath: string): string | null {
  const path = rawPath.trim().split(/\s+/)[0];
  if (path === "/dev/null") {
    return null;
  }
  return path.replace(/^[ab]\//, "");
}
