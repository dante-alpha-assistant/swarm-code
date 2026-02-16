import { readFile } from "fs/promises";
import { join } from "path";
import { exec } from "./utils.js";

const MAX_CHARS = 8000;

const KEY_FILES = [
  "package.json",
  "tsconfig.json",
  "README.md",
];

const ENTRY_FILES = [
  "src/index.ts",
  "src/main.ts",
  "src/app.ts",
  "src/server.ts",
  "index.ts",
  "main.ts",
];

async function tryRead(path: string, maxLines?: number): Promise<string | null> {
  try {
    const content = await readFile(path, "utf-8");
    if (maxLines) {
      return content.split("\n").slice(0, maxLines).join("\n");
    }
    return content;
  } catch {
    return null;
  }
}

export async function gatherContext(repoPath: string): Promise<string> {
  const parts: string[] = [];

  // File tree
  const { stdout: tree } = await exec(
    "find",
    [".", "-type", "f",
     "-not", "-path", "*/node_modules/*",
     "-not", "-path", "*/.git/*",
     "-not", "-path", "*/dist/*",
     "-not", "-path", "*/.next/*"],
    repoPath,
  );
  parts.push("## File Tree\n" + tree.trim());

  // Key config files
  for (const f of KEY_FILES) {
    const content = await tryRead(join(repoPath, f));
    if (content) {
      parts.push(`## ${f}\n${content}`);
    }
  }

  // Entry file previews
  for (const f of ENTRY_FILES) {
    const content = await tryRead(join(repoPath, f), 100);
    if (content) {
      parts.push(`## ${f} (first 100 lines)\n${content}`);
    }
  }

  let result = parts.join("\n\n");
  if (result.length > MAX_CHARS) {
    result = result.slice(0, MAX_CHARS) + "\n...[truncated]";
  }
  return result;
}
