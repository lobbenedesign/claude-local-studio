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
9. [x] `src/config/app-config.ts` — `AppConfig`, `loadConfig`, `saveConfig`
       estratti (trasloco puro, verificato che il file `.config/settings.json`
       reale si legge/scrive ancora correttamente dopo il fix del path).
       **Deciso di non fare**: consolidare le ~20 `let xxxApiKey` in un
       oggetto unico. Con `server.ts` già sceso sotto le 1.600 righe, quel
       refactor toccherebbe ogni punto di lettura in tutto il file (incluse
       le shorthand `{ activeModel, ... }` già create negli step 7-8) per un
       beneficio ormai puramente estetico — il rapporto rischio/valore non
       lo giustifica più. Le variabili restano dichiarate in un blocco
       contiguo e ben leggibile in cima a `server.ts`.
10. [x] **Deciso di non fare** `src/routes/index.ts`. Il resto di `server.ts`
        (bridge Telegram, folder picker nativo, tabella delle route, bootstrap
        `Bun.serve`) usa tutti gli stessi ~25 pezzi di stato globale; spostarlo
        in un file separato sposterebbe l'accoppiamento senza ridurlo (o
        richiederebbe passare ~25 parametri/callback attraverso il confine).
        `server.ts` a 1.521 righe, quasi tutto tabella di route che delega a
        moduli già estratti, è una dimensione ragionevole per un entrypoint.

`currentAgentProcess` (variabile globale per "stop agent") confermato
codice morto — nessuno dei 4 flussi agentici lo assegnava mai. Rimosso
insieme all'estrazione dello step 8, invece di trascinarlo oltre.

**Fase 1 chiusa**: `server.ts` 4.721 → 1.521 righe (-68%), 20 moduli in
`src/`. Gli step 9-10 sono stati chiusi con una decisione esplicita di NON
fare il refactor pianificato quando il rischio/costo ha smesso di valerne la
pena, invece di eseguirlo comunque solo per spuntare la checklist.

## Fase 2 — Sicurezza da prodotto reale

