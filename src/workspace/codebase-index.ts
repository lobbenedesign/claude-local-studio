/**
 * Real Semantic Codebase Search (Cursor/Cline/Continue "@codebase" style)
 * ------------------------------------------------------
 * Gap reale rispetto ai competitor citati nel README (Aider/Continue/Cursor/
 * Cline): tutti offrono una ricerca "@codebase" che trova i file/funzioni
 * rilevanti per il significato della domanda, non solo per il nome del file
 * (come @file già fa altrove) o per parole chiave esatte. Riusa la stessa
 * infrastruttura di embedding reale (Ollama nomic-embed-text + fallback
 * hash deterministico) già costruita per la memoria vettoriale di AgentDB,
 * applicata ora a chunk di codice reali letti dal disco, con un indice
 * persistito e aggiornato in modo incrementale (per mtime, non ricalcola
 * tutto ad ogni richiesta).
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 6) — nessun cambio di
 * comportamento.
 */
import { join, relative } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { generateEmbedding, cosineSimilarity } from "./memory";

// ========================================================
// 🔎 REAL SEMANTIC CODEBASE SEARCH (Cursor/Cline/Continue @codebase style)
// ------------------------------------------------------
// Gap reale rispetto ai competitor citati nel README (Aider/Continue/Cursor/
// Cline): tutti offrono una ricerca "@codebase" che trova i file/funzioni
// rilevanti per il significato della domanda, non solo per il nome del file
// (come @file già fa qui) o per parole chiave esatte. Riusa la stessa
// infrastruttura di embedding reale (Ollama nomic-embed-text + fallback
// hash deterministico) già costruita per la memoria vettoriale di AgentDB,
// applicata ora a chunk di codice reali letti dal disco, con un indice
// persistito e aggiornato in modo incrementale (per mtime, non ricalcola
// tutto ad ogni richiesta).
interface CodebaseChunk {
  file: string;
  startLine: number;
  text: string;
  embedding: number[];
}
interface CodebaseIndexEntry {
  mtimeMs: number;
  chunks: CodebaseChunk[];
}
type CodebaseIndex = Record<string, CodebaseIndexEntry>;

const CODEBASE_INDEX_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "dart", "go", "java", "cpp", "cc", "cxx", "hpp", "c", "h", "md"]);
const CODEBASE_CHUNK_LINES = 40;
const CODEBASE_MAX_FILES = 150;

function getCodebaseIndexPath(workspace: string): string {
  return join(workspace, ".claude", "codebase-index.json");
}

function loadCodebaseIndex(workspace: string): CodebaseIndex {
  try {
    const p = getCodebaseIndexPath(workspace);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8"));
  } catch {}
  return {};
}

function saveCodebaseIndex(workspace: string, index: CodebaseIndex) {
  try {
    const claudeDir = join(workspace, ".claude");
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    writeFileSync(getCodebaseIndexPath(workspace), JSON.stringify(index), "utf-8");
  } catch (e) {
    console.error("[codebase-index] impossibile salvare l'indice:", e);
  }
}

function chunkFileContent(content: string): { startLine: number; text: string }[] {
  const lines = content.split("\n");
  const chunks: { startLine: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i += CODEBASE_CHUNK_LINES) {
    const slice = lines.slice(i, i + CODEBASE_CHUNK_LINES).join("\n").trim();
    if (slice.length > 0) chunks.push({ startLine: i + 1, text: slice });
  }
  return chunks;
}

// Costruisce/aggiorna l'indice reale: riusa gli embedding già calcolati per
// i file invariati (via mtimeMs), ricalcola solo quelli nuovi o modificati.
export async function buildOrUpdateCodebaseIndex(workspace: string): Promise<CodebaseChunk[]> {
  const index = loadCodebaseIndex(workspace);
  const seenFiles = new Set<string>();
  let mutated = false;
  let filesScanned = 0;

  const walk = async (dir: string, depth = 0) => {
    if (depth > 5 || filesScanned >= CODEBASE_MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (filesScanned >= CODEBASE_MAX_FILES) return;
      if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "__pycache__", "target", "whisper-models"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full, depth + 1); continue; }
      const ext = entry.name.split(".").pop()?.toLowerCase() || "";
      if (!CODEBASE_INDEX_EXTENSIONS.has(ext)) continue;

      const rel = relative(workspace, full);
      seenFiles.add(rel);
      filesScanned++;
      try {
        const stat = statSync(full);
        const existing = index[rel];
        if (existing && existing.mtimeMs === stat.mtimeMs) continue; // invariato, riusa gli embedding già calcolati

        const content = readFileSync(full, "utf-8");
        const rawChunks = chunkFileContent(content);
        const chunks: CodebaseChunk[] = [];
        for (const c of rawChunks) {
          const embedding = await generateEmbedding(c.text.slice(0, 2000));
          chunks.push({ file: rel, startLine: c.startLine, text: c.text.slice(0, 800), embedding });
        }
        index[rel] = { mtimeMs: stat.mtimeMs, chunks };
        mutated = true;
      } catch {}
    }
  };
  await walk(workspace);

  // Rimuove dall'indice i file cancellati dal disco (evita risultati fantasma)
  for (const key of Object.keys(index)) {
    if (!seenFiles.has(key)) { delete index[key]; mutated = true; }
  }

  if (mutated) saveCodebaseIndex(workspace, index);
  return Object.values(index).flatMap(e => e.chunks);
}

export async function semanticCodebaseSearch(workspace: string, query: string, topK = 5): Promise<{ file: string; startLine: number; text: string; score: number }[]> {
  const allChunks = await buildOrUpdateCodebaseIndex(workspace);
  if (allChunks.length === 0) return [];
  const queryVec = await generateEmbedding(query);
  return allChunks
    .map(c => ({ file: c.file, startLine: c.startLine, text: c.text, score: cosineSimilarity(queryVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
