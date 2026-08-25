# ⚡ Claude Local Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![LLMs](https://img.shields.io/badge/LLMs-20%2B%20Providers-orange.svg)](#-universal-model-support)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The universal, privacy-first Web Studio & Dev Server for Claude Code, a sequential 3-role agent pipeline (Ruflo-style), a regex-based repo symbol map (Aider-style), Visual Architecture Diagrams (MetaGPT), and 20+ Local & Cloud AI Providers.**
> *L'interfaccia Web & Server di sviluppo universale per Claude Code, una pipeline sequenziale a 3 ruoli (stile Ruflo), una mappa dei simboli basata su regex (stile Aider), MetaGPT e 20+ Provider di Intelligenza Artificiale.*

![Claude Studio Dashboard](./public/screenshot.jpg)

---

<a name="english"></a>
## 🇬🇧 English Documentation

### 🌟 Key Features & Competitive Advantages

#### 1. 🤖 100% Universal Model Support (Zero Costs & Complete Privacy)
* **Local Offline**: Native support for **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile**, and **AirLLM** (run 70B models on 4GB VRAM via NVMe layer streaming).
* **Ultra-Fast Cloud Free Tiers**: Built-in support for **Cerebras (1,800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k context)**, **Google Gemini 2.5 Pro (1M-2M context)**, **DeepSeek V3 / R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity Sonar**, and **OpenRouter**.

#### 2. 🐝 Sequential 3-Role Agent Pipeline (Ruflo / Ralph Loop)
* `/swarm` runs 3 **sequential** calls to the same active model, each with a different role system-prompt: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer**. Each phase's output is auto-saved as a text insight in `AgentDB` (a local JSON file, see below).
* Honesty note: this is a single-model prompt-chaining pipeline, not a multi-model swarm. There is no real voting/consensus algorithm between independent models, and the "Reviewer" phase does not automatically block or grade the output — its critique is plain text you have to read yourself.

#### 3. 🗺️ Regex-Based Repo Map & Context Mentions (Aider & Continue style)
* Lightweight line-by-line **regex** extraction of exported functions, classes, interfaces, and types (TypeScript, Python, Rust, Dart/Flutter, Go, C++). This is *not* a real AST/Tree-Sitter parser — no syntax tree is built, so multi-line signatures, nested scopes, and non-trivial syntax can be missed or mis-parsed. It's a fast heuristic symbol scanner, good enough to inject useful context, not a precise structural map.
* Support for contextual prompt mentions: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Visual Architecture Diagrams & PRD Engine (MetaGPT / Mermaid.js)
* Live rendering of interactive color diagrams (flowcharts, sequence diagrams, class models, ER graphs) directly in the console with `/diagram`.
* Generates structured Product Requirement Documents (PRDs) with `/prd`.

#### 5. 🎙️ Hands-Free Voice-to-Code (Browser Web Speech API)
* Real-time voice dictation directly into the prompt box using the browser's native `SpeechRecognition` API (Chrome/Edge). No Whisper model is bundled or invoked — it relies entirely on the browser's built-in engine, so accuracy and language support depend on the browser, not on this project.

#### 6. 🧠 3-Tier Hierarchical Memory (JSON file, not a vector DB)
* **Tier 1 (Working Scratchpad)**: immediate task status and focus.
* **Tier 2 (Episodic Memories)**: recent session actions, decisions, and command outputs.
* **Tier 3 (Archival Base)**: persistent architectural conventions and developer preferences.
* Storage is a plain JSON file per project (`.claude/agentdb.json`). There is no embedding model, no vector index, and no semantic similarity search — retrieval is just "most recent N entries." Any "vector"/"semantic" wording elsewhere refers to the aspiration, not the current implementation.

#### 7. ⚡ Background Dev Server Multiplexer (`cmux`)
* Run and monitor multiple background dev processes in parallel (`npm run dev`, `bun server.ts`, `python app.py`, `airllm`, `exo`) with real-time log streaming.

#### 8. 📱 Mobile Remote Bridge (Telegram Bot)
* Control your coding workspace remotely from your smartphone using a secure, firewall-bypassing Telegram long-polling bot.

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
* `/swarm` esegue 3 chiamate **sequenziali** allo stesso modello attivo, ognuna con un system prompt di ruolo diverso: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer**. L'output di ogni fase viene salvato come insight testuale in `AgentDB` (un file JSON locale, vedi sotto).
* Nota di onestà: è una pipeline di prompt-chaining su un singolo modello, non uno swarm multi-modello. Non esiste un vero algoritmo di voto/consenso tra modelli indipendenti, e la fase "Reviewer" non blocca né vota automaticamente l'output: la sua critica è testo semplice che va letto.

#### 3. 🗺️ Repo Map Basata su Regex & Context Mentions (Aider & Continue style)
* Estrazione riga-per-riga tramite **espressioni regolari** dei simboli del progetto (TypeScript, Python, Rust, Dart, Go, C++). Non è un vero parser AST/Tree-Sitter: non viene costruito alcun albero sintattico, quindi firme multi-riga, scope annidati e sintassi non banale possono essere persi o interpretati male. È uno scanner euristico veloce, utile per iniettare contesto, non una mappa strutturale precisa.
* Menzioni nel prompt: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Diagrammi Architetturali & Specifiche PRD (MetaGPT / Mermaid)
* Renderizza visualmente grafi a colori direttamente nella console con `/diagram` e redige specifiche complete con `/prd`.

#### 5. 🎙️ Dettatura Vocale Hands-Free (Web Speech API del browser)
* Trascrizione vocale in tempo reale usando l'API nativa `SpeechRecognition` del browser (Chrome/Edge). Non è integrato alcun modello Whisper: l'accuratezza e le lingue supportate dipendono dal motore del browser, non da questo progetto.

#### 6. 🧠 Memoria Gerarchica a 3 Livelli (file JSON, non un DB vettoriale)
* **Working Scratchpad** (focus immediato), **Episodic Memories** (azioni recenti), **Archival Base** (regole persistenti).
* La memorizzazione avviene in un semplice file JSON per progetto (`.claude/agentdb.json`): nessun embedding, nessun indice vettoriale, nessuna ricerca per similarità semantica. Il recupero restituisce semplicemente le N voci più recenti.

#### 7. ⚡ Dev Server Multiplexer (`cmux`) & Controllo Mobile (Telegram)
* Gestione di processi dev paralleli in background e controllo remoto da smartphone via bot Telegram sicuro.

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
