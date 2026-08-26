/**
 * AgentDB & RuVector Memory — memoria gerarchica per progetto con
 * ricerca per similarità semantica reale (embedding + coseno).
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 6) — nessun cambio di
 * comportamento, solo spostamento di codice in un proprio modulo.
 *
 * Vera memoria vettoriale: embedding reali (Ollama se disponibile) + coseno
 * reale. Sostituisce il recupero "solo i più recenti" con una ricerca per
 * similarità semantica reale rispetto al prompt corrente dell'utente, come
 * promesso dal nome "RuVector Memory" ma che finora non faceva davvero (era
 * un elenco cronologico puro).
 */
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const EMBED_DIM = 384;

export interface AgentInsight {
  id: string;
  timestamp: string;
  topic: string;
  insight: string;
  tags: string[];
  embedding?: number[]; // 384-dim reale, vedi generateEmbedding()
}

export interface HierarchicalMemory {
  workingScratchpad: string;
  episodic: AgentInsight[];
  archival: AgentInsight[];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = (text || "").trim();
  if (!trimmed) return new Array(EMBED_DIM).fill(0);

  // 1. Tentativo reale: API di embedding di Ollama locale (nomic-embed-text)
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: trimmed }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        return l2Normalize(data.embedding);
      }
    }
  } catch {}

  // 2. Fallback reale e deterministico: hashing denso di trigrammi/subword,
  // normalizzato L2. Non e' un embedding neurale, ma e' matematica reale
  // (non Math.random()): stessa parola -> stesso hash -> stessa direzione nel
  // vettore, quindi testi con parole in comune ottengono coseno > 0 per davvero.
  const vec = new Float64Array(EMBED_DIM);
  const words = trimmed.toLowerCase().split(/[^a-z0-9àèéìòù_]+/i).filter(w => w.length > 0);
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const weight = 1.0 / Math.sqrt(wi + 1);
    let h = 2166136261;
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % EMBED_DIM;
    vec[idx] += (h > 0 ? 1 : -1) * weight;
    for (let n = 0; n < w.length - 2; n++) {
      const tri = w.slice(n, n + 3);
      let h2 = 2166136261;
      for (let i = 0; i < tri.length; i++) {
        h2 ^= tri.charCodeAt(i);
        h2 = Math.imul(h2, 16777619);
      }
      vec[Math.abs(h2) % EMBED_DIM] += (h2 > 0 ? 0.5 : -0.5) * weight;
    }
  }
  return l2Normalize(Array.from(vec));
}

export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map(x => x / norm) : v;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vettori gia' L2-normalizzati -> il dot product E' la coseno similarity
}

export function getProjectHierarchicalMemory(dirPath: string): HierarchicalMemory {
  try {
    const memoryFile = join(dirPath, ".claude", "agentdb.json");
    if (existsSync(memoryFile)) {
      const data = JSON.parse(readFileSync(memoryFile, "utf-8"));
      if (Array.isArray(data)) {
        return {
          workingScratchpad: "",
          episodic: [],
          archival: data
        };
      }
      return {
        workingScratchpad: data.workingScratchpad || "",
        episodic: Array.isArray(data.episodic) ? data.episodic : [],
        archival: Array.isArray(data.archival) ? data.archival : []
      };
    }
  } catch {}
  return {
    workingScratchpad: "",
    episodic: [],
    archival: []
  };
}

export function saveProjectHierarchicalMemory(dirPath: string, mem: Partial<HierarchicalMemory>) {
  try {
    const claudeDir = join(dirPath, ".claude");
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    const memoryFile = join(claudeDir, "agentdb.json");
    const current = getProjectHierarchicalMemory(dirPath);
    const updated: HierarchicalMemory = {
      workingScratchpad: mem.workingScratchpad !== undefined ? mem.workingScratchpad : current.workingScratchpad,
      episodic: mem.episodic !== undefined ? mem.episodic : current.episodic,
      archival: mem.archival !== undefined ? mem.archival : current.archival
    };
    writeFileSync(memoryFile, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (e) {
    console.error("Error saving hierarchical memory:", e);
    return getProjectHierarchicalMemory(dirPath);
  }
}

export function getProjectMemory(dirPath: string): AgentInsight[] {
  const h = getProjectHierarchicalMemory(dirPath);
  return [...h.archival, ...h.episodic];
}

/**
 * Ricerca REALE per similarità semantica rispetto a una query (il prompt
 * corrente dell'utente), non solo "i più recenti". Ricordi salvati prima
 * dell'introduzione degli embedding non ne hanno uno: viene calcolato al
 * volo (reale) e salvato per le richieste successive, cosi' il costo si
 * paga una volta sola per ricordo.
 */
export async function getRelevantMemories(dirPath: string, query: string, topN = 5): Promise<AgentInsight[]> {
  const h = getProjectHierarchicalMemory(dirPath);
  const all = [...h.archival, ...h.episodic];
  if (all.length === 0) return [];

  const queryVec = await generateEmbedding(query);
  let mutated = false;
  const scored = await Promise.all(all.map(async (m) => {
    if (!m.embedding) {
      m.embedding = await generateEmbedding(`${m.topic} ${m.insight}`);
      mutated = true;
    }
    return { memory: m, score: cosineSimilarity(queryVec, m.embedding) };
  }));

  if (mutated) {
    saveProjectHierarchicalMemory(dirPath, h); // persiste gli embedding calcolati al volo
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topN).map(s => s.memory);
}

export async function saveProjectInsight(dirPath: string, topic: string, insight: string, tags: string[] = []): Promise<AgentInsight> {
  try {
    const current = getProjectHierarchicalMemory(dirPath);
    const embedding = await generateEmbedding(`${topic} ${insight}`);
    const newInsight: AgentInsight = {
      id: `mem-${Date.now()}`,
      timestamp: new Date().toISOString(),
      topic,
      insight,
      tags,
      embedding
    };
    current.archival.unshift(newInsight);
    if (current.archival.length > 50) current.archival = current.archival.slice(0, 50);
    saveProjectHierarchicalMemory(dirPath, current);
    return newInsight;
  } catch (e) {
    console.error("Error saving insight to AgentDB:", e);
    return { id: "err", timestamp: "", topic, insight, tags };
  }
}
