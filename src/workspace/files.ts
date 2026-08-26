/**
 * Workspace file read/diff/write helpers for /api/workspace/file*.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 5) — nessun cambio di
 * comportamento. La chiamata a `saveProjectInsight` (memoria progetto) e il
 * `server.publish` restano nel thin route handler in server.ts, perché
 * dipendono da moduli/istanze non ancora estratti (memoria, WebSocket).
 */
import { resolve, relative, basename, dirname, join } from "path";
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import * as Diff from "diff";

export class WorkspaceBoundaryError extends Error {}
export class FileTooLargeError extends Error {}
export class DiffConflictError extends Error {}

/** Throws WorkspaceBoundaryError if filePath is not really inside workspaceRoot. */
export function assertPathInsideWorkspace(filePath: string, workspaceRoot: string): void {
  const relToWorkspace = relative(workspaceRoot, filePath);
  if (relToWorkspace.startsWith("..") || resolve(workspaceRoot, relToWorkspace) !== filePath) {
    throw new WorkspaceBoundaryError("Il file deve trovarsi dentro il workspace attaccato");
  }
}

export function readWorkspaceFile(filePath: string): { name: string; path: string; content: string } {
  const stat = statSync(filePath);
  if (stat.size > 2 * 1024 * 1024) {
    throw new FileTooLargeError("File troppo grande (>2MB)");
  }
  const content = readFileSync(filePath, "utf-8");
  return { name: basename(filePath), path: filePath, content };
}

export interface DiffPreviewResult {
  filePath: string;
  fileExists: boolean;
  unifiedDiff: string;
  linesAdded: number;
  linesRemoved: number;
  identical: boolean;
}

/** Real unified diff (Myers algorithm via the `diff` package) — preview only, no write. */
export function computeDiffPreview(filePathRaw: string, workspaceRaw: string, newContent: string): DiffPreviewResult {
  const filePath = resolve(filePathRaw);
  const workspaceRoot = resolve(workspaceRaw);
  assertPathInsideWorkspace(filePath, workspaceRoot);

  const fileExists = existsSync(filePath);
  const oldContent = fileExists ? readFileSync(filePath, "utf-8") : "";

  const unifiedDiff = Diff.createTwoFilesPatch(
    fileExists ? relative(workspaceRoot, filePath) : "/dev/null",
    relative(workspaceRoot, filePath),
    oldContent,
    newContent,
    fileExists ? "current" : "new file",
    "proposed"
  );

  const lineChanges = Diff.diffLines(oldContent, newContent);
  let added = 0, removed = 0;
  for (const part of lineChanges) {
    const n = part.value.split("\n").length - 1;
    if (part.added) added += n;
    else if (part.removed) removed += n;
  }

  return {
    filePath,
    fileExists,
    unifiedDiff,
    linesAdded: added,
    linesRemoved: removed,
    identical: oldContent === newContent
  };
}

export interface DiffApplyResult {
  filePath: string;
  workspaceRoot: string;
  bytesWritten: number;
  wasNewFile: boolean;
}

/**
 * Writes newContent to disk for real. Throws DiffConflictError if
 * expectedOldContent is given and doesn't match what's actually on disk
 * (optimistic concurrency check against edits made since the preview).
 */
export function applyFileDiff(filePathRaw: string, workspaceRaw: string, newContent: string, expectedOldContent?: string): DiffApplyResult {
  const filePath = resolve(filePathRaw);
  const workspaceRoot = resolve(workspaceRaw);
  assertPathInsideWorkspace(filePath, workspaceRoot);

  const fileExists = existsSync(filePath);
  const currentContent = fileExists ? readFileSync(filePath, "utf-8") : "";

  if (typeof expectedOldContent === "string" && expectedOldContent !== currentContent) {
    throw new DiffConflictError("Conflitto: il file è cambiato su disco dopo la preview. Rigenera la diff prima di applicare.");
  }

  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });

  writeFileSync(filePath, newContent, "utf-8");

  return {
    filePath,
    workspaceRoot,
    bytesWritten: Buffer.byteLength(newContent, "utf-8"),
    wasNewFile: !fileExists
  };
}

/** Writes project rules (.cursorrules / CLAUDE.md) into the workspace root. */
export function saveProjectRules(workspace: string, fileName: string, content: string): string {
  const filePath = join(workspace, fileName || ".cursorrules");
  writeFileSync(filePath, content || "", "utf-8");
  return filePath;
}
