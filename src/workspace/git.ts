/**
 * Git Status & Smart Commit Helpers
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 5) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 */

export function getGitStatus(workspace: string) {
  try {
    const statusProc = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: workspace });
    const diffProc = Bun.spawnSync(["git", "diff", "--stat"], { cwd: workspace });
    const branchProc = Bun.spawnSync(["git", "branch", "--show-current"], { cwd: workspace });
    const output = statusProc.stdout ? new TextDecoder().decode(statusProc.stdout).trim() : "";
    const diff = diffProc.stdout ? new TextDecoder().decode(diffProc.stdout).trim() : "";
    const branch = branchProc.stdout ? new TextDecoder().decode(branchProc.stdout).trim() : "main";
    return {
      isGit: statusProc.exitCode === 0,
      branch: branch || "main",
      hasChanges: output.length > 0,
      rawStatus: output,
      diffSummary: diff,
      files: output.split("\n").filter(Boolean).map(l => l.trim())
    };
  } catch {
    return { isGit: false, branch: "", hasChanges: false, rawStatus: "", diffSummary: "", files: [] };
  }
}
