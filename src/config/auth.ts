/**
 * Local access token — ROADMAP.md, Fase 2.
 * ------------------------------------------------------
 * Prima di questo, il server non aveva alcuna autenticazione: chiunque
 * potesse raggiungere la porta (rete locale, container, port-forward)
 * poteva leggere/scrivere qualunque file nel workspace attaccato ed
 * eseguire shell arbitraria via /api/workspace/terminal/exec.
 *
 * Schema: un token casuale generato una sola volta e salvato in un file
 * separato da settings.json (per non finire mai in un eventuale export
 * della configurazione). Il browser lo ottiene aprendo l'URL con
 * `?token=...` (stampato in console all'avvio) una prima volta; da quel
 * momento il server lo fissa in un cookie HttpOnly, quindi le richieste
 * successive (incluso l'upgrade WebSocket) passano automaticamente senza
 * dover ripetere il token. In alternativa, qualunque chiamata API/script può
 * autenticarsi con l'header `X-Studio-Token`.
 */
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "fs";
import { CONFIG_DIR } from "./paths";

const TOKEN_FILE = join(CONFIG_DIR, "auth-token");
export const AUTH_COOKIE_NAME = "studio_token";

export function getOrCreateAuthToken(): string {
  try {
    if (existsSync(TOKEN_FILE)) {
      const existing = readFileSync(TOKEN_FILE, "utf-8").trim();
      if (existing) {
        // Self-heal i permessi anche su un file creato prima di questo
        // hardening (un chmod solo al momento della creazione non li
        // corregge retroattivamente per installazioni gia' esistenti).
        try { chmodSync(TOKEN_FILE, 0o600); } catch {}
        return existing;
      }
    }
  } catch {}

  const token = crypto.randomUUID().replace(/-/g, "");
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, token, "utf-8");
    try { chmodSync(TOKEN_FILE, 0o600); } catch {}
  } catch (e) {
    console.error("Impossibile salvare il token di accesso locale:", e);
  }
  return token;
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** true se la richiesta porta il token valido (query param, header o cookie). */
export function isRequestAuthorized(req: Request, token: string): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("token") === token) return true;
  if (req.headers.get("x-studio-token") === token) return true;
  if (readCookie(req, AUTH_COOKIE_NAME) === token) return true;
  return false;
}

/** true se l'auth di questa richiesta è arrivata via ?token= (va quindi fissata in un cookie). */
export function wasAuthorizedByQueryParam(req: Request, token: string): boolean {
  const url = new URL(req.url);
  return url.searchParams.get("token") === token;
}

export function authCookieHeader(token: string): string {
  // 30 giorni; HttpOnly (non leggibile da JS/XSS); SameSite=Lax (basta per
  // navigazione/fetch same-origin); niente Secure perché è http://localhost.
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
}
