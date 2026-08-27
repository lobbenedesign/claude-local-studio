/**
 * Smoke test end-to-end reali: avviano davvero `server.ts` su una porta di
 * test e ci fanno richieste HTTP vere, coerentemente con lo stile "niente
 * di simulato" già presente nel resto del codice — non mock, non stub.
 *
 * Coprono i path già verificati manualmente in sessioni di sviluppo
 * precedenti (catalogo modelli, ricerca Hugging Face, FIM, file workspace,
 * autenticazione locale), come rete di sicurezza prima della
 * modularizzazione (ROADMAP.md, Fase 0) e dell'hardening (Fase 2).
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const TEST_PORT = 3993;
const BASE = `http://localhost:${TEST_PORT}`;
const TOKEN_FILE = join(import.meta.dir, "..", ".config", "auth-token");
let proc: ReturnType<typeof Bun.spawn>;
let authToken = "";

function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Studio-Token", authToken);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

beforeAll(async () => {
  proc = Bun.spawn(["bun", "server.ts"], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: "ignore",
    stderr: "ignore"
  });

  // Poll until the server has written its auth token file and actually
  // answers to an authenticated request, instead of a fixed sleep.
  for (let i = 0; i < 40; i++) {
    try {
      authToken = readFileSync(TOKEN_FILE, "utf-8").trim();
      if (authToken) {
        const res = await authFetch("/api/models");
        if (res.ok) return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Server did not become ready in time");
}, 20000);

afterAll(() => {
  proc.kill();
});

describe("smoke: local auth token", () => {
  test("unauthenticated request is rejected", async () => {
    const res = await fetch(`${BASE}/api/models`);
    expect(res.status).toBe(401);
  });

  test("wrong token is rejected", async () => {
    const res = await fetch(`${BASE}/api/models`, { headers: { "X-Studio-Token": "not-the-real-token" } });
    expect(res.status).toBe(401);
  });

  test("correct token via header is accepted", async () => {
    const res = await authFetch("/api/models");
    expect(res.status).toBe(200);
  });

  test("correct token via query param on the home page sets a cookie and redirects", async () => {
    const res = await fetch(`${BASE}/?token=${authToken}`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("set-cookie") || "").toContain("studio_token=");
  });
});

describe("smoke: /api/models", () => {
  test("returns the real model catalog shape", async () => {
    const res = await authFetch("/api/models");
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
    const res = await authFetch("/api/models/huggingface/search?q=qwen2.5-coder");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(typeof data.results[0].id).toBe("string");
  });
});

describe("smoke: FIM completion", () => {
  test("returns a completion string even with no engine configured", async () => {
    const res = await authFetch("/api/completion/fim", {
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
    const res = await authFetch("/api/workspace/file?path=/definitely/not/a/real/path.txt");
    expect(res.status).toBe(404);
  });
});
