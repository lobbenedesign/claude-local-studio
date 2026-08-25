# ⚡ Claude Local Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![LLMs](https://img.shields.io/badge/LLMs-20%2B%20Providers-orange.svg)](#-universal-model-support)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The universal, privacy-first Web Studio & Dev Server for Claude Code, a sequential 3-role agent pipeline (Ruflo-style, with a real multi-provider mode), a real multi-language AST repo symbol map (TypeScript Compiler API + tree-sitter for Python/Rust/Go/Java/C/C++, Aider-style, with regex fallback only for the rest), Visual Architecture Diagrams (MetaGPT), and 20+ Local & Cloud AI Providers.**
> *L'interfaccia Web & Server di sviluppo universale per Claude Code, una pipeline sequenziale a 3 ruoli (stile Ruflo, con una modalità multi-provider reale), una mappa dei simboli con AST reale multi-linguaggio (TypeScript Compiler API + tree-sitter per Python/Rust/Go/Java/C/C++, stile Aider, con fallback a regex solo per il resto), MetaGPT e 20+ Provider di Intelligenza Artificiale.*

![Claude Studio Dashboard](./public/screenshot.jpg)

---

<a name="english"></a>
## 🇬🇧 English Documentation

### 🌟 Key Features & Competitive Advantages

#### 1. 🤖 100% Universal Model Support (Zero Costs & Complete Privacy)
* **Local Offline**: Native support for **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile**, and **AirLLM** (run 70B models on 4GB VRAM via NVMe layer streaming).
* **Ultra-Fast Cloud Free Tiers**: Built-in support for **Cerebras (1,800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k context)**, **Google Gemini 2.5 Pro (1M-2M context)**, **DeepSeek V3 / R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity Sonar**, and **OpenRouter**.

#### 2. 🐝 Sequential 3-Role Agent Pipeline (Ruflo / Ralph Loop)
* `/swarm` (or the "Ruflo Swarm Loop" checkbox) runs 3 **sequential** calls to the same active model, each with a different role system-prompt: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer**. Each phase's output is auto-saved as a text insight in `AgentDB` (a local JSON file, see below).
* Honesty note (single-model mode): this is a single-model prompt-chaining pipeline, not a multi-model swarm. There is no real voting/consensus algorithm between independent models, and the "Reviewer" phase does not automatically block or grade the output — its critique is plain text you have to read yourself.
* **🌐 Multi-Provider Reale (real gap now closed)**: checking the "Multi-Provider Reale" box alongside Swarm mode routes the 3 roles to **actually different cloud providers** (reusing the same provider infrastructure as the Ensemble comparison below) — e.g. Architect on Groq, Coder on Cerebras, Reviewer on Mistral — instead of 3 calls to the same model. It requires at least 2 configured cloud provider API keys; with fewer than 3 it honestly discloses which role reused a provider instead of silently faking distinctness. The Reviewer phase in this mode is also asked for a strict JSON verdict block (`{"verdict": "PASS"|"FAIL", "score": 0-10, "issues": [...]}`), which the server **actually parses** and shows as a real ✅/❌ badge — if the model doesn't return valid JSON, the UI says so explicitly ("verdetto non strutturato") rather than showing a fake badge.

