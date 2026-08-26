# Roadmap di industrializzazione

Questo documento traccia il percorso da "prototipo monolitico funzionante" a
"prodotto organizzato professionalmente e user-friendly". Non è un lavoro da
una sessione: si avanza a fasi, ognuna verificabile e con commit separati.
Lo stato di avanzamento va aggiornato qui man mano.

## Perché questa roadmap

`server.ts` è oggi un unico file da ~4.700 righe, zero test automatizzati,
zero CI, nessuna autenticazione sulle proprie API, nessun packaging. Il
codice funziona (verificato ripetutamente con test manuali end-to-end), ma
non è organizzato né distribuibile come un prodotto vero.

## Fase 0 — Rete di sicurezza (prerequisito a tutto il resto)

Prima di spostare 4.700 righe serve un modo per accorgersi se qualcosa si
rompe, dato che oggi non esiste.

- [x] `bun test` configurato (`package.json`: script `test`, `build`)
- [x] Smoke test end-to-end reali (`tests/smoke.test.ts`) sui path già
      verificati manualmente in sessioni precedenti: catalogo modelli,
      ricerca Hugging Face, completamento FIM, lettura file workspace.
- [x] CI minima (`.github/workflows/ci.yml`): build + test ad ogni push.

Questi test sono **integrazione reale** (avviano davvero `server.ts` e
ci fanno richieste HTTP vere), coerentemente con lo stile "niente di
simulato" già presente nei commenti del codice — non mock.

## Fase 1 — Modularizzazione (comportamento invariato)

Estrazione modulo per modulo da `server.ts`, dai pezzi più isolati ai più
accoppiati. Ogni step: estrai → `bun run build` → `bun test` → verifica
manuale nel browser del path toccato → commit separato.

Ordine pianificato (per rischio crescente):

1. [x] `src/integrations/whisper.ts` — trascrizione audio (isolato, nessuna
       dipendenza da altri moduli).
2. [x] `src/integrations/mcp.ts` — catalogo/config server MCP (solo I/O su
       file di config, isolato).
3. [x] `src/processes/background-process.ts` — dev server multiplexer (cmux).
4. [x] `src/models/catalogs.ts`, `src/models/huggingface.ts` — cataloghi
       statici e ricerca/file Hugging Face. **Non ancora estratti**: il probe
       dei motori locali (lmstudio/mlx/exo/ktransformers/airllm/llamafile) e
       il pass-through pull/delete restano inline in `server.ts` — sono
       piccoli wrapper su fetch, a basso rischio, ma non ancora spostati.
5. [x] `src/workspace/git.ts`, `security-scan.ts`, `terminal.ts`. **Non
       ancora estratto**: `files.ts` (read/diff-preview/diff-apply/rules-save)
       — più corposo, prossimo step naturale.
6. [ ] `src/workspace/codebase-index.ts`, `memory.ts` — repo-map AST,
       embedding, memoria gerarchica.
7. [ ] `src/providers/` — registry.ts (sostituisce la catena di ~20 `if` con
       una tabella dichiarativa), dispatch.ts, openai-compat.ts, gemini.ts.
       È il pezzo più delicato: tocca `handleAnthropicProxy`.
8. [ ] `src/agent/` — run.ts, autodebug.ts, autonomous-loop.ts, ensemble.ts.
       Dipendono dai provider, vanno estratti per ultimi. Nota: i 4 flussi
       oggi chiamano `handleAnthropicProxy` via self-HTTP-loopback (`fetch`
       verso `localhost:${PORT}/v1/messages`), non chiamata diretta di
       funzione — da decidere se mantenere questo pattern o passare a una
       firma tipizzata diretta in fase di estrazione.
9. [ ] `src/config/app-config.ts` — le ~20 variabili globali `let xxxApiKey`
       diventano uno store centralizzato invece di variabili sciolte.
10. [ ] `src/routes/index.ts` + `server.ts` finale ridotto a poche righe
        (crea `Bun.serve`, monta le route, avvia Telegram polling).

Trovato durante la mappatura: `currentAgentProcess` (variabile globale per
"stop agent") non è mai assegnato da nessuno dei 4 flussi agentici attuali —
probabile codice morto, da verificare/rimuovere durante lo step 8 invece di
trascinarlo nel refactor.

## Fase 2 — Sicurezza da prodotto reale

- [ ] Autenticazione locale: token generato al primo avvio, richiesto in
      header per tutte le route (asset statici esclusi).
- [ ] CORS ristretto a origin noti invece di `Access-Control-Allow-Origin: *`
      ovunque.
- [ ] Le chiavi API salvate in `.config/settings.json` vanno quantomeno
      protette con permessi file `600`; valutare cifratura leggera.
- [ ] `POST /api/workspace/terminal/exec` (esecuzione shell arbitraria) va
      dietro la stessa autenticazione — oggi è raggiungibile da chiunque
      possa contattare la porta.

## Fase 3 — UX per utenti non tecnici

- [ ] Onboarding alla prima apertura: rilevare motori offline (Ollama non
      installato, nessuna chiave API) e spiegare cosa fare, non un errore
      criptico.
- [ ] Gestione errori uniforme: oggi molti endpoint fanno `catch {}` silenzioso.
- [ ] Un vero launcher al posto di "apri il terminale e lancia `bun server.ts`".

## Fase 4 — Packaging da app installabile

- [ ] Valutare Tauri (già usato nel progetto gemello `claude-coder-tauri`,
      stessa famiglia di progetti) rispetto a Electron.
- [ ] Bundle del runtime Bun + assets, icona, installer `.dmg` per macOS
      (piattaforma primaria dell'utente).

---

## Bug scoperti e corretti durante la Fase 0

- `PORT` era hardcoded a `3001` (non leggeva `process.env.PORT`), a
  differenza del progetto gemello `nexus-local-engine`. Impossibile far
  girare due istanze o testare su una porta diversa senza modificare il
  codice. Corretto in `server.ts`.
- Il bridge Telegram richiamava se stesso via loopback HTTP su
  `http://localhost:3001/v1/messages` **hardcoded**, invece di usare la
  costante `PORT` — sarebbe silenziosamente rimasto rotto se qualcuno
  avesse cambiato porta dopo il fix sopra. Corretto.

## Stato

Fase 0 completa (test + CI + i due bug di cui sopra).

Fase 1: **`server.ts` passato da 4.721 a 3.832 righe (-19%)**, 8 nuovi
moduli estratti (whisper, mcp, background-process, catalogs, huggingface,
git, security-scan, terminal). Ogni step verificato con build pulita, 4/4
smoke test verdi, e verifica manuale via curl dell'endpoint toccato
(`/api/mcp/servers`, `/api/processes/*`, `/api/workspace/git/status`,
`/api/workspace/security/scan`, `/api/workspace/terminal/exec`) — stesso
output di prima dell'estrazione in ogni caso.

Restano da estrarre (in ordine di rischio crescente): il probe motori
locali + pull/delete pass-through in `src/models/`, `src/workspace/files.ts`,
`codebase-index.ts`/`memory.ts`, poi il pezzo più delicato —
`src/providers/` (tocca `handleAnthropicProxy`) e `src/agent/` (dipende dai
provider, usa self-HTTP-loopback verso `handleAnthropicProxy` — vedi nota
sopra allo step 8). Aggiornare le checkbox qui sopra ad ogni sessione futura.
