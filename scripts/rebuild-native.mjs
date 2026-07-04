import { rebuild } from "@electron/rebuild";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const require = createRequire(join(projectRoot, "package.json"));

async function main() {
  const { version: electronVersion } = require("electron/package.json");

  console.log(
    `[rebuild-native] rebuilding better-sqlite3 for Electron ${electronVersion}…`,
  );

  await rebuild({
    buildPath: projectRoot,
    electronVersion,
    force: true,
    onlyModules: ["better-sqlite3"],
  });

  console.log("[rebuild-native] done");
}

main().catch((error) => {
  console.error("[rebuild-native] failed:", error);
  console.error("[rebuild-native] run manually: node scripts/rebuild-native.mjs");
  process.exit(1);
});
