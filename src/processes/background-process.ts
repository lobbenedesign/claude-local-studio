/**
 * Background Process Multiplexer (cmux / tmux style)
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 3) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 * `backgroundProcesses`/`processCounter` restano stato condiviso (letti
 * anche dal bridge Telegram e dagli endpoint /api/processes/*).
 */

export interface BackgroundProcess {
  id: string;
  name: string;
  command: string;
  cwd: string;
  status: "running" | "stopped" | "error";
  pid?: number;
  logs: string[];
  startTime?: number;
  proc?: any;
}

export const backgroundProcesses = new Map<string, BackgroundProcess>();
// Not exported as a mutable binding: ES module `let` exports are read-only
// views to importers, so `processCounter++` could not be done from
// server.ts directly. Callers get a fresh id via nextProcessId() instead.
let processCounter = 1;
export function nextProcessId(): string {
  return `proc-${processCounter++}`;
}

export function launchProcess(id: string, name: string, command: string, cwd: string, server: any): BackgroundProcess {
  const processInfo: BackgroundProcess = {
    id,
    name,
    command,
    cwd,
    status: "running",
    logs: [`[${new Date().toLocaleTimeString()}] Avvio processo: ${command}`],
    startTime: Date.now()
  };

  try {
    const isWindows = process.platform === "win32";
    const shellCmd = isWindows ? ["cmd.exe", "/c", command] : ["/bin/sh", "-c", command];

    const proc = Bun.spawn(shellCmd, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FORCE_COLOR: "1" }
    });

    processInfo.proc = proc;
    processInfo.pid = proc.pid;

    // Read stdout
    (async () => {
      if (!proc.stdout) return;
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line) {
            processInfo.logs.push(line);
            if (processInfo.logs.length > 500) processInfo.logs.shift();
            server.publish("claude-studio", JSON.stringify({ type: "process_log", id, log: line }));
          }
        }
      }
    })();

    // Read stderr
    (async () => {
      if (!proc.stderr) return;
      const reader = proc.stderr.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line) {
            processInfo.logs.push(`[stderr] ${line}`);
            if (processInfo.logs.length > 500) processInfo.logs.shift();
            server.publish("claude-studio", JSON.stringify({ type: "process_log", id, log: `[stderr] ${line}` }));
          }
        }
      }
    })();

    // Handle exit
    proc.exited.then((code: number) => {
      processInfo.status = code === 0 ? "stopped" : "error";
      processInfo.logs.push(`[${new Date().toLocaleTimeString()}] Processo terminato con codice: ${code}`);
      server.publish("claude-studio", JSON.stringify({ type: "process_exit", id, exitCode: code, status: processInfo.status }));
    });

  } catch (err: any) {
    processInfo.status = "error";
    processInfo.logs.push(`[Errore avvio]: ${err.message}`);
  }

  backgroundProcesses.set(id, processInfo);
  return processInfo;
}
