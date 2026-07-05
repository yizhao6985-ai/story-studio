import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function initGitRepo(workPath: string): Promise<void> {
  try {
    await access(join(workPath, ".git"), constants.F_OK);
    return;
  } catch {
    await execFileAsync("git", ["init"], { cwd: workPath });
    await execFileAsync("git", ["add", "-A"], { cwd: workPath });
    await execFileAsync("git", ["commit", "-m", "init: story workspace"], {
      cwd: workPath,
    });
  }
}
