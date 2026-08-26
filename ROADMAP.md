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
7. [x] `src/providers/openai-compat.ts` (handleOpenAICompatibleStream,
       transformSSEToAnthropic, transformNDJSONToAnthropic, authErrorResponse)
       e `src/providers/dispatch.ts` (`handleAnthropicProxy`, i ~20 blocchi
       provider cloud + motori locali). **Non riscritto** a "registry
       dichiarativo": la catena di `if` è stata spostata così com'è, non
       ristrutturata — cambiare la logica di 20 branch insieme al trasloco
       avrebbe moltiplicato il rischio senza un beneficio funzionale reale.
       Le ~20 chiavi API restano `let` globali in `server.ts` (non ancora
       consolidate, vedi step 9): `dispatch.ts` le riceve come parametro
       `ProviderApiKeys` invece di leggerle da variabili di modulo — evita la
       rinomina di ~20 identificatori in tutto il file. `server.ts` costruisce
       l'oggetto con il nuovo helper `currentProviderKeys()`.
8. [~] `src/agent/ensemble.ts` estratto (confronto reale multi-provider in
       parallelo, stesso pattern `ProviderApiKeys` di dispatch.ts). **Non
       ancora estratti**: `agent/run` (~360 righe, pipeline principale con
       swarm/ruflo/diagram/prd/review/... e streaming), `agent/autodebug`
       (~170 righe), `agent/autonomous-loop` (~200 righe), `agent/stop`
       (banale). Sono il pezzo più corposo e più usato di tutta l'app
       (streaming via TransformStream, self-HTTP-loopback verso
       `handleAnthropicProxy`, WebSocket publish) — lasciati per una sessione
       dedicata con più margine per verificare ogni singolo modo (swarm,
       ruflo, diagram, prd, review, refactor, test, doc, explain, bench,
       docker, ci, env) uno per uno dopo l'estrazione.
9. [ ] `src/config/app-config.ts` — le ~20 variabili globali `let xxxApiKey`
       diventano uno store centralizzato invece di variabili sciolte.
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
- Nell'estrarre `agent/ensemble.ts`, il tipo `EnsembleCandidate` usato in
  `server.ts` (nella pipeline swarm multi-provider) non era più importato —
  `bun build` non l'ha segnalato, ma un `tsc --noEmit` completo sì
  (`Cannot find name 'EnsembleCandidate'`). Da qui in poi il type-check
  completo è parte della verifica di ogni step, non solo `bun build`.

## Stato

Fase 0 completa (test + CI + i due bug di Fase 0).

Fase 1: **`server.ts` passato da 4.721 a 2.305 righe (-51%)**, 16 nuovi
moduli estratti in `src/` (whisper, mcp, background-process, catalogs,
huggingface, git, security-scan, terminal, files, memory, repo-map,
codebase-index, context, stats, providers/openai-compat, providers/dispatch,
agent/ensemble). Ogni step verificato con build pulita + **type-check
completo con `tsc --noEmit`** (ha trovato un import mancante reale che `bun
build` da solo non segnalava — vedi sotto) + 4/4 smoke test + verifica
manuale via curl/browser dell'endpoint toccato — inclusi test end-to-end
reali (pull Hugging Face installato e poi rimosso da Ollama, chat proxy
reale con streaming SSE, diff-apply che scrive davvero su disco, ensemble
multi-provider che contatta realmente Cerebras/Mistral/Gemini).

**Step 7 completato**: `dispatch.ts` (handleAnthropicProxy, ~20 provider) e
`openai-compat.ts` estratti — senza riscrivere la catena di `if` a registry
dichiarativo (trasloco puro, zero rischio aggiuntivo). Le ~20 chiavi API
restano `let` globali in `server.ts` (step 9 non ancora fatto): `dispatch.ts`
le riceve come parametro `ProviderApiKeys`, costruito da `server.ts` con il
nuovo helper `currentProviderKeys()`, invece di rinominare ~20 identificatori
in tutto il file.

**Step 8 parziale**: solo `agent/ensemble.ts` estratto. `agent/run` (~360
righe, pipeline principale con 13 modalità: swarm/ruflo/diagram/prd/review/
refactor/test/doc/explain/bench/docker/ci/env), `autodebug` (~170 righe),
`autonomous-loop` (~200 righe) e `stop` restano in `server.ts` — è la
pipeline più corposa e più usata dell'app (streaming via TransformStream,
self-HTTP-loopback verso `handleAnthropicProxy`, WebSocket publish),
lasciata volutamente per una sessione con più margine per verificare ogni
modalità singolarmente invece di rischiare un'estrazione affrettata sulla
feature più critica.

Step 9 (config store) e step 10 (routes finali + server.ts sottile) restano
da fare. Aggiornare le checkbox qui sopra ad ogni sessione futura.