#### 3. 🗺️ Real Multi-Language AST Repo Map & Context Mentions (Aider & Continue style)
* For **TypeScript / JavaScript / TSX / JSX / MJS / CJS**, the repo map is built with the real **TypeScript Compiler API** (`ts.createSourceFile` + AST traversal, the same parser `tsc` itself uses) — not a text/regex scan. It correctly ignores strings, comments, and symbol-shaped text inside template literals, and extracts genuine `FunctionDeclaration`, `ClassDeclaration` (with methods/properties), `InterfaceDeclaration`, `TypeAliasDeclaration`, `EnumDeclaration`, and exported `const` arrow-function signatures straight from the parsed nodes. Each entry in the map is tagged `🌳 AST`.
* **For Python / Rust / Go / Java / C / C++** (gap closed, was previously regex-only): the repo map is now built with a real **tree-sitter** parser (`web-tree-sitter` + prebuilt WASM grammars from `tree-sitter-wasms`, loaded once at server startup), walking the genuine syntax tree per language (`function_definition`/`class_definition` for Python, `function_item`/`struct_item`/`impl_item`/`trait_item` for Rust, `function_declaration`/`method_declaration`/`type_declaration` for Go, `method_declaration`/`class_declaration`/`interface_declaration` for Java, `function_definition`/`struct_specifier`/`class_specifier` for C/C++), correctly grouping methods under their class/impl/struct. Tagged `🌳 tree-sitter AST` in the output. Verified live against real third-party source (170 real symbols from 39 real Python files in this repo's own sibling project DEEVX99-LD; 36 real symbols from 8 real Rust files in claude-coder-tauri, including nested `impl` methods).
* **Dart/Flutter** is a known, disclosed exception: its tree-sitter WASM grammar in the bundled package was compiled against a newer ABI (language version 15) than any currently available `web-tree-sitter` runtime supports (compatibility range 13–14), so loading fails at startup and Dart files honestly fall back to the regex heuristic below rather than silently breaking.
* For any language without a working grammar (currently only Dart, or any language not in the list above), the map falls back to a lightweight line-by-line **regex** heuristic scanner, explicitly tagged `🔤 regex-fallback` in the output, so it's always clear which files were structurally parsed and which were pattern-matched. Multi-line signatures, nested scopes, and non-trivial syntax can still be missed or mis-parsed in the regex-fallback files.
* Support for contextual prompt mentions: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Visual Architecture Diagrams & PRD Engine (MetaGPT / Mermaid.js)
* Live rendering of interactive color diagrams (flowcharts, sequence diagrams, class models, ER graphs) directly in the console with `/diagram`.
* Generates structured Product Requirement Documents (PRDs) with `/prd`.

#### 5. 🎙️ Hands-Free Voice-to-Code — Browser Speech API **and** real local Whisper (gap closed)
* **"Dettatura" button**: real-time voice dictation using the browser's native `SpeechRecognition` API (Chrome/Edge). No Whisper model involved here — accuracy and language support depend on the browser.
* **"Whisper Locale" button (new, genuinely real)**: records audio with the browser's `MediaRecorder`, uploads it to a new `/api/voice/transcribe` endpoint, which converts it to 16kHz mono WAV via `ffmpeg` and transcribes it with a real, locally-running **[whisper.cpp](https://github.com/ggml-org/whisper.cpp)** process (`whisper-cli`) using an actual GGML model — not a stub, not a browser API pass-through. Requires two things this repo does **not** bundle (by design, they're too large/binary for a source repo): `brew install whisper-cpp`, and a GGML model downloaded into `whisper-models/` (see setup below). If either is missing, or `ffmpeg` isn't installed, the endpoint returns a clear, actionable error instead of silently falling back to the browser engine or faking a transcript.
* **Setup** (macOS, one-time):
  ```bash
  brew install whisper-cpp ffmpeg
  mkdir -p whisper-models
  curl -L -o whisper-models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
  ```
* Verified end-to-end with real audio (a synthesized Italian sentence via macOS `say`, converted to webm/opus exactly as a browser `MediaRecorder` would produce): the full pipeline (upload → ffmpeg conversion → whisper.cpp transcription → JSON parse) correctly returned the real transcript.

#### 6. 🧠 3-Tier Hierarchical Memory (JSON file, not a vector DB)
* **Tier 1 (Working Scratchpad)**: immediate task status and focus.
* **Tier 2 (Episodic Memories)**: recent session actions, decisions, and command outputs.
* **Tier 3 (Archival Base)**: persistent architectural conventions and developer preferences.
* Storage is a plain JSON file per project (`.claude/agentdb.json`). There is no embedding model, no vector index, and no semantic similarity search — retrieval is just "most recent N entries." Any "vector"/"semantic" wording elsewhere refers to the aspiration, not the current implementation.

#### 7. ⚡ Background Dev Server Multiplexer (`cmux`)
* Run and monitor multiple background dev processes in parallel (`npm run dev`, `bun server.ts`, `python app.py`, `airllm`, `exo`) with real-time log streaming.

