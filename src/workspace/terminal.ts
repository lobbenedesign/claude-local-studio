/**
 * Terminal command execution helper for /api/workspace/terminal/exec.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 5) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 *
 * Nota di sicurezza (vedi ROADMAP.md, Fase 2): esegue shell arbitraria nel
 * workspace, oggi senza alcuna autenticazione a monte — va protetto quando
 * si implementa l'auth locale.
 */

export interface TerminalExecResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function execTerminalCommand(command: string, workspace: string): Promise<TerminalExecResult> {
  const startedAt = Date.now();
  const proc = Bun.spawn(["bash", "-c", command], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
  const [outStr, errStr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ]);
  const exitCode = await proc.exited;

  return {
    command,
    exitCode,
    stdout: outStr.slice(0, 20000),
    stderr: errStr.slice(0, 20000),
    durationMs: Date.now() - startedAt
  };
}
