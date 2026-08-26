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

1. [x] `src/integrations/whisper.ts` — trascrizione audio.
2. [x] `src/integrations/mcp.ts` — catalogo/config server MCP.
3. [x] `src/processes/background-process.ts` — dev server multiplexer (cmux).
4. [x] `src/models/catalogs.ts`, `src/models/huggingface.ts` — cataloghi
       statici e ricerca/file Hugging Face. **Non estratti** (basso rischio,
       piccoli wrapper su fetch inline): probe motori locali
       (lmstudio/mlx/exo/ktransformers/airllm/llamafile) e pass-through
       pull/delete in `GET /api/models`.
5. [x] `src/workspace/git.ts`, `security-scan.ts`, `terminal.ts`, `files.ts`
       (read/diff-preview/diff-apply/rules-save).
6. [x] `src/workspace/memory.ts` (AgentDB/RuVector), `repo-map.ts` (AST +
       tree-sitter + regex fallback), `codebase-index.ts` (ricerca semantica
       @codebase), `context.ts` (analyzeProjectContext + resolveContextMentions).
       `src/stats.ts` aggiunto come effetto collaterale necessario (vedi sotto).
7. [~] `src/providers/openai-compat.ts` estratto (handleOpenAICompatibleStream,
       transformSSEToAnthropic, transformNDJSONToAnthropic, authErrorResponse).
       **Deliberatamente non estratto**: `handleAnthropicProxy` stesso (~360
       righe, la catena if di ~20 provider cloud + motori locali) e la
       riscrittura a "registry dichiarativo" prevista in origine. Motivo:
       legge/scrive ~20 variabili globali `let xxxApiKey` mutabili (vedi step 9)
       — estrarlo bene richiede prima risolvere lo step 9, altrimenti il rischio
       di rompere silenziosamente un provider su 20 è alto e difficile da
       verificare uno per uno nel tempo disponibile. Lasciato intenzionalmente
       per una sessione dedicata.
8. [ ] `src/agent/` — run.ts, autodebug.ts, autonomous-loop.ts, ensemble.ts.
       Dipendono dai provider (self-HTTP-loopback verso `handleAnthropicProxy`,
       `fetch` verso `localhost:${PORT}/v1/messages`, non chiamata diretta di
       funzione) — da fare dopo lo step 7 completo.
9. [ ] `src/config/app-config.ts` — le ~20 variabili globali `let xxxApiKey`
       diventano uno store centralizzato. Prerequisito reale per completare lo
       step 7 a basso rischio.
10. [ ] `src/routes/index.ts` + `server.ts` finale ridotto a poche righe.

Trovato durante la mappatura: `currentAgentProcess` (variabile globale per
"stop agent") non è mai assegnato da nessuno dei 4 flussi agentici attuali —
probabile codice morto, da verificare/rimuovere durante lo step 8.

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

## Bug scoperti e corretti durante la Fase 1

- Nell'estrarre `repo-map.ts`, il path del WASM di tree-sitter usava
  `import.meta.dir` assumendo di trovarsi nella root del progetto
  (`node_modules/tree-sitter-wasms/...`). Spostando il codice in
  `src/workspace/repo-map.ts`, `import.meta.dir` punta invece a quella
  cartella, rompendo il caricamento delle grammatiche. Corretto con
  `join(import.meta.dir, "..", "..", "node_modules", ...)` e riverificato:
  il log di avvio mostra di nuovo "🌳 Tree-sitter AST reale attivo per: py,
  rs, go, java, c, cpp" e l'endpoint `/api/workspace/repo-map` produce
  output AST reale.
- Un controllo `if (!filePath)` in `/api/workspace/file/diff-preview` e
  `/diff-apply` era dead code: `resolve(body.filePath || "")` ritorna sempre
  la cwd (verità), quindi la validazione non scattava mai — un `filePath`
  mancante finiva silenziosamente a fare diff sulla cartella di lavoro
  invece di un 400 pulito. Corretto controllando `body.filePath` prima del
  resolve, in `src/workspace/files.ts`.

## Stato

Fase 0 completa (test + CI + i due bug di Fase 0).

Fase 1: **`server.ts` passato da 4.721 a 2.765 righe (-41%)**, 14 nuovi
moduli estratti in `src/` (whisper, mcp, background-process, catalogs,
huggingface, git, security-scan, terminal, files, memory, repo-map,
codebase-index, context, stats, providers/openai-compat). Ogni step
verificato con build pulita, 4/4 smoke test verdi, e verifica manuale via
curl/browser dell'endpoint toccato — inclusi test end-to-end reali (pull
Hugging Face installato e poi rimosso da Ollama, chat proxy reale con
streaming SSE, diff-apply che scrive davvero su disco con controllo dei
confini del workspace).

**Step 7 (providers) lasciato volutamente incompleto**: `handleAnthropicProxy`
resta in `server.ts` perché dipende da ~20 variabili globali mutabili
(`let xxxApiKey`) che vanno prima consolidate in un vero config store
(step 9) per poter estrarre il dispatch senza rischio. Anche `src/agent/`
(step 8) e `src/routes/` + `server.ts` finale (step 10) restano da fare,
nello stesso ordine di dipendenza. Aggiornare le checkbox qui sopra ad ogni
sessione futura.