- [x] Autenticazione locale (`src/config/auth.ts`): token casuale generato al
      primo avvio e salvato in `.config/auth-token` (mai in git). Verificato
      in browser: richiesta senza token → 401; `?token=...` sulla pagina
      principale → redirect 302 + cookie `HttpOnly`/`SameSite=Lax` fissato;
      ricarica successiva senza query param → funziona (cookie); upgrade
      WebSocket passa correttamente attraverso lo stesso gate
      (`socket.readyState === 1` confermato). Le API accettano anche
      l'header `X-Studio-Token` per script/automazioni. L'unica chiamata di
      rete reale del server verso se stesso (il bridge Telegram, non le
      chiamate a `handleAnthropicProxy` di `agent/*.ts` che sono function-call
      dirette e non passano dall'HTTP) ora include l'header con il token.
- [x] `POST /api/workspace/terminal/exec` — già coperto dal gate di
      autenticazione globale sopra, nessun lavoro aggiuntivo necessario.
- [x] Permessi file `600` su `.config/settings.json` e `.config/auth-token`
      (le chiavi API/il token restano in chiaro sul disco, ma leggibili solo
      dal proprietario). Con self-heal: il chmod scatta anche leggendo un
      file creato prima di questo hardening, non solo alla sua creazione —
      verificato che un file preesistente a `644` torni a `600` al riavvio.
      Cifratura non implementata: richiederebbe una passphrase o una chiave
      derivata dalla macchina, con reale beneficio solo contro un attacco
      che ha già accesso in lettura al filesystem — a quel punto il
      problema è un altro. `chmod` è un no-op innocuo su Windows (dove le
      ACL NTFS, non i permessi POSIX, governano l'accesso).
- [ ] **Deciso di rimandare**: CORS resta `Access-Control-Allow-Origin: *`
      ovunque. Motivo: `CORS *` decide solo se una pagina di un'altra origine
      può *leggere* la risposta — non impedisce l'invio della richiesta. La
      protezione reale contro un attacco cross-site (un'altra pagina che fa
      una `fetch`/POST verso questo server usando il cookie della vittima) è
      già data dal cookie `SameSite=Lax` appena introdotto: i browser non lo
      allegano a richieste cross-site che non siano una navigazione GET di
      primo livello. Restringere `*` a un allowlist di origin adesso
      toccherebbe centinaia di `Response` sparse in tutto il file per un
      guadagno di sicurezza marginale rispetto a quanto già ottenuto — da
      rivalutare se in futuro l'app dovesse essere esposta oltre localhost.

## Fase 3 — UX per utenti non tecnici

- [x] Onboarding alla prima apertura: banner in cima alla UI (visibile su
      tutte le tab) se Ollama è offline/senza modelli installati e nessuna
      chiave API cloud è configurata — spiega cosa fare (installare Ollama +
      link, o aggiungere una chiave gratuita) invece di lasciare le singole
      feature fallire in modo criptico. Verificato in browser reale:
      compare/scompare correttamente in base allo stato reale di
      `ollamaOnline`/`apiKeysStatus`, il pulsante "Ho capito" lo nasconde e
      lo ricorda per la sessione (`sessionStorage`).
- [x] Un vero launcher: **scoperto e corretto un regressione reale**
      introdotta dalla Fase 2 — `start-macos.command`/`start-windows.bat`
      aprivano il browser su `http://localhost:3001` senza il token, che ora
      risponde 401. Corretti entrambi per aspettare la creazione del file
      `.config/auth-token` e aprire l'URL con `?token=...` già incluso.
      Verificato end-to-end lo script macOS (token letto correttamente,
      URL costruito identico a quello stampato in console).
- [ ] **Deciso di rimandare**: gestione errori uniforme (oggi molti endpoint
      fanno `catch {}` silenzioso). Troppo diffuso e disomogeneo per un
      intervento mirato di valore in questa sessione — molti `catch {}` sono
      deliberatamente "best effort" (probe di motori opzionali, cache) e non
      andrebbero resi tutti rumorosi allo stesso modo. Da affrontare caso per
      caso quando si tocca quel codice per altri motivi, non come sweep
      generico.

## Fase 4 — Packaging da app installabile

- [x] **Tauri vs Electron: deciso di non usare nessuno dei due.** Entrambi
      richiederebbero incorporare un intero webview/Chromium solo per
      mostrare un'interfaccia che oggi è già servita perfettamente da
      `Bun.serve` e aperta nel browser di sistema dell'utente — un costo di
      toolchain (Rust+Xcode per Tauri, Node+Electron ~150MB per Electron)
      senza un beneficio reale, dato che l'app non ha bisogno di API native
      desktop (menu, tray, file system dialog nativi) che solo un
      wrapper webview darebbe. Scelto invece **`bun build --compile`**
      (nativo dello stesso runtime già in uso): produce un eseguibile Bun
      standalone da ~70MB che include l'intero server compilato, impacchettato
      in un vero bundle `.app` che apre il browser di default dell'utente —
      stesso risultato per l'utente finale (doppio click, nessun terminale,
      nessuna installazione di Bun/Node), con una superficie tecnica molto
      più piccola da mantenere.
- [x] Bundle del runtime Bun + assets, icona, installer `.dmg` per macOS:
      nuovo script `scripts/build-macos-app.sh` (`bun run package:macos`) che
      compila `server.ts` in un binario standalone, lo impacchetta in
      `Claude Local Studio.app` (icona `.icns` generata, `Info.plist`,
      launcher che apre il browser sull'URL già autenticato — stesso schema
      di `start-macos.command`) e genera `Claude-Local-Studio-<versione>.dmg`
      via `hdiutil`. Verificato end-to-end: eseguibile compilato lanciato
      direttamente con `STUDIO_RESOURCES_DIR` impostato come lo imposterebbe
      il launcher, token creato con permessi 600, asset statici serviti da
      `Contents/Resources/public`, tutte le rotte API rispondono, workspace
      di default punta alla home dell'utente (non dentro il bundle).

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

## Bug scoperti e corretti durante la Fase 4

- **Path resolution rotta in un binario compilato.** Tutti i calcoli tipo
  `join(import.meta.dir, "..", "..")` sparsi in `app-config.ts`, `auth.ts`,
  `whisper.ts` e `server.ts` assumevano che `import.meta.dir` fosse sempre un
  path reale su disco vicino alla root del progetto. In un eseguibile
  compilato con `bun build --compile`, `import.meta.dir` risolve invece a un
  path virtuale dentro `/$bunfs/...` — nessuno di quei file (`public/`,
  `.config/`, `whisper-models/`) esisteva davvero lì, quindi il binario
  compilato non avrebbe mai trovato i propri asset. Mai emerso prima perché
  nessuno aveva ancora provato a compilare il progetto. Corretto centralizzando
  la risoluzione in `src/config/paths.ts`: rileva se gira compilato
  (`import.meta.dir.includes("$bunfs")`) e in quel caso usa la cartella
  dell'eseguibile reale (`dirname(process.execPath)`, o `STUDIO_RESOURCES_DIR`
  se impostata dal launcher del bundle `.app`) invece di `import.meta.dir`.
  Verificato lanciando il binario compilato da solo con `STUDIO_RESOURCES_DIR`
  impostato come lo imposterebbe il launcher reale: token creato con permessi
  corretti, asset statici serviti, tutte le API rispondono.
- **Workspace di default dentro il bundle `.app`.** Una volta risolto il bug
  sopra, il primo avvio del binario compilato impostava il workspace di
  default a `resolve(PROJECT_ROOT, "..")` — che ora, in modalità compilata, è
  la cartella `Contents/` dentro il bundle `.app` stesso, non una cartella
  utile per l'utente. Un utente che avesse installato l'app e cliccato
  "Explorer" senza cambiare workspace si sarebbe trovato a sfogliare i file
  interni dell'app. Corretto in `app-config.ts`: quando `IS_COMPILED` è vero,
  il default è `homedir()` invece della cartella padre del progetto.
  Riverificato: il log di avvio del binario compilato mostra ora
  `📂 Attached Workspace: /Users/<utente>`.

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

