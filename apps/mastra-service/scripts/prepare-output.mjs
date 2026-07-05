import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceRoot = join(__dirname, "..");
const desktopRoot = join(serviceRoot, "..", "desktop");
const outputDir = join(serviceRoot, ".mastra", "output");
const outputPkgPath = join(outputDir, "package.json");

const servicePkg = JSON.parse(
  readFileSync(join(serviceRoot, "package.json"), "utf8"),
);
const outputPkg = JSON.parse(readFileSync(outputPkgPath, "utf8"));
const outputDeps = Object.fromEntries(
  Object.entries(servicePkg.dependencies).filter(
    ([, version]) => !String(version).startsWith("workspace:"),
  ),
);
outputPkg.dependencies = outputDeps;
writeFileSync(outputPkgPath, `${JSON.stringify(outputPkg, null, 2)}\n`);

console.log("[prepare-output] Installing production dependencies in .mastra/output");
execFileSync("npm", ["install", "--omit=dev"], {
  cwd: outputDir,
  stdio: "inherit",
});

const desktopRequire = createRequire(join(desktopRoot, "package.json"));
const electronPath = desktopRequire("electron");
const electronPkg = JSON.parse(
  readFileSync(join(desktopRoot, "node_modules", "electron", "package.json"), "utf8"),
);

console.log(
  `[prepare-output] Rebuilding native modules for Electron ${electronPkg.version}`,
);
try {
  execFileSync(
    "npx",
    [
      "electron-rebuild",
      "-f",
      "-w",
      "better-sqlite3",
      "-p",
      electronPath,
      "-v",
      electronPkg.version,
    ],
    { cwd: outputDir, stdio: "inherit" },
  );
} catch (error) {
  console.warn(
    "[prepare-output] electron-rebuild skipped:",
    error instanceof Error ? error.message : error,
  );
}

console.log("[prepare-output] Done");
