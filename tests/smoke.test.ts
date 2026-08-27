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

// Retry una volta su un ECONNRESET/socket-reset transitorio: verificato che
// non è un readiness-timeout né un errore del server (i log del processo
// spawnato non mostrano nulla — il processo resta vivo, viene solo
// occasionalmente rifiutata/chiusa una singola connessione HTTP di test,
// riproducibile anche senza altri test di rete prima). Standard per test di
// integrazione HTTP reali: non nasconde un bug del server (che continuerebbe
// a fallire anche al retry), tollera solo il rumore di rete/connessione.
async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e: any) {
    if (e?.code === "ECONNRESET" || /socket connection was closed/i.test(String(e?.message))) {
      await new Promise((r) => setTimeout(r, 200));
      return fetch(url, init);
    }
    throw e;
  }
}

function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Studio-Token", authToken);
  return fetchWithRetry(`${BASE}${path}`, { ...init, headers });
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
  //
  // Budget alzato dopo 2 fallimenti reali in CI (GitHub Actions, runner
  // macOS): "Server did not become ready in time" — il runner a freddo
  // impiega più dei ~12s che il vecchio budget (40 tentativi × 300ms)
  // concedeva, probabilmente per via delle probe verso servizi locali
  // assenti (Ollama, ecc.) che /api/models esegue prima di rispondere.
  // 100 tentativi × 300ms = 30s di margine, con l'hook stesso portato a
  // 35s così non scade lui per primo.
  for (let i = 0; i < 100; i++) {
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
}, 35000);

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
  // Timeout esplicito più alto del default di bun:test (5000ms): questo
  // endpoint, sulla macchina di sviluppo, chiama davvero il modello Ollama
  // installato localmente (nessun mock) — un caricamento a freddo del
  // modello può superare i 5s reali e far scattare il timeout del test
  // stesso (che si manifesta come ECONNRESET quando bun:test abortisce il
  // fetch a metà), non un errore del server. Su un runner CI senza Ollama
  // installato il fallback risponde in pochi ms, quindi questo margine
  // aggiuntivo non rallenta la CI — serve solo quando l'engine è reale.
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
  }, 20000);
});

describe("smoke: workspace file read", () => {
  test("404s cleanly for a file that doesn't exist", async () => {
    const res = await authFetch("/api/workspace/file?path=/definitely/not/a/real/path.txt");
    expect(res.status).toBe(404);
  });
});

describe("smoke: static file serving boundary", () => {
  test("path traversal outside public/ is blocked even when authenticated", async () => {
    // Difesa in profondità (ROADMAP.md, Fase 4 correzione): in pratica Bun
    // normalizza già ".." dentro new URL(req.url) lato server prima che
    // url.pathname arrivi al codice applicativo — verificato via TCP grezzo
    // che anche il codice pre-hardening rispondesse onestamente 404 allo
    // stesso payload, quindi non era un exploit riproducibile. --path-as-is
    // di curl impedisce solo la normalizzazione lato client (fetch()/
    // browser la farebbero comunque), non quella che Bun applica lato
    // server. Il controllo resta come guardia esplicita, non implicita.
    const curl = Bun.spawnSync([
      "curl", "-s", "--path-as-is", "-o", "/dev/null", "-w", "%{http_code}",
      "-H", `X-Studio-Token: ${authToken}`,
      `${BASE}/../.config/settings.json`
    ]);
    const status = new TextDecoder().decode(curl.stdout).trim();
    expect(status).not.toBe("200");
  });
});
