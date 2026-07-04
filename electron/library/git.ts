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

export class WorkGitSession {
  constructor(private readonly workPath: string) {}

  async createSchemeBranch(branchName: string): Promise<void> {
    await execFileAsync("git", ["checkout", "-b", branchName], {
      cwd: this.workPath,
    });
  }

  async checkout(branch: string): Promise<void> {
    await execFileAsync("git", ["checkout", branch], { cwd: this.workPath });
  }

  async commit(message: string): Promise<void> {
    await execFileAsync("git", ["add", "-A"], { cwd: this.workPath });
    await execFileAsync("git", ["commit", "-m", message], {
      cwd: this.workPath,
    });
  }

  async merge(branch: string): Promise<void> {
    await execFileAsync("git", ["checkout", "main"], {
      cwd: this.workPath,
    }).catch(() =>
      execFileAsync("git", ["checkout", "master"], { cwd: this.workPath }),
    );
    await execFileAsync("git", ["merge", branch, "--no-edit"], {
      cwd: this.workPath,
    });
  }

  async resetHard(ref = "HEAD"): Promise<void> {
    await execFileAsync("git", ["reset", "--hard", ref], {
      cwd: this.workPath,
    });
  }

  async diff(ref?: string): Promise<string> {
    const args = ref ? ["diff", ref] : ["diff"];
    const { stdout } = await execFileAsync("git", args, {
      cwd: this.workPath,
    });
    return stdout;
  }

  async statusPorcelain(): Promise<string> {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd: this.workPath,
    });
    return stdout.trim();
  }
}

export async function getWorkDiff(workPath: string): Promise<string> {
  const git = new WorkGitSession(workPath);
  const status = await git.statusPorcelain();
  const diff = await git.diff();
  if (!status && !diff.trim()) return "";
  return [status ? `## 变更文件\n\`\`\`\n${status}\n\`\`\`` : "", diff]
    .filter(Boolean)
    .join("\n\n");
}

export async function confirmSchemeChanges(
  workPath: string,
  message = "scheme: confirm",
): Promise<void> {
  const git = new WorkGitSession(workPath);
  await git.commit(message);
}

export async function discardSchemeChanges(workPath: string): Promise<void> {
  const git = new WorkGitSession(workPath);
  await git.resetHard();
}
