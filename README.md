# ⚡ Claude Local Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Universal LLMs](https://img.shields.io/badge/LLMs-20%2B%20Providers-orange.svg)](#-universal-model-support)

> **The universal, privacy-first Web Studio & Dev Server for Claude Code, Multi-Agent Swarms (Ruflo), AST Repo Maps (Aider), Visual Architecture Diagrams (MetaGPT), and 20+ Local & Cloud AI Providers.**

![Claude Studio Dashboard](./public/screenshot.jpg)

---

## 🌟 Key Features & Competitive Advantages

### 1. 🤖 100% Universal Model Support (Zero Token Costs & Complete Privacy)
* **Local Offline**: Native support for **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile**, and **AirLLM** (run 70B models on 4GB VRAM via NVMe layer streaming).
* **Ultra-Fast Cloud Free Tiers**: Built-in support for **Cerebras (1,800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k context)**, **Google Gemini 2.5 Pro (1M-2M context)**, **DeepSeek V3 / R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity Sonar**, and **OpenRouter**.

### 2. 🐝 Multi-Agent Swarm Loop (Ruflo / Ralph Loop)
* Autonomous 3-stage consensus pipeline: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer** with a triple-judge consensus engine and persistent decision caching in `AgentDB`.

### 3. 🗺️ AST Repo Map & Context Mentions (Aider & Continue style)
* Instant Tree-Sitter syntactic extraction of exported functions, classes, interfaces, and types (TypeScript, Python, Rust, Dart/Flutter, Go, C++) with `< 10%` token overhead.
* Support for contextual prompt mentions: `@file:<path>`, `@git`, `@diff`.

### 4. 🎨 Visual Architecture Diagrams & PRD Engine (MetaGPT / Mermaid.js)
* Live rendering of interactive color diagrams (flowcharts, sequence diagrams, class models, ER graphs) directly in the console with `/diagram`.
* Generates structured Product Requirement Documents (PRDs) with `/prd`.

### 5. 🎙️ Hands-Free Voice-to-Code (Whisper / Speech Engine)
* Real-time multi-language voice dictation directly into the prompt box with speech recognition.

### 6. 🧠 3-Tier Hierarchical Memory (Letta / MemGPT Engine)
* **Tier 1 (Working Scratchpad)**: immediate task status and focus.
* **Tier 2 (Episodic Memories)**: recent session actions, decisions, and command outputs.
* **Tier 3 (Archival Base)**: persistent architectural conventions and developer preferences.

### 7. ⚡ Background Dev Server Multiplexer (`cmux`)
* Run and monitor multiple background dev processes in parallel (`npm run dev`, `bun server.ts`, `python app.py`, `airllm`, `exo`) with real-time log streaming.

### 8. 📱 Mobile Remote Bridge (Telegram Bot)
* Control your coding workspace remotely from your smartphone using a secure, firewall-bypassing Telegram long-polling bot.

---

## 🚀 The 17 Specialized Slash Commands

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

---

## 🛠️ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/lobbenedesign/claude-local-studio.git
cd claude-local-studio

# 2. Install dependencies
bun install  # or npm install

# 3. Start the server
bun server.ts
```

Open your browser at **`http://localhost:3001`**.

---

## 📄 License
Released under the [MIT License](LICENSE).
