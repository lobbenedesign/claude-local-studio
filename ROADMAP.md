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
8. [x] `src/agent/ensemble.ts`, `run.ts`, `autodebug.ts`, `autonomous-loop.ts`
       — tutti e 4 i flussi agentici estratti. `agent/stop` lasciato inline
       in `server.ts` (banale). Ogni modulo verificato end-to-end con
       chiamate LLM reali: standard/`/diagram`/`/ruflo` (run.ts), un ciclo
       autodebug completo su un comando che fallisce davvero (autodebug.ts),
       e sia `read_file` che `write_file` reali su una workspace di scratch
       isolata, incluso il controllo dei confini del workspace
       (autonomous-loop.ts).
9. [ ] `src/config/app-config.ts` — le ~20 variabili globali `let xxxApiKey`
       diventano uno store centralizzato invece di variabili sciolte.
10. [ ] `src/routes/index.ts` + `server.ts` finale ridotto a poche righe.

`currentAgentProcess` (variabile globale per "stop agent") confermato
codice morto — nessuno dei 4 flussi agentici lo assegnava mai. Rimosso
insieme all'estrazione dello step 8, invece di trascinarlo oltre.

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
- Nell'estrarre `agent/run.ts`, il parametro della nuova funzione è stato
  chiamato `ctx`, ma il codice originale ha già una variabile locale
  `const ctx = analyzeProjectContext(workspace)` — il parametro veniva
  shadowato silenziosamente e `ctx.activeModel`/`ctx.keys`/`ctx.server`
  risolvevano contro l'oggetto sbagliato. Anche qui trovato da `tsc`, non da
  `bun build`. Corretto rinominando il parametro in `runCtx`.
- **Bug preesistente e più serio, non causato dal refactor**: testando
  manualmente `/ruflo` (pipeline a 3 fasi) end-to-end, la richiesta si
  interrompeva a metà della prima fase con `curl` che segnalava un
  trasferimento parziale. Il log mostrava `Bun.serve() timed out a request
  after 10 seconds` seguito da `TypeError: undefined is not an object
  (evaluating 'err.message')`: `Bun.serve()` ha un `idleTimeout` di default
  di 10s, troppo corto per una pipeline che fa 3 chiamate LLM sequenziali
  prima che l'output raggiunga il client nelle fasi più lente; Bun termina
  la connessione, e il valore con cui rigetta non è un vero `Error`, quindi
  `err.message` nel blocco `catch` esistente esplodeva a sua volta. Verificato
  che il bug esiste dal commit iniziale del progetto (`git log -S`), non
  introdotto da questa sessione. Corretto con `idleTimeout: 255` (il massimo
  consentito da Bun) nella config di `Bun.serve` in `server.ts`, più un
  controllo difensivo `err instanceof Error` nel catch di `agent/run.ts`.
  Riverificato: `/ruflo` completa tutte e 3 le fasi fino in fondo (5.899
  byte di output reale), nessun errore in log.

## Stato

Fase 0 completa (test + CI + i due bug di Fase 0).

Fase 1: **`server.ts` passato da 4.721 a 1.612 righe (-66%)**, 19 nuovi
moduli estratti in `src/` (whisper, mcp, background-process, catalogs,
huggingface, git, security-scan, terminal, files, memory, repo-map,
codebase-index, context, stats, providers/openai-compat, providers/dispatch,
agent/ensemble, agent/run, agent/autodebug, agent/autonomous-loop). Ogni step
verificato con build pulita + **type-check completo con `tsc --noEmit`**
(ha trovato due bug reali — un import mancante e uno shadowing di variabile
— che `bun build` da solo non segnalava, vedi sotto) + 4/4 smoke test +
verifica manuale via curl/browser dell'endpoint toccato — inclusi test
end-to-end reali con chiamate LLM vere (pull Hugging Face installato e poi
rimosso da Ollama, chat proxy reale con streaming SSE, diff-apply che scrive
davvero su disco, ensemble multi-provider che contatta realmente
Cerebras/Mistral/Gemini, tutte e 3 le esecuzioni principali di agent/run, un
ciclo autodebug completo su un comando che fallisce davvero, e sia
`read_file` che `write_file` reali dell'autonomous-loop su una workspace di
scratch isolata).

**Step 7 completato**: `dispatch.ts` (handleAnthropicProxy, ~20 provider) e
`openai-compat.ts` estratti — senza riscrivere la catena di `if` a registry
dichiarativo (trasloco puro, zero rischio aggiuntivo). Le ~20 chiavi API
restano `let` globali in `server.ts` (step 9 non ancora fatto): `dispatch.ts`
le riceve come parametro `ProviderApiKeys`, costruito da `server.ts` con il
nuovo helper `currentProviderKeys()`, invece di rinominare ~20 identificatori
in tutto il file.

**Step 8 completato**: tutti e 4 i flussi agentici estratti
(`ensemble.ts`, `run.ts`, `autodebug.ts`, `autonomous-loop.ts`); `agent/stop`
lasciato inline (banale). Durante la verifica è emerso e stato corretto un
bug **preesistente** (non causato dal refactor, presente dal commit iniziale
del progetto) che rendeva `/ruflo` inaffidabile — vedi sezione bug sopra.
Rimosso anche `currentAgentProcess`, confermato codice morto (mai assegnato
da nessuno dei 4 flussi).

**Fase 1 sostanzialmente completa**: restano solo step 9 (config store —
consolidare le ~20 `let xxxApiKey` sparse) e step 10 (routes finali +
`server.ts` ridotto a poche righe di bootstrap). Da qui in poi conviene
valutare se procedere con questi due step di rifinitura o passare alla Fase 2
(sicurezza). Aggiornare le checkbox qui sopra ad ogni sessione futura.