#### 8. 📱 Mobile Remote Bridge (Telegram Bot)
* Control your coding workspace remotely from your smartphone using a secure, firewall-bypassing Telegram long-polling bot.

#### 9. 🔀 Real Unified-Diff Preview & Apply, and a Real Multi-Provider Ensemble
* `/api/workspace/file/diff-preview` computes a genuine unified diff (Myers algorithm, via the `diff` npm package) between a file's on-disk content and LLM-proposed new content — preview-only, nothing is written. `/api/workspace/file/diff-apply` writes it for real, with an optional optimistic-concurrency check (`expectedOldContent`) so a file that changed on disk since the preview isn't silently clobbered.
* `/api/agent/ensemble` sends the same prompt to 2+ **different** configured cloud providers/models in parallel (Anthropic, OpenAI, Groq, Cerebras, Mistral, Gemini, OpenRouter) and returns each one's raw, unmodified response. Unlike the 3-role pipeline above, this is a real cross-provider comparison — no voting, no merged "consensus" answer.

### 🚀 The 17 Specialized Slash Commands

| Slash Command | Role & Specialization |
| :--- | :--- |
| **`/swarm <task>`** | Runs the autonomous 3-agent swarm pipeline (Ruflo) |
| **`/diagram <task>`** | Generates visual Mermaid.js architectural diagrams |
| **`/prd <feature>`** | Creates a comprehensive Product Requirement Document |
| **`/autofix`** | Autonomous test-and-repair loop on real stack traces |
| **`/review`** | Deep security audit, latent bug detection, and code smell analysis |
| **`/refactor`** | Clean SOLID refactoring and modular optimization |
| **`/test`** | Generates complete, isolated unit and integration test suites |
| **`/bench`** | Computational complexity ($O(n)$) and bottleneck profiling |
| **`/commit`** | Auto-generates conventional semantic Git commits from diffs |
| **`/secscan`** | Scans workspace for leaked API tokens and private keys |
| **`/docker`** | Generates multi-stage production Dockerfiles and docker-compose |
| **`/ci`** | Generates automated GitHub Actions CI/CD workflows |
| **`/env`** | Creates a fully documented `.env.example` file |
| **`/explain`** | Step-by-step logic and architectural onboarding walkthrough |
| **`/doc`** | Generates README files, API docs, and JSDoc/Docstrings |
| **`/clear`** | Clears the terminal console display |
| **`/help`** | Displays the interactive command guide |

### 🛠️ Quick Start
```bash
git clone https://github.com/lobbenedesign/claude-local-studio.git
cd claude-local-studio
bun install
bun server.ts
```
Open **`http://localhost:3001`** in your browser.

---

<a name="italiano"></a>
## 🇮🇹 Documentazione in Italiano

### 🌟 Caratteristiche Principali

#### 1. 🤖 100% Universale (Zero Costi & Privacy Totale)
* **Offline Locale**: Supporto per **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile** e **AirLLM** (modelli da 70B su GPU da 4GB via streaming NVMe).
* **Cloud Gratuito ad Altissima Velocità**: **Cerebras (1.800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k)**, **Google Gemini 2.5 Pro (1M-2M)**, **DeepSeek V3/R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity** e **OpenRouter**.

