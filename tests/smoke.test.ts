/**
 * Smoke test end-to-end reali: avviano davvero `server.ts` su una porta di
 * test e ci fanno richieste HTTP vere, coerentemente con lo stile "niente
 * di simulato" già presente nel resto del codice — non mock, non stub.
 *
 * Coprono i path già verificati manualmente in sessioni di sviluppo
 * precedenti (catalogo modelli, ricerca Hugging Face, FIM, file workspace),
 * come prima rete di sicurezza prima della modularizzazione (vedi
 * ROADMAP.md, Fase 0).
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";

const TEST_PORT = 3993;
const BASE = `http://localhost:${TEST_PORT}`;
let proc: ReturnType<typeof Bun.spawn>;

beforeAll(async () => {
  proc = Bun.spawn(["bun", "server.ts"], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: "ignore",
    stderr: "ignore"
  });

  // Poll until the server actually answers, instead of a fixed sleep.
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/api/models`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Server did not become ready in time");
}, 20000);

afterAll(() => {
  proc.kill();
});

describe("smoke: /api/models", () => {
  test("returns the real model catalog shape", async () => {
    const res = await fetch(`${BASE}/api/models`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.localModels)).toBe(true);
    expect(Array.isArray(data.cerebrasModels)).toBe(true);
    expect(Array.isArray(data.hfRouterModels)).toBe(true);
    expect(typeof data.activeModel).toBe("string");
  });
});

describe("smoke: Hugging Face search", () => {
  test("returns real results from huggingface.co", async () => {
    const res = await fetch(`${BASE}/api/models/huggingface/search?q=qwen2.5-coder`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(typeof data.results[0].id).toBe("string");
  });
});

describe("smoke: FIM completion", () => {
  test("returns a completion string even with no engine configured", async () => {
    const res = await fetch(`${BASE}/api/completion/fim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "function add(a, b) {\n  ", suffix: "\n}", language: "javascript" })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.completion).toBe("string");
    expect(data.completion.length).toBeGreaterThan(0);
  });
});

describe("smoke: workspace file read", () => {
  test("404s cleanly for a file that doesn't exist", async () => {
    const res = await fetch(`${BASE}/api/workspace/file?path=/definitely/not/a/real/path.txt`);
    expect(res.status).toBe(404);
  });
});
