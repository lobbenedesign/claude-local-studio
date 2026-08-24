# ⚡ Claude Local Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![LLMs](https://img.shields.io/badge/LLMs-20%2B%20Providers-orange.svg)](#-universal-model-support)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The universal, privacy-first Web Studio & Dev Server for Claude Code, Multi-Agent Swarms (Ruflo), AST Repo Maps (Aider), Visual Architecture Diagrams (MetaGPT), and 20+ Local & Cloud AI Providers.**
> *L'interfaccia Web & Server di sviluppo universale per Claude Code, Swarm Multi-Agente (Ruflo), Aider, MetaGPT e 20+ Provider di Intelligenza Artificiale.*

![Claude Studio Dashboard](./public/screenshot.jpg)

---

<a name="english"></a>
## 🇬🇧 English Documentation

### 🌟 Key Features & Competitive Advantages

#### 1. 🤖 100% Universal Model Support (Zero Costs & Complete Privacy)
* **Local Offline**: Native support for **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile**, and **AirLLM** (run 70B models on 4GB VRAM via NVMe layer streaming).
* **Ultra-Fast Cloud Free Tiers**: Built-in support for **Cerebras (1,800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k context)**, **Google Gemini 2.5 Pro (1M-2M context)**, **DeepSeek V3 / R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity Sonar**, and **OpenRouter**.

#### 2. 🐝 Multi-Agent Swarm Loop (Ruflo / Ralph Loop)
* Autonomous 3-stage consensus pipeline: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer** with a triple-judge consensus engine and persistent decision caching in `AgentDB`.

#### 3. 🗺️ AST Repo Map & Context Mentions (Aider & Continue style)
* Instant Tree-Sitter syntactic extraction of exported functions, classes, interfaces, and types (TypeScript, Python, Rust, Dart/Flutter, Go, C++) with `< 10%` token overhead.
* Support for contextual prompt mentions: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Visual Architecture Diagrams & PRD Engine (MetaGPT / Mermaid.js)
* Live rendering of interactive color diagrams (flowcharts, sequence diagrams, class models, ER graphs) directly in the console with `/diagram`.
* Generates structured Product Requirement Documents (PRDs) with `/prd`.

#### 5. 🎙️ Hands-Free Voice-to-Code (Whisper / Speech Engine)
* Real-time voice dictation directly into the prompt box with speech recognition.

#### 6. 🧠 3-Tier Hierarchical Memory (Letta / MemGPT Engine)
* **Tier 1 (Working Scratchpad)**: immediate task status and focus.
* **Tier 2 (Episodic Memories)**: recent session actions, decisions, and command outputs.
* **Tier 3 (Archival Base)**: persistent architectural conventions and developer preferences.

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

#### 2. 🐝 Loop Multi-Agente Swarm (Ruflo / Ralph Loop)
* Pipeline autonoma a 3 fasi: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer** con consenso a triplo giudice e memorizzazione in `AgentDB`.

#### 3. 🗺️ AST Repo Map & Context Mentions (Aider & Continue style)
* Mappa sintattica dei simboli del progetto (TypeScript, Python, Rust, Dart, Go, C++) e menzioni nel prompt: `@file:<path>`, `@git`, `@diff`.

#### 4. 🎨 Diagrammi Architetturali & Specifiche PRD (MetaGPT / Mermaid)
* Renderizza visualmente grafi a colori direttamente nella console con `/diagram` e redige specifiche complete con `/prd`.

#### 5. 🎙️ Dettatura Vocale Hands-Free (Voice-to-Code)
* Trascrizione vocale in tempo reale in italiano e inglese direttamente nella casella del prompt.

#### 6. 🧠 Memoria Gerarchica a 3 Livelli (Letta / MemGPT Engine)
* **Working Scratchpad** (focus immediato), **Episodic Memories** (azioni recenti), **Archival Base** (regole persistenti).

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