#### 2. 🐝 Pipeline Sequenziale a 3 Ruoli (Ruflo / Ralph Loop)
* `/swarm` (o la checkbox "Ruflo Swarm Loop") esegue 3 chiamate **sequenziali** allo stesso modello attivo, ognuna con un system prompt di ruolo diverso: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer**. L'output di ogni fase viene salvato come insight testuale in `AgentDB` (un file JSON locale, vedi sotto).
* Nota di onestà (modalità singolo modello): è una pipeline di prompt-chaining su un singolo modello, non uno swarm multi-modello. Non esiste un vero algoritmo di voto/consenso tra modelli indipendenti, e la fase "Reviewer" non blocca né vota automaticamente l'output: la sua critica è testo semplice che va letto.
* **🌐 Multi-Provider Reale (gap ora colmato)**: attivando la checkbox "Multi-Provider Reale" insieme a Swarm, i 3 ruoli vengono instradati verso **provider cloud realmente diversi** (riusando la stessa infrastruttura del confronto Ensemble qui sotto) — es. Architect su Groq, Coder su Cerebras, Reviewer su Mistral — invece di 3 chiamate allo stesso modello. Richiede almeno 2 chiavi API cloud configurate; con meno di 3 dichiara onestamente quale ruolo ha riusato un provider invece di fingere distinzione. In questa modalità la fase Reviewer deve inoltre restituire un blocco JSON di verdetto (`{"verdict": "PASS"|"FAIL", "score": 0-10, "issues": [...]}`) che il server **parsa realmente** e mostra come badge ✅/❌ vero — se il modello non produce JSON valido, l'interfaccia lo dichiara esplicitamente ("verdetto non strutturato") invece di mostrare un badge finto.

