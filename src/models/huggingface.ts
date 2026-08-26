/**
 * Real Hugging Face Hub Search
 * ------------------------------------------------------
 * Ollama can pull GGUF weights directly from Hugging Face
 * (`ollama pull hf.co/<repo>:<QUANT_TAG>`), and the existing pull endpoint
 * already forwards whatever name it's given to Ollama unchanged — so no
 * pull-side code is needed to support Hugging Face. This module is just a
 * real search against Hugging Face's own public API
 * (huggingface.co/api/models), not a curated/fabricated list, plus a real
 * per-repo file listing so the caller can offer an actual quantization
 * instead of guessing a filename.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 4) — nessun cambio di
 * comportamento. Stessa logica del modulo gemello in nexus-local-engine
 * (i due progetti non condividono ancora un package comune).
 */

export interface HfSearchResult {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
}

export interface HfGgufFile {
  filename: string;
  quantTag: string;
}

export async function searchHfModels(query: string, limit = 20): Promise<HfSearchResult[]> {
  const res = await fetch(
    `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&direction=-1&limit=${limit}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Hugging Face API returned HTTP ${res.status}`);
  const data: any = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({
    id: m.id,
    author: m.author || m.id.split("/")[0],
    downloads: m.downloads || 0,
    likes: m.likes || 0,
    tags: m.tags || []
  }));
}

/**
 * Real file listing for one repo. Multi-part sharded GGUFs (e.g.
 * "...-00001-of-00004.gguf") are excluded: Ollama's tag-based
 * `hf.co/<repo>:<TAG>` pull matches a single file by quant label and
 * doesn't reassemble shards, so offering them would silently fail.
 */
export async function listHfGgufFiles(repoId: string): Promise<HfGgufFile[]> {
  const res = await fetch(`https://huggingface.co/api/models/${repoId}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Hugging Face API returned HTTP ${res.status}`);
  const data: any = await res.json();
  const siblings: any[] = Array.isArray(data.siblings) ? data.siblings : [];
  return siblings
    .map((s: any) => s.rfilename as string)
    .filter((name: string) => name.endsWith(".gguf") && !/-\d{5}-of-\d{5}\.gguf$/i.test(name))
    .map((name: string) => {
      // The quant label is the last hyphen-separated segment (it can itself
      // contain underscores, e.g. "Q4_K_M") — splitting on underscores/dots
      // too would cut "Q4_K_M" down to just "M".
      const base = name.replace(/\.gguf$/i, "");
      const quant = base.split("-").pop() || base;
      return { filename: name, quantTag: quant.toUpperCase() };
    });
}
