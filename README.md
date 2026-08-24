# ⚡ Claude Local Studio

> **L'interfaccia Web & Server di sviluppo universale per Claude Code, Swarm Multi-Agente (Ruflo), Aider, MetaGPT e 20+ Provider di Intelligenza Artificiale (Offline & Cloud Gratuito).**

![Claude Studio Dashboard](./public/screenshot.jpg)

---

## 🌟 Caratteristiche Principali

### 1. 🤖 100% Universale (Zero Costi & Privacy Totale)
* **Offline Locale**: Supporto nativo per **Ollama**, **GGUF**, **Apple MLX**, **vLLM**, **LM Studio**, **Mozilla Llamafile** e **AirLLM** (modelli da 70B su GPU da 4GB).
* **Cloud ad Altissima Velocità & Gratuito**: Supporto integrato con **Cerebras (1.800+ tok/s)**, **Groq LPU (350+ tok/s)**, **SambaNova**, **Mistral Codestral (256k)**, **Google Gemini 2.5 Pro (1M-2M token)**, **DeepSeek V3/R1**, **OpenAI (GPT-4o, o3-mini)**, **xAI Grok**, **Moonshot Kimi**, **Alibaba Qwen**, **Zhipu GLM**, **Perplexity Sonar** e **OpenRouter**.

### 2. 🐝 Loop Multi-Agente Swarm (Ruflo / Ralph Loop)
* Scomposizione autonoma a 3 fasi: **System Architect** $\rightarrow$ **Core Coder** $\rightarrow$ **Reviewer** con consenso a triplo giudice e memorizzazione delle decisioni in `AgentDB`.

### 3. 🗺️ AST Repo Map & Context Mentions (Aider & Continue style)
* Estrazione sintattica istantanea di simboli, funzioni, classi e interfacce (TypeScript, Python, Rust, Dart/Flutter, Go, C++) con consumo minimo di token.
* Supporto per menzioni contestuali nel prompt: `@file:<path>`, `@git`, `@diff`.

### 4. 🎨 Diagrammi Architetturali & Specifiche PRD (MetaGPT / Mermaid)
* Renderizza visualmente grafi di flusso, sequenze e modelli ER a colori direttamente nella console con il comando `/diagram`.
* Genera Product Requirement Document completi con `/prd`.

### 5. 🎙️ Voice-to-Code (Hands-Free Dictation)
* Dettatura vocale con trascrizione in tempo reale in italiano e inglese premendo il pulsante microfono.

### 6. 🧠 Memoria Gerarchica a 3 Livelli (Letta / MemGPT Engine)
* **Livello 1 (Working Scratchpad)**: stato immediato del task attivo.
* **Livello 2 (Episodic Memories)**: storico recente delle azioni e dei comandi.
* **Livello 3 (Archival Base)**: regole architetturali persistenti e preferenze dello sviluppatore.

### 7. ⚡ Dev Server Multiplexer (`cmux`)
* Gestione e streaming in tempo reale di molteplici processi di sviluppo in parallelo (`npm run dev`, `bun server.ts`, `python app.py`, nodi `exo` e `airllm`).

### 8. 📱 Mobile Remote Bridge (Telegram)
* Controlla il tuo workspace dal tuo smartphone tramite bot Telegram sicuro (senza dover aprire porte nel router).

---

## 🚀 Guida ai 17 Comandi Rapidi (/Slash Commands)

| Comando | Descrizione & Specializzazione |
| :--- | :--- |
| **`/swarm <task>`** | Esegue la pipeline multi-agente a 3 fasi (Ruflo) |
| **`/diagram <richiesta>`** | Genera e renderizza diagrammi architetturali visuali con Mermaid.js |
| **`/prd <feature>`** | Redige il Product Requirement Document (PRD) strutturato |
| **`/autofix`** | Loop autonomo di test ed eliminazione bug su stack trace reale |
| **`/review`** | Audit di sicurezza, bug latenti e rispetto delle convenzioni |
| **`/refactor`** | Riscrittura modulare e pulizia orientata ai principi SOLID |
| **`/test`** | Genera una suite completa di unit test e test di integrazione |
| **`/bench`** | Profiling della complessità computazionale ($O(n)$) e colli di bottiglia |
| **`/commit`** | Genera un commit semantico convenzionale analizzando `git diff` |
| **`/secscan`** | Scansiona il progetto alla ricerca di token API o chiavi private |
| **`/docker`** | Genera `Dockerfile` multi-stage di produzione e `docker-compose.yml` |
| **`/ci`** | Crea la pipeline GitHub Actions con test e build automatici |
| **`/env`** | Genera il file `.env.example` documentato |
| **`/explain`** | Spiegazione passo-passo della logica e del flusso dati |
| **`/doc`** | Creazione automatica di `README.md` e commenti JSDoc/Docstring |
| **`/clear`** | Pulisce lo schermo della console |
| **`/help`** | Mostra la guida interattiva completa |

---

## 🛠️ Installazione & Avvio

```bash
# 1. Clona il repository
git clone https://github.com/tuo-username/claude-local-studio.git
cd claude-local-studio

# 2. Installa le dipendenze
bun install  # oppure npm install

# 3. Avvia il server
bun server.ts
```

Apri il browser su **`http://localhost:3001`**.

---

## 📄 Licenza
Rilasciato sotto licenza MIT.