#### 3. 🗺️ Repo Map Multi-Linguaggio con AST Reale & Context Mentions (Aider & Continue style)
* Per **TypeScript / JavaScript / TSX / JSX / MJS / CJS** la mappa viene costruita con la vera **TypeScript Compiler API** (`ts.createSourceFile` + traversal dell'AST, lo stesso parser usato da `tsc`) — non una scansione testuale/regex. Ignora correttamente stringhe, commenti e testo simile a simboli dentro i template literal, ed estrae `FunctionDeclaration`, `ClassDeclaration` (con metodi/proprietà), `InterfaceDeclaration`, `TypeAliasDeclaration`, `EnumDeclaration` ed export `const` arrow-function reali, direttamente dai nodi parsati. Ogni voce della mappa è taggata `🌳 AST`.
* **Per Python / Rust / Go / Java / C / C++** (gap ora colmato, prima era solo regex): la mappa viene ora costruita con un vero parser **tree-sitter** (`web-tree-sitter` + grammatiche WASM precompilate da `tree-sitter-wasms`, caricate una volta all'avvio del server), attraversando l'albero sintattico reale per ciascun linguaggio (`function_definition`/`class_definition` per Python, `function_item`/`struct_item`/`impl_item`/`trait_item` per Rust, `function_declaration`/`method_declaration`/`type_declaration` per Go, `method_declaration`/`class_declaration`/`interface_declaration` per Java, `function_definition`/`struct_specifier`/`class_specifier` per C/C++), raggruppando correttamente i metodi sotto la loro classe/impl/struct. Taggata `🌳 tree-sitter AST` nell'output. Verificato dal vivo su codice reale di terze parti (170 simboli reali da 39 file Python reali del progetto gemello DEEVX99-LD; 36 simboli reali da 8 file Rust reali di claude-coder-tauri, inclusi i metodi annidati negli `impl`).
* **Dart/Flutter** è un'eccezione nota e dichiarata: la sua grammatica tree-sitter WASM nel pacchetto usato è compilata con un ABI più recente (language version 15) di quanto supportato da qualsiasi runtime `web-tree-sitter` attualmente disponibile (range di compatibilità 13-14), quindi il caricamento fallisce all'avvio e i file Dart ricadono onestamente sull'euristica regex sotto, invece di rompersi silenziosamente.
* Per qualunque linguaggio senza una grammatica funzionante (attualmente solo Dart, o linguaggi non in elenco), la mappa ricade su uno scanner euristico riga-per-riga a **espressioni regolari**, taggato esplicitamente `🔤 regex-fallback` nell'output, così è sempre chiaro quali file sono stati analizzati strutturalmente e quali solo con pattern matching. Nei file regex-fallback, firme multi-riga, scope annidati e sintassi non banale possono ancora essere persi o interpretati male.
* Menzioni nel prompt: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Diagrammi Architetturali & Specifiche PRD (MetaGPT / Mermaid)
* Renderizza visualmente grafi a colori direttamente nella console con `/diagram` e redige specifiche complete con `/prd`.

#### 5. 🎙️ Dettatura Vocale Hands-Free — Web Speech API del browser **e** Whisper locale reale (gap ora colmato)
* **Pulsante "Dettatura"**: trascrizione vocale in tempo reale usando l'API nativa `SpeechRecognition` del browser (Chrome/Edge). Qui nessun modello Whisper è coinvolto: l'accuratezza e le lingue dipendono dal browser.
* **Pulsante "Whisper Locale" (nuovo, realmente reale)**: registra l'audio con il `MediaRecorder` del browser, lo invia a un nuovo endpoint `/api/voice/transcribe`, che lo converte in WAV 16kHz mono via `ffmpeg` e lo trascrive con un processo **[whisper.cpp](https://github.com/ggml-org/whisper.cpp)** reale in esecuzione locale (`whisper-cli`) usando un vero modello GGML — non uno stub, non un passthrough dell'API del browser. Richiede due cose che questo repo non include (di proposito, sono troppo grandi/binarie per un repo sorgente): `brew install whisper-cpp`, e un modello GGML scaricato in `whisper-models/` (vedi setup sotto). Se manca l'uno o l'altro, o se manca `ffmpeg`, l'endpoint restituisce un errore chiaro e azionabile invece di ricadere silenziosamente sul motore del browser o fingere una trascrizione.
* **Setup** (macOS, una tantum):
  ```bash
  brew install whisper-cpp ffmpeg
  mkdir -p whisper-models
  curl -L -o whisper-models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
  ```
* Verificato end-to-end con audio reale (una frase italiana sintetizzata via `say` di macOS, convertita in webm/opus esattamente come farebbe un `MediaRecorder` da browser): l'intera pipeline (upload → conversione ffmpeg → trascrizione whisper.cpp → parsing JSON) ha restituito correttamente la trascrizione reale.

#### 6. 🧠 Memoria Gerarchica a 3 Livelli (file JSON + embedding vettoriali reali)
* **Working Scratchpad** (focus immediato), **Episodic Memories** (azioni recenti), **Archival Base** (regole persistenti).
* La memorizzazione avviene in un semplice file JSON per progetto (`.claude/agentdb.json`), ma ogni insight salvato ha ora un **embedding vettoriale reale a 384 dimensioni**: se Ollama espone `nomic-embed-text` viene usato quel modello (`/api/embeddings`), altrimenti si ricade su un embedding deterministico hash-based (trigram + subword) come fallback. Il recupero usato nei prompt non prende più semplicemente le N voci più recenti, ma calcola la **similarità coseno reale** tra l'embedding della richiesta corrente e quello di ogni memoria salvata, restituendo le più pertinenti anche se non le più recenti. Le memorie preesistenti senza embedding lo calcolano e lo persistono in modo lazy al primo utilizzo.

#### 7. ⚡ Dev Server Multiplexer (`cmux`) & Controllo Mobile (Telegram)
* Gestione di processi dev paralleli in background e controllo remoto da smartphone via bot Telegram sicuro.

#### 8. 🔀 Diff Unificata Reale (Preview & Apply) & Confronto Multi-Provider Reale
* `/api/workspace/file/diff-preview` calcola una vera diff unificata (algoritmo di Myers, tramite il pacchetto npm `diff`) tra il contenuto su disco di un file e il nuovo contenuto proposto dall'LLM — solo anteprima, nessuna scrittura. `/api/workspace/file/diff-apply` scrive davvero su disco, con un controllo opzionale di concorrenza ottimistica (`expectedOldContent`) per evitare di sovrascrivere in silenzio un file cambiato nel frattempo.
* `/api/agent/ensemble` invia lo stesso prompt a 2+ provider/modelli cloud **diversi** configurati in parallelo (Anthropic, OpenAI, Groq, Cerebras, Mistral, Gemini, OpenRouter) e restituisce ogni risposta grezza e non modificata. A differenza della pipeline a 3 ruoli sopra, questo è un vero confronto cross-provider: nessun voto, nessuna risposta "consenso" fusa.

### 🛠️ Avvio Rapido
```bash
git clone https://github.com/lobbenedesign/claude-local-studio.git
cd claude-local-studio
bun install
bun server.ts
```
Apri il browser su **`http://localhost:3001`**.

---

## 📄 License / Licenza
Released under the [MIT License](LICENSE).
