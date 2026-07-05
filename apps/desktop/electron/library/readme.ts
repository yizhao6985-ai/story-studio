import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { README_FILE } from "../../src/lib/story/constants.js";

interface ReadmeInfo {
  title: string | null;
  author: string | null;
  description: string | null;
  raw: string | null;
}

export async function readReadme(workPath: string): Promise<ReadmeInfo | null> {
  try {
    const raw = await readFile(join(workPath, README_FILE), "utf8");
    return { ...parseReadmeContent(raw), raw };
  } catch {
    return null;
  }
}

function parseReadmeContent(raw: string): Omit<ReadmeInfo, "raw"> {
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
  const author =
    raw.match(/^\*\*作者\*\*\s*(.+)$/m)?.[1]?.trim() ??
    raw.match(/^author:\s*(.+)$/im)?.[1]?.trim() ??
    null;

  let description: string | null = null;
  const introMatch = raw.match(/##\s*简介\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
  if (introMatch?.[1]?.trim()) {
    description = introMatch[1].trim();
  }

  return { title, author, description };
}

export async function updateReadmeTitle(
  workPath: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed) return false;

  const readmePath = join(workPath, README_FILE);
  try {
    const raw = await readFile(readmePath, "utf8");
    const updated = raw.match(/^#\s+.+$/m)
      ? raw.replace(/^#\s+.+$/m, `# ${trimmed}`)
      : `# ${trimmed}\n\n${raw}`;
    await writeFile(readmePath, updated, "utf8");
    return true;
  } catch {
    return false;
  }
}
