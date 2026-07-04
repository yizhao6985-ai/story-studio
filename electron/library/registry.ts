import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type LibraryRegistry = {
  workPaths: string[];
};

function registryPath(): string {
  return join(app.getPath("userData"), "library.json");
}

function normalizeWorkPath(workPath: string): string {
  return resolve(workPath.trim());
}

function readRegistry(): LibraryRegistry {
  const path = registryPath();
  if (!existsSync(path)) return { workPaths: [] };

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LibraryRegistry>;
    if (!Array.isArray(parsed.workPaths)) return { workPaths: [] };

    const seen = new Set<string>();
    const workPaths: string[] = [];
    for (const item of parsed.workPaths) {
      if (typeof item !== "string" || !item.trim()) continue;
      const normalized = normalizeWorkPath(item);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      workPaths.push(normalized);
    }
    return { workPaths };
  } catch {
    return { workPaths: [] };
  }
}

function writeRegistry(registry: LibraryRegistry): void {
  writeFileSync(registryPath(), JSON.stringify(registry, null, 2), "utf-8");
}

export function listRegisteredWorks(): string[] {
  return readRegistry().workPaths;
}

export function addRegisteredWork(workPath: string): string[] {
  const normalized = normalizeWorkPath(workPath);
  const registry = readRegistry();
  if (!registry.workPaths.includes(normalized)) {
    registry.workPaths.push(normalized);
    writeRegistry(registry);
  }
  return registry.workPaths;
}

export function removeRegisteredWork(workPath: string): string[] {
  const normalized = normalizeWorkPath(workPath);
  const registry = readRegistry();
  registry.workPaths = registry.workPaths.filter((path) => path !== normalized);
  writeRegistry(registry);
  return registry.workPaths;
}
