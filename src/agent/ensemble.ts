/**
 * Real Multi-Provider Ensemble (genuine side-by-side comparison)
 * ------------------------------------------------------
 * Unlike the "Ruflo Swarm" pipeline (3 sequential calls to the SAME active
 * model/provider with different role prompts), this calls 2+ DIFFERENT real
 * cloud providers/models in parallel, with the SAME prompt, and returns
 * each one's actual raw response untouched. There is no voting, no fake
 * "consensus" banner, and no merging of the outputs.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 8) — nessun cambio di
 * comportamento. Riceve le chiavi API come parametro, stesso pattern di
 * src/providers/dispatch.ts.
 */
import type { ProviderApiKeys } from "../providers/dispatch";

// ========================================================
// 🧪 REAL MULTI-PROVIDER ENSEMBLE (genuine side-by-side comparison)
// ------------------------------------------------------
// Unlike the "Ruflo Swarm" pipeline above (which is 3 sequential calls to
// the SAME active model/provider with different role prompts, and does not
// claim otherwise since the honesty audit), this calls 2+ DIFFERENT real
// cloud providers/models in parallel, with the SAME prompt, and returns
// each one's actual raw response untouched. There is no voting, no fake
// "consensus" banner, and no merging of the outputs — the user reads and
// compares the real answers themselves, the same way you'd open two
// provider playgrounds side by side.
// ========================================================

export interface EnsembleCandidate {
  provider: string;
  modelId: string;
  displayName: string;
  endpoint: string;
  apiKey: string;
  kind: "openai-compatible" | "gemini" | "anthropic";
}

export function getConfiguredEnsembleCandidates(keys: ProviderApiKeys): EnsembleCandidate[] {
  const candidates: EnsembleCandidate[] = [];

  if (keys.anthropicApiKey) {
    candidates.push({ provider: "anthropic", modelId: "claude-3-5-haiku-20241022", displayName: "Anthropic Claude 3.5 Haiku", endpoint: "https://api.anthropic.com/v1/messages", apiKey: keys.anthropicApiKey, kind: "anthropic" });
  }
  if (keys.openaiApiKey) {
    candidates.push({ provider: "openai", modelId: "gpt-4o-mini", displayName: "OpenAI GPT-4o Mini", endpoint: "https://api.openai.com/v1/chat/completions", apiKey: keys.openaiApiKey, kind: "openai-compatible" });
  }
  if (keys.groqApiKey) {
    candidates.push({ provider: "groq", modelId: "llama-3.3-70b-versatile", displayName: "Groq Llama 3.3 70B", endpoint: "https://api.groq.com/openai/v1/chat/completions", apiKey: keys.groqApiKey, kind: "openai-compatible" });
  }
  if (keys.cerebrasApiKey) {
    candidates.push({ provider: "cerebras", modelId: "llama-3.3-70b", displayName: "Cerebras Llama 3.3 70B", endpoint: "https://api.cerebras.ai/v1/chat/completions", apiKey: keys.cerebrasApiKey, kind: "openai-compatible" });
  }
  if (keys.mistralApiKey) {
    candidates.push({ provider: "mistral", modelId: "mistral-small-latest", displayName: "Mistral Small Latest", endpoint: "https://api.mistral.ai/v1/chat/completions", apiKey: keys.mistralApiKey, kind: "openai-compatible" });
  }
  if (keys.geminiApiKey) {
    candidates.push({ provider: "gemini", modelId: "gemini-2.0-flash", displayName: "Google Gemini 2.0 Flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", apiKey: keys.geminiApiKey, kind: "gemini" });
  }
  if (keys.openrouterApiKey) {
    candidates.push({ provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct:free", displayName: "OpenRouter Llama 3.3 70B (free)", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKey: keys.openrouterApiKey, kind: "openai-compatible" });
  }

  return candidates;
}

export async function callEnsembleCandidateNonStreaming(candidate: EnsembleCandidate, systemPrompt: string, userPrompt: string): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();

  if (candidate.kind === "anthropic") {
    const res = await fetch(candidate.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": candidate.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: candidate.modelId, max_tokens: 1024, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    const text = (json.content || []).map((c: any) => c.text || "").join("");
    return { text, latencyMs: Date.now() - started };
  }

  if (candidate.kind === "gemini") {
    const res = await fetch(`${candidate.endpoint}?key=${candidate.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      }),
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    return { text, latencyMs: Date.now() - started };
  }

  // openai-compatible
  const res = await fetch(candidate.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${candidate.apiKey}` },
    body: JSON.stringify({
      model: candidate.modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false
    }),
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  return { text, latencyMs: Date.now() - started };
}