**Fase 1 chiusa**: `server.ts` **4.721 → 1.521 righe (-68%)**, 20 moduli in
`src/`. Step 9 (`app-config.ts` estratto) e step 10 (route table lasciata in
`server.ts`) chiusi con una scelta esplicita di fermarsi quando il refactor
pianificato smetteva di valere il rischio, invece di eseguirlo comunque per
completezza formale — dettagli nelle rispettive voci sopra.

**Fase 2 chiusa** (con un item deliberatamente rimandato): autenticazione
locale via token + cookie (`src/config/auth.ts`), verificata end-to-end in
browser reale (401 senza token, redirect+cookie con token, WS attraverso il
gate); permessi `600` self-heal su `.config/settings.json` e
`.config/auth-token`; `/api/workspace/terminal/exec` già coperto dal gate
globale. CORS `*` lasciato invariato con motivazione esplicita (il cookie
`SameSite=Lax` già neutralizza il rischio pratico di CSRF via `fetch`
cross-site) — vedi dettagli sopra.

**Fase 3 chiusa** (con un item deliberatamente rimandato): banner di
onboarding quando nessun motore AI è raggiungibile, verificato in browser
reale; launcher macOS/Windows corretti per la regressione introdotta dalla
Fase 2 (aprivano un URL senza token, ora 401). Gestione errori uniforme
rimandata — troppo diffusa per un intervento mirato di valore ora.

**Fase 4 chiusa**: valutazione Tauri vs Electron risolta scegliendo nessuno
dei due (motivazione sopra), packaging fatto con `bun build --compile` +
bundle `.app` + `.dmg` (`scripts/build-macos-app.sh`). Durante la
preparazione è emerso e stato corretto un bug reale che sarebbe stato
invisibile finché nessuno avesse mai provato a impacchettare l'app (vedi
sezione bug sotto): tutti i punti che calcolavano la root del progetto con
`import.meta.dir` erano rotti in un eseguibile compilato, e il workspace di
default puntava dentro il bundle `.app` invece che nella home dell'utente.

**Hardening successivo (fuori dalle 4 fasi)**: aggiunto un controllo
esplicito di boundary nel file serving statico (`server.ts`, la rotta
catch-all che serve `public/`), che prima univa `PUBLIC_DIR` + pathname
senza validare che il risultato restasse dentro `public/`. Nota di onestà:
questo stesso controllo era stato aggiunto e descritto in
`nexus-local-engine` come "correzione di un path traversal reale,
verificato con `curl --path-as-is`" — verifica poi risultata **sbagliata**
testando lo stesso payload via TCP grezzo contro il codice pre-fix, che
rispondeva già onestamente 404: `new URL(req.url)` di Bun normalizza `..`
nel pathname lato server durante il parsing, indipendentemente da come il
client lo ha inviato sul filo, quindi non è mai stato un exploit
riproducibile con nessun payload provato. La stessa correzione è stata
applicata qui per coerenza e come difesa in profondità (non fa male, non
dipende da un dettaglio implementativo del parser URL di Bun), ma va
etichettata per quello che è: hardening precauzionale, non la chiusura di
un exploit dimostrato. Vedi il commit `dd8acae` di `nexus-local-engine` per
i dettagli della verifica.

**Affidabilità della CI (dopo una segnalazione di credibilità portfolio)**:
la cronologia pubblica di `Actions` mostrava 2 run falliti (`c8a06c6`,
`1a274f8`) con `error: Server did not become ready in time`. Indagato a
fondo invece di limitarsi ad alzare un timeout a caso, e trovate **due
cause distinte**, entrambe in `tests/smoke.test.ts`:
- Il budget di polling readiness in `beforeAll` (40 tentativi × 300ms = 12s)
  era più stretto dei ~20s di margine che un runner macOS a freddo di
  GitHub Actions può richiedere. Alzato a 100 tentativi × 300ms (30s), con
  l'hook stesso portato a 35s di timeout così non scade lui per primo.
- **Causa distinta, riprodotta anche in locale** (non quella vista in CI,
  ma la stessa famiglia di problema — timeout troppo stretto per una
  chiamata reale): il test FIM chiama davvero il modello Ollama installato
  sulla macchina di sviluppo (nessun mock), e un caricamento a freddo del
  modello può superare i 5000ms di default di `bun:test` — il test veniva
  abortito a metà, manifestandosi come `ECONNRESET` e trascinando in
  fallimento anche il test successivo. Corretto dando a quel test un
  timeout esplicito di 20s. Riverificato con 15 run consecutivi puliti in
  locale (prima: ~1 fallimento ogni 3-4 run).

Prossimo: `claude-local-studio` ha completato tutte e 4 le fasi previste
dalla roadmap. Resta da valutare se passare lo stesso trattamento a
`nexus-local-engine` (già fatto, vedi il suo ROADMAP.md), oppure riprendere
item deliberatamente rimandati (CORS, gestione errori uniforme, route
table).
