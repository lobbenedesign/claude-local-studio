/**
 * Checkpoints & Rollback per il Loop Agentico Autonomo (stile Cline).
 * ------------------------------------------------------
 * Gap reale rispetto a Cline: Cline crea uno snapshot ("shadow git repo") ad
 * ogni azione dell'agente, e permette di ripristinare l'INTERO workspace a
 * un punto qualsiasi della sessione, non solo l'ultima modifica. Il nostro
 * /agentloop (src/agent/autonomous-loop.ts) mostrava già un diff reale per
 * ogni scrittura, ma non c'era alcun modo di tornare indietro: se il modello
 * scriveva 5 file e il 4° rompeva qualcosa, l'utente doveva sistemare a mano.
 *
 * Approccio: non un vero "shadow git repo" (troppo pesante per lo scopo qui
 * — il progetto dell'utente ha già il suo git, se lo usa), ma uno storico
 * reale, persistito su disco, del contenuto PRIMA di ogni write_file di una
 * run del loop. "Ripristina al checkpoint N" = per ogni file toccato da uno
 * step >= N in quella run, riportarlo al contenuto che aveva subito prima
 * del primo write a partire da N (o cancellarlo, se quel write lo aveva
 * creato ex-novo). Reale I/O su disco, nessuna simulazione.
 */
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from "fs";

export interface AgentLoopCheckpointEntry {
  step: number;
  relPath: string;
  hadExisted: boolean;
  oldContent: string;
  timestamp: string;
}

export interface AgentLoopRun {
  runId: string;
  task: string;
  workspace: string;
  startedAt: string;
  checkpoints: AgentLoopCheckpointEntry[];
}

function checkpointsDir(workspace: string): string {
  return join(workspace, ".claude", "checkpoints");
}

function runFilePath(workspace: string, runId: string): string {
  return join(checkpointsDir(workspace), `${runId}.json`);
}

export function createRun(workspace: string, runId: string, task: string): AgentLoopRun {
  return { runId, task, workspace, startedAt: new Date().toISOString(), checkpoints: [] };
}

// Registra il contenuto PRIMA di un write_file, e persiste subito su disco
// (non solo a fine loop) così un checkpoint sopravvive anche se il loop
// viene interrotto a metà (connessione chiusa, crash del processo, ecc.).
export function recordCheckpoint(run: AgentLoopRun, step: number, relPath: string, hadExisted: boolean, oldContent: string) {
  run.checkpoints.push({ step, relPath, hadExisted, oldContent, timestamp: new Date().toISOString() });
  try {
    const dir = checkpointsDir(run.workspace);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(runFilePath(run.workspace, run.runId), JSON.stringify(run, null, 2), "utf-8");
  } catch (e) {
    console.error("[checkpoints] impossibile salvare il checkpoint su disco:", e);
  }
}

export interface RunSummary {
  runId: string;
  task: string;
  startedAt: string;
  numCheckpoints: number;
  filesTouched: string[];
}

export function listRuns(workspace: string, limit = 20): RunSummary[] {
  const dir = checkpointsDir(workspace);
  if (!existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".json"));
  } catch {
    return [];
  }
  const runs: RunSummary[] = [];
  for (const f of files) {
    try {
      const run: AgentLoopRun = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      const filesTouched = [...new Set(run.checkpoints.map(c => c.relPath))];
      runs.push({ runId: run.runId, task: run.task, startedAt: run.startedAt, numCheckpoints: run.checkpoints.length, filesTouched });
    } catch {}
  }
  return runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, limit);
}

export function getRun(workspace: string, runId: string): AgentLoopRun | null {
  const p = runFilePath(workspace, runId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export interface RestoreResult {
  restoredFiles: { relPath: string; action: "restored" | "deleted" }[];
}

// Ripristina lo stato del workspace com'era subito PRIMA dello step `uptoStep`
// (cioè annulla tutte le scritture con step >= uptoStep). Per ogni file
// toccato da uno step >= uptoStep, usa il contenuto registrato al primo
// (più vecchio) checkpoint con step >= uptoStep per quel file — quello è
// esattamente il contenuto immediatamente precedente alla prima scrittura
// da annullare.
export function restoreToCheckpoint(workspace: string, runId: string, uptoStep: number): RestoreResult {
  const run = getRun(workspace, runId);
  if (!run) throw new Error(`Run ${runId} non trovata`);

  const earliestByPath = new Map<string, AgentLoopCheckpointEntry>();
  for (const cp of run.checkpoints) {
    if (cp.step < uptoStep) continue;
    const existing = earliestByPath.get(cp.relPath);
    if (!existing || cp.step < existing.step) earliestByPath.set(cp.relPath, cp);
  }

  const restoredFiles: RestoreResult["restoredFiles"] = [];
  for (const [relPath, cp] of earliestByPath) {
    const absPath = join(workspace, relPath);
    // Contenimento reale nel workspace, stessa guardia del loop agentico.
    if (!absPath.startsWith(workspace)) continue;
    try {
      if (cp.hadExisted) {
        const parentDir = dirname(absPath);
        if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
        writeFileSync(absPath, cp.oldContent, "utf-8");
        restoredFiles.push({ relPath, action: "restored" });
      } else if (existsSync(absPath)) {
        unlinkSync(absPath);
        restoredFiles.push({ relPath, action: "deleted" });
      }
    } catch (e) {
      console.error(`[checkpoints] ripristino fallito per ${relPath}:`, e);
    }
  }
  return { restoredFiles };
}
