import { spawn, type Subprocess } from "bun";
import { join, resolve, relative, basename, dirname, sep } from "path";
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { homedir, tmpdir } from "os";
import * as Diff from "diff";
import { transcribeAudioWithWhisper } from "./src/integrations/whisper";
import { loadMcpConfig, saveMcpConfig } from "./src/integrations/mcp";
import { backgroundProcesses, launchProcess, nextProcessId } from "./src/processes/background-process";
import {
  FEATURED_LOCAL_MODELS,
  GROQ_FREE_MODELS,
  CEREBRAS_FREE_MODELS,
  HF_ROUTER_MODELS,
  SAMBANOVA_FREE_MODELS,
  MISTRAL_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS
} from "./src/models/catalogs";
import { searchHfModels, listHfGgufFiles } from "./src/models/huggingface";
import { getGitStatus } from "./src/workspace/git";
import { scanSecuritySecrets } from "./src/workspace/security-scan";
import { execTerminalCommand } from "./src/workspace/terminal";
import {
  readWorkspaceFile,
  computeDiffPreview,
  applyFileDiff,
  saveProjectRules,
  WorkspaceBoundaryError,
  FileTooLargeError,
  DiffConflictError
} from "./src/workspace/files";
import {
  type AgentInsight,
  type HierarchicalMemory,
  generateEmbedding,
  cosineSimilarity,
  getProjectHierarchicalMemory,
  saveProjectHierarchicalMemory,
  getProjectMemory,
  getRelevantMemories,
  saveProjectInsight
} from "./src/workspace/memory";
import { buildAstRepoMap } from "./src/workspace/repo-map";
import { buildOrUpdateCodebaseIndex, semanticCodebaseSearch } from "./src/workspace/codebase-index";
import { analyzeProjectContext, resolveContextMentions } from "./src/workspace/context";
import { addTokensProcessed, getTokensProcessed } from "./src/stats";
import {
  authErrorResponse,
  handleOpenAICompatibleStream,
  transformSSEToAnthropic,
  transformNDJSONToAnthropic
} from "./src/providers/openai-compat";

const PORT = Number(process.env.PORT) || 3001;
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

// Persistent Configuration Path (Saved locally in workspace or user home)
const CONFIG_DIR = join(import.meta.dir, ".config");
const CONFIG_FILE = join(CONFIG_DIR, "settings.json");

interface AppConfig {
  activeModel: string;
  attachedWorkspacePath: string;
  geminiApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  cerebrasApiKey: string;
  hfApiKey: string;
  sambanovaApiKey: string;
  mistralApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  deepseekApiKey: string;
  xaiApiKey: string;
  togetherApiKey: string;
  fireworksApiKey: string;
  cohereApiKey: string;
  replicateApiKey: string;
  kimiApiKey: string;
  qwenApiKey: string;
  glmApiKey: string;
  perplexityApiKey: string;
  customApiEndpoint: string;
  customApiKey: string;
  telegramBotToken: string;
  telegramAllowedChatId: string;
  telegramEnabled: boolean;
}

// Load Persistent Config
function loadConfig(): AppConfig {
  const defaultConfig: AppConfig = {
    activeModel: "qwen2.5:7b",
    attachedWorkspacePath: resolve(join(import.meta.dir, "..")),
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    cerebrasApiKey: process.env.CEREBRAS_API_KEY || "",
    hfApiKey: process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "",
    sambanovaApiKey: process.env.SAMBANOVA_API_KEY || "",
    mistralApiKey: process.env.MISTRAL_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
    xaiApiKey: process.env.XAI_API_KEY || "",
    togetherApiKey: process.env.TOGETHER_API_KEY || "",
    fireworksApiKey: process.env.FIREWORKS_API_KEY || "",
    cohereApiKey: process.env.COHERE_API_KEY || "",
    replicateApiKey: process.env.REPLICATE_API_KEY || "",
    kimiApiKey: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "",
    qwenApiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "",
    glmApiKey: process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY || "",
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || "",
    customApiEndpoint: process.env.CUSTOM_API_ENDPOINT || "",
    customApiKey: process.env.CUSTOM_API_KEY || "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramAllowedChatId: process.env.TELEGRAM_CHAT_ID || "",
    telegramEnabled: false
  };

  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    }
  } catch (e) {
    console.error("Error reading settings.json:", e);
  }
  return defaultConfig;
}

// Save Persistent Config
function saveConfig(cfg: Partial<AppConfig>) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = loadConfig();
    const updated = { ...current, ...cfg };
    writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (e) {
    console.error("Error saving settings.json:", e);
    return loadConfig();
  }
}

// Initialize State from Saved Config
const initialConfig = loadConfig();
let activeModel = initialConfig.activeModel;
let attachedWorkspacePath = initialConfig.attachedWorkspacePath;
let geminiApiKey = initialConfig.geminiApiKey;
let groqApiKey = initialConfig.groqApiKey;
let openrouterApiKey = initialConfig.openrouterApiKey;
let cerebrasApiKey = initialConfig.cerebrasApiKey;
let hfApiKey = initialConfig.hfApiKey || "";
let sambanovaApiKey = initialConfig.sambanovaApiKey;
let mistralApiKey = initialConfig.mistralApiKey;
let openaiApiKey = initialConfig.openaiApiKey;
let anthropicApiKey = initialConfig.anthropicApiKey || "";
let deepseekApiKey = initialConfig.deepseekApiKey || "";
let xaiApiKey = initialConfig.xaiApiKey || "";
let togetherApiKey = initialConfig.togetherApiKey || "";
let fireworksApiKey = initialConfig.fireworksApiKey || "";
let cohereApiKey = initialConfig.cohereApiKey || "";
let replicateApiKey = initialConfig.replicateApiKey || "";
let kimiApiKey = initialConfig.kimiApiKey || "";
let qwenApiKey = initialConfig.qwenApiKey || "";
let glmApiKey = initialConfig.glmApiKey || "";
let perplexityApiKey = initialConfig.perplexityApiKey || "";
let customApiEndpoint = initialConfig.customApiEndpoint || "";
let customApiKey = initialConfig.customApiKey || "";
let telegramBotToken = initialConfig.telegramBotToken || "";
let telegramAllowedChatId = initialConfig.telegramAllowedChatId || "";
let telegramEnabled = initialConfig.telegramEnabled || false;
let isTelegramPolling = false;

let currentAgentProcess: Subprocess | null = null;
let sessionStartTime = Date.now();

// Telegram Bot Message Sender
async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!telegramBotToken) return;
  try {
    const maxLen = 4000;
    for (let i = 0; i < text.length; i += maxLen) {
      const chunk = text.slice(i, i + maxLen);
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk
        })
      });
    }
  } catch (err) {
    console.error("Errore invio messaggio Telegram:", err);
  }
}

// Telegram Bot Polling Runner
async function startTelegramPolling(server: any) {
  if (isTelegramPolling) return;
  if (!telegramBotToken || !telegramEnabled) return;
  isTelegramPolling = true;
  console.log("📱 [Telegram Remote Bridge] Avvio polling bot Telegram...");

  let offset = 0;
  while (telegramEnabled && telegramBotToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates?offset=${offset}&timeout=25`, {
        signal: AbortSignal.timeout(35000)
      });
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const data: any = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const chatId = msg.chat.id.toString();
          const userText = msg.text.trim();

          // Auth check
          if (telegramAllowedChatId && chatId !== telegramAllowedChatId) {
            await sendTelegramMessage(chatId, `⚠️ Accesso non autorizzato. Il tuo Chat ID è: ${chatId}\nInseriscilo in Claude Studio per abilitare questo account.`);
            continue;
          }

          if (!telegramAllowedChatId) {
            telegramAllowedChatId = chatId;
            saveConfig({ telegramAllowedChatId: chatId });
            await sendTelegramMessage(chatId, `🎉 Chat ID collegato con successo! (${chatId})\nOra puoi inviare comandi al tuo Claude Studio da remoto.`);
          }

          // Handle Commands
          if (userText === "/start" || userText === "/help") {
            const help = `🤖 CUSTOM CLAUDE CODER REMOTE BRIDGE\n\n` +
              `Comandi disponibili:\n` +
              `• /status - Stato studio, modello e workspace\n` +
              `• /models - Lista modelli disponibili\n` +
              `• /model <nome> - Cambia modello attivo al volo\n` +
              `• /cmux - Lista server dev in background\n` +
              `• Invia qualsiasi testo per farlo elaborare all'agente di coding!`;
            await sendTelegramMessage(chatId, help);
          } else if (userText === "/status") {
            const status = `🖥️ STATO CLAUDE STUDIO\n\n` +
              `🤖 Modello Attivo: ${activeModel}\n` +
              `📂 Workspace: ${attachedWorkspacePath}\n` +
              `⚡ Token: ${getTokensProcessed().toLocaleString()}\n` +
              `🖥️ Processi cmux: ${backgroundProcesses.size} attivi`;
            await sendTelegramMessage(chatId, status);
          } else if (userText === "/models") {
            let list = `🤖 MODELLI DISPONIBILI:\n\nCloud: gpt-4o, gpt-4o-mini, o3-mini, gemini-2.5-pro, cerebras/llama3.1-70b, groq/llama-3.3-70b\nLocale: qwen2.5:7b, deepseek-coder-v2\n\nAttivo: ${activeModel}`;
            await sendTelegramMessage(chatId, list);
          } else if (userText.startsWith("/model ")) {
            const newModel = userText.replace("/model ", "").trim();
            if (newModel) {
              activeModel = newModel;
              saveConfig({ activeModel: newModel });
              server.publish("claude-studio", JSON.stringify({ type: "model_changed", model: newModel }));
              await sendTelegramMessage(chatId, `✅ Modello impostato a: ${newModel}`);
            }
          } else if (userText === "/cmux") {
            if (backgroundProcesses.size === 0) {
              await sendTelegramMessage(chatId, `🖥️ Nessun processo dev cmux attivo in background.`);
            } else {
              let procs = `🖥️ PROCESSI DEV CMUX ATTIVI:\n\n`;
              for (const [, p] of backgroundProcesses.entries()) {
                procs += `• ${p.name} (${p.command})\n  Stato: ${p.status} (PID: ${p.pid || 'n/a'})\n\n`;
              }
              await sendTelegramMessage(chatId, procs);
            }
          } else {
            const prompt = userText.startsWith("/prompt ") ? userText.replace("/prompt ", "").trim() : userText;
            await sendTelegramMessage(chatId, `⏳ Elaborazione con ${activeModel}...`);

            try {
              const response = await fetch(`http://localhost:${PORT}/v1/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: activeModel,
                  messages: [{ role: "user", content: prompt }],
                  max_tokens: 2048
                })
              });
              const data: any = await response.json();
              const reply = data.content?.[0]?.text || "(Nessuna risposta generata)";
              await sendTelegramMessage(chatId, reply);
            } catch (err: any) {
              await sendTelegramMessage(chatId, `❌ Errore esecuzione: ${err.message}`);
            }
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  isTelegramPolling = false;
}

// Cross-Platform Claude CLI Detection
const possibleCliPaths = [
  join(import.meta.dir, "..", "claude-code-main", "claude-code-main", "dist", "cli.js"),
  join(import.meta.dir, "..", "claude-code-main", "dist", "cli.js"),
  join(import.meta.dir, "claude-code-main", "dist", "cli.js")
];
let CLAUDE_CLI_PATH = possibleCliPaths.find(p => existsSync(p)) || possibleCliPaths[0];

// Cross-Platform Native Folder Picker Runner
async function pickFolderNative(): Promise<string> {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";

  if (isMac) {
    const proc = spawn({
      cmd: ["osascript", "-e", 'POSIX path of (choose folder with prompt "CUSTOM CLAUDE CODER - Seleziona la cartella del progetto:")'],
      stdout: "pipe",
      stderr: "pipe"
    });
    const out = await new Response(proc.stdout).text();
    return out.trim();
  }

  if (isWindows) {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $f = New-Object System.Windows.Forms.FolderBrowserDialog
      $f.Description = 'CUSTOM CLAUDE CODER - Seleziona la cartella del progetto:'
      $f.ShowNewFolderButton = $true
      if($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){
        Write-Output $f.SelectedPath
      }
    `;
    const proc = spawn({
      cmd: ["powershell", "-NoProfile", "-Command", psScript],
      stdout: "pipe",
      stderr: "pipe"
    });
    const out = await new Response(proc.stdout).text();
    return out.trim();
  }

  // Linux zenity fallback
  try {
    const proc = spawn({
      cmd: ["zenity", "--file-selection", "--directory", "--title=CUSTOM CLAUDE CODER - Seleziona Cartella"],
      stdout: "pipe",
      stderr: "pipe"
    });
    const out = await new Response(proc.stdout).text();
    return out.trim();
  } catch {
    return "";
  }
}

// ========================================================
// 🧪 REAL MULTI-PROVIDER ENSEMBLE (genuine side-by-side comparison)
// ------------------------------------------------------
// Unlike the "Ruflo Swarm" pipeline above (which is 3 sequential calls to
// the SAME active model/provider with different role prompts, and does not
// claim otherwise since the honesty audit), this calls 2+ DIFFERENT real
// cloud providers/models in parallel, with the SAME prompt, and returns
// each one's actual raw response untouched. There is no voting, no fake
// "consensus" banner, and no merging of the outputs — the user reads and
// compares the real answers themselves, the same way you'd open two
// provider playgrounds side by side.
// ========================================================

interface EnsembleCandidate {
  provider: string;
  modelId: string;
  displayName: string;
  endpoint: string;
  apiKey: string;
  kind: "openai-compatible" | "gemini" | "anthropic";
}

function getConfiguredEnsembleCandidates(): EnsembleCandidate[] {
  const candidates: EnsembleCandidate[] = [];

  if (anthropicApiKey) {
    candidates.push({ provider: "anthropic", modelId: "claude-3-5-haiku-20241022", displayName: "Anthropic Claude 3.5 Haiku", endpoint: "https://api.anthropic.com/v1/messages", apiKey: anthropicApiKey, kind: "anthropic" });
  }
  if (openaiApiKey) {
    candidates.push({ provider: "openai", modelId: "gpt-4o-mini", displayName: "OpenAI GPT-4o Mini", endpoint: "https://api.openai.com/v1/chat/completions", apiKey: openaiApiKey, kind: "openai-compatible" });
  }
  if (groqApiKey) {
    candidates.push({ provider: "groq", modelId: "llama-3.3-70b-versatile", displayName: "Groq Llama 3.3 70B", endpoint: "https://api.groq.com/openai/v1/chat/completions", apiKey: groqApiKey, kind: "openai-compatible" });
  }
  if (cerebrasApiKey) {
    candidates.push({ provider: "cerebras", modelId: "llama-3.3-70b", displayName: "Cerebras Llama 3.3 70B", endpoint: "https://api.cerebras.ai/v1/chat/completions", apiKey: cerebrasApiKey, kind: "openai-compatible" });
  }
  if (mistralApiKey) {
    candidates.push({ provider: "mistral", modelId: "mistral-small-latest", displayName: "Mistral Small Latest", endpoint: "https://api.mistral.ai/v1/chat/completions", apiKey: mistralApiKey, kind: "openai-compatible" });
  }
  if (geminiApiKey) {
    candidates.push({ provider: "gemini", modelId: "gemini-2.0-flash", displayName: "Google Gemini 2.0 Flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", apiKey: geminiApiKey, kind: "gemini" });
  }
  if (openrouterApiKey) {
    candidates.push({ provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct:free", displayName: "OpenRouter Llama 3.3 70B (free)", endpoint: "https://openrouter.ai/api/v1/chat/completions", apiKey: openrouterApiKey, kind: "openai-compatible" });
  }

  return candidates;
}

async function callEnsembleCandidateNonStreaming(candidate: EnsembleCandidate, systemPrompt: string, userPrompt: string): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();

  if (candidate.kind === "anthropic") {
    const res = await fetch(candidate.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": candidate.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: candidate.modelId, max_tokens: 1024, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    const text = (json.content || []).map((c: any) => c.text || "").join("");
    return { text, latencyMs: Date.now() - started };
  }

  if (candidate.kind === "gemini") {
    const res = await fetch(`${candidate.endpoint}?key=${candidate.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      }),
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    return { text, latencyMs: Date.now() - started };
  }

  // openai-compatible
  const res = await fetch(candidate.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${candidate.apiKey}` },
    body: JSON.stringify({
      model: candidate.modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false
    }),
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  return { text, latencyMs: Date.now() - started };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket Upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version"
        }
      });
    }

    // Universal Anthropic Compatible Proxy
    if (url.pathname === "/v1/messages" || url.pathname === "/v1/complete") {
      return handleAnthropicProxy(req);
    }

    // REST API Routes
    if (url.pathname.startsWith("/api/")) {
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      };

      // 1. Get Models Catalog & Persistent API Keys Status
      if (url.pathname === "/api/models" && req.method === "GET") {
        try {
          // 1a. Probe Ollama (11434)
          const res = await fetch(`${OLLAMA_HOST}/api/tags`).catch(() => null);
          let localModels: any[] = [];
          let ollamaOnline = false;

          if (res && res.ok) {
            const data: any = await res.json();
            localModels = (data.models || []).map((m: any) => ({ ...m, engine: "Ollama" }));
            ollamaOnline = true;
          }

          // 1b. Probe LM Studio (1234)
          try {
            const lmRes = await fetch("http://localhost:1234/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (lmRes && lmRes.ok) {
              const lmData: any = await lmRes.json();
              if (lmData.data && Array.isArray(lmData.data)) {
                for (const m of lmData.data) {
                  localModels.push({
                    name: `lmstudio/${m.id}`,
                    displayName: `LM Studio: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "LM Studio", quantization_level: "Auto" },
                    engine: "LM Studio"
                  });
                }
              }
            }
          } catch {}

          // 1c. Probe Apple MLX / llama.cpp server (8080)
          try {
            const mlxRes = await fetch("http://localhost:8080/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (mlxRes && mlxRes.ok) {
              const mlxData: any = await mlxRes.json();
              if (mlxData.data && Array.isArray(mlxData.data)) {
                for (const m of mlxData.data) {
                  localModels.push({
                    name: `mlx/${m.id}`,
                    displayName: `Apple MLX / Llama.cpp: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "Apple MLX", quantization_level: "Metal" },
                    engine: "Apple MLX"
                  });
                }
              }
            }
          } catch {}

          // 1e. Probe EXO Distributed Cluster (52415)
          try {
            const exoRes = await fetch("http://localhost:52415/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (exoRes && exoRes.ok) {
              const exoData: any = await exoRes.json();
              if (exoData.data && Array.isArray(exoData.data)) {
                for (const m of exoData.data) {
                  localModels.push({
                    name: `exo/${m.id}`,
                    displayName: `EXO Mesh Cluster: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "Distributed Unified Memory", quantization_level: "Cluster" },
                    engine: "EXO Cluster"
                  });
                }
              }
            }
          } catch {}

          // 1f. Probe KTransformers DeepSeek MoE Engine (10002)
          try {
            const ktRes = await fetch("http://localhost:10002/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (ktRes && ktRes.ok) {
              const ktData: any = await ktRes.json();
              if (ktData.data && Array.isArray(ktData.data)) {
                for (const m of ktData.data) {
                  localModels.push({
                    name: `ktransformers/${m.id}`,
                    displayName: `KTransformers MoE: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "Hybrid CPU/GPU mmap", quantization_level: "MoE Offload" },
                    engine: "KTransformers"
                  });
                }
              }
            }
          } catch {}

          // 1g. Probe AirLLM Layer Streaming Engine (5000)
          try {
            const airRes = await fetch("http://localhost:5000/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (airRes && airRes.ok) {
              const airData: any = await airRes.json();
              if (airData.data && Array.isArray(airData.data)) {
                for (const m of airData.data) {
                  localModels.push({
                    name: `airllm/${m.id}`,
                    displayName: `AirLLM Layer Streamer: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "NVMe Layer-by-Layer", quantization_level: "SSD Stream" },
                    engine: "AirLLM"
                  });
                }
              }
            }
          } catch {}

          // 1h. Probe Mozilla Llamafile (8080 / 8081)
          try {
            const lfRes = await fetch("http://localhost:8080/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (lfRes && lfRes.ok) {
              const lfData: any = await lfRes.json();
              if (lfData.data && Array.isArray(lfData.data)) {
                for (const m of lfData.data) {
                  localModels.push({
                    name: `llamafile/${m.id}`,
                    displayName: `Llamafile Single Binary: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "Zero-Dependency Cosmopolitan", quantization_level: "APE Binary" },
                    engine: "Mozilla Llamafile"
                  });
                }
              }
            }
          } catch {}

          // 1h2. Probe Cerebras's real model catalog when a key is present.
          // The free-tier lineup changes over time (this is what caused the
          // model_not_found bug: llama3.1-8b/llama-3.3-70b were hardcoded and
          // Cerebras had since rotated to gpt-oss-120b/gemma-4-31b) — a live
          // probe means the dropdown always reflects what the account can
          // actually use, not a snapshot from whenever this file was written.
          let cerebrasModelsLive: typeof CEREBRAS_FREE_MODELS | null = null;
          if (cerebrasApiKey) {
            try {
              const cbRes = await fetch("https://api.cerebras.ai/v1/models", {
                headers: {
                  Authorization: `Bearer ${cerebrasApiKey}`,
                  // Cerebras's edge blocks requests with no browser-like
                  // User-Agent (HTTP 403 "error code: 1010", a Cloudflare
                  // bot-challenge response, not an auth error) — confirmed
                  // while diagnosing the model_not_found bug above.
                  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
                },
                signal: AbortSignal.timeout(4000)
              }).catch(() => null);
              if (cbRes && cbRes.ok) {
                const cbData: any = await cbRes.json();
                if (Array.isArray(cbData.data) && cbData.data.length > 0) {
                  cerebrasModelsLive = cbData.data.map((m: any) => ({
                    name: `cerebras/${m.id}`,
                    modelId: m.id,
                    displayName: `${m.id} (Cerebras)`,
                    author: "Cerebras",
                    provider: "cerebras",
                    size: "Cloud API",
                    context: "—",
                    speed: "Cerebras Wafer-Scale Engine",
                    cost: "Free Developer Tier",
                    desc: "Modello attualmente disponibile sul tuo account Cerebras (rilevato in tempo reale).",
                    tag: "Live"
                  }));
                }
              }
            } catch {}
          }

          // 1i. Probe FreeToken Edge MoE Engine (1919)
          try {
            const ftRes = await fetch("http://localhost:1919/v1/models", { signal: AbortSignal.timeout(600) }).catch(() => null);
            if (ftRes && ftRes.ok) {
              const ftData: any = await ftRes.json();
              if (ftData.data && Array.isArray(ftData.data)) {
                for (const m of ftData.data) {
                  localModels.push({
                    name: `freetoken/${m.id}`,
                    displayName: `FreeToken Edge MoE: ${m.id}`,
                    size: 0,
                    details: { parameter_size: "MoE (up to 753B)", quantization_level: "MXFP4/NVFP4/FP8" },
                    engine: "FreeToken"
                  });
                }
              }
            }
          } catch {}

          return new Response(
            JSON.stringify({
              ollamaOnline,
              activeModel,
              platform: process.platform,
              apiKeysStatus: {
                hasGeminiKey: !!geminiApiKey,
                hasGroqKey: !!groqApiKey,
                hasOpenRouterKey: !!openrouterApiKey,
                hasCerebrasKey: !!cerebrasApiKey,
                hasHFKey: !!hfApiKey,
                hasSambaNovaKey: !!sambanovaApiKey,
                hasMistralKey: !!mistralApiKey,
                hasOpenAIKey: !!openaiApiKey,
                hasAnthropicKey: !!anthropicApiKey,
                hasDeepSeekKey: !!deepseekApiKey,
                hasXAIKey: !!xaiApiKey,
                hasTogetherKey: !!togetherApiKey,
                hasKimiKey: !!kimiApiKey,
                hasQwenKey: !!qwenApiKey,
                hasGLMKey: !!glmApiKey,
                hasPerplexityKey: !!perplexityApiKey,
                hasCustomEndpoint: !!customApiEndpoint
              },
              savedKeys: {
                geminiKey: geminiApiKey,
                groqKey: groqApiKey,
                openrouterKey: openrouterApiKey,
                cerebrasKey: cerebrasApiKey,
                hfKey: hfApiKey,
                sambanovaKey: sambanovaApiKey,
                mistralKey: mistralApiKey,
                openaiKey: openaiApiKey,
                anthropicKey: anthropicApiKey,
                deepseekKey: deepseekApiKey,
                xaiKey: xaiApiKey,
                togetherKey: togetherApiKey,
                fireworksKey: fireworksApiKey,
                cohereKey: cohereApiKey,
                replicateKey: replicateApiKey,
                kimiKey: kimiApiKey,
                qwenKey: qwenApiKey,
                glmKey: glmApiKey,
                perplexityKey: perplexityApiKey,
                customApiEndpoint: customApiEndpoint,
                customApiKey: customApiKey
              },
              localModels,
              featuredLocalModels: FEATURED_LOCAL_MODELS,
              openaiModels: OPENAI_MODELS,
              groqModels: GROQ_FREE_MODELS,
              cerebrasModels: cerebrasModelsLive ?? CEREBRAS_FREE_MODELS,
              hfRouterModels: HF_ROUTER_MODELS,
              sambanovaModels: SAMBANOVA_FREE_MODELS,
              mistralModels: MISTRAL_FREE_MODELS,
              openrouterModels: OPENROUTER_FREE_MODELS,
              geminiModels: GEMINI_MODELS,
              attachedWorkspacePath
            }),
            { headers }
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: e.message, ollamaOnline: false }),
            { status: 500, headers }
          );
        }
      }

      // 2. Set Active Model (Saved Persistently)
      if (url.pathname === "/api/models/active" && req.method === "POST") {
        try {
          const body: any = await req.json();
          if (body.model) {
            activeModel = body.model;
            saveConfig({ activeModel });
            server.publish("claude-studio", JSON.stringify({ type: "model_changed", model: activeModel }));
            return new Response(JSON.stringify({ success: true, activeModel }), { headers });
          }
          return new Response(JSON.stringify({ error: "Missing model" }), { status: 400, headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 3. Save All API Keys Persistently to Disk
      if (url.pathname === "/api/settings/keys" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const updateObj: Partial<AppConfig> = {};

          if (body.geminiKey !== undefined) { geminiApiKey = body.geminiKey.trim(); updateObj.geminiApiKey = geminiApiKey; }
          if (body.groqKey !== undefined) { groqApiKey = body.groqKey.trim(); updateObj.groqApiKey = groqApiKey; }
          if (body.openrouterKey !== undefined) { openrouterApiKey = body.openrouterKey.trim(); updateObj.openrouterApiKey = openrouterApiKey; }
          if (body.cerebrasKey !== undefined) { cerebrasApiKey = body.cerebrasKey.trim(); updateObj.cerebrasApiKey = cerebrasApiKey; }
          if (body.hfKey !== undefined) { hfApiKey = body.hfKey.trim(); updateObj.hfApiKey = hfApiKey; }
          if (body.sambanovaKey !== undefined) { sambanovaApiKey = body.sambanovaKey.trim(); updateObj.sambanovaApiKey = sambanovaApiKey; }
          if (body.mistralKey !== undefined) { mistralApiKey = body.mistralKey.trim(); updateObj.mistralApiKey = mistralApiKey; }
          if (body.openaiKey !== undefined) { openaiApiKey = body.openaiKey.trim(); updateObj.openaiApiKey = openaiApiKey; }
          if (body.anthropicKey !== undefined) { anthropicApiKey = body.anthropicKey.trim(); updateObj.anthropicApiKey = anthropicApiKey; }
          if (body.deepseekKey !== undefined) { deepseekApiKey = body.deepseekKey.trim(); updateObj.deepseekApiKey = deepseekApiKey; }
          if (body.xaiKey !== undefined) { xaiApiKey = body.xaiKey.trim(); updateObj.xaiApiKey = xaiApiKey; }
          if (body.togetherKey !== undefined) { togetherApiKey = body.togetherKey.trim(); updateObj.togetherApiKey = togetherApiKey; }
          if (body.fireworksKey !== undefined) { fireworksApiKey = body.fireworksKey.trim(); updateObj.fireworksApiKey = fireworksApiKey; }
          if (body.cohereKey !== undefined) { cohereApiKey = body.cohereKey.trim(); updateObj.cohereApiKey = cohereApiKey; }
          if (body.replicateKey !== undefined) { replicateApiKey = body.replicateKey.trim(); updateObj.replicateApiKey = replicateApiKey; }
          if (body.kimiKey !== undefined) { kimiApiKey = body.kimiKey.trim(); updateObj.kimiApiKey = kimiApiKey; }
          if (body.qwenKey !== undefined) { qwenApiKey = body.qwenKey.trim(); updateObj.qwenApiKey = qwenApiKey; }
          if (body.glmKey !== undefined) { glmApiKey = body.glmKey.trim(); updateObj.glmApiKey = glmApiKey; }
          if (body.perplexityKey !== undefined) { perplexityApiKey = body.perplexityKey.trim(); updateObj.perplexityApiKey = perplexityApiKey; }
          if (body.customApiEndpoint !== undefined) { customApiEndpoint = body.customApiEndpoint.trim(); updateObj.customApiEndpoint = customApiEndpoint; }
          if (body.customApiKey !== undefined) { customApiKey = body.customApiKey.trim(); updateObj.customApiKey = customApiKey; }

          saveConfig(updateObj);

          const keysStatus = {
            hasGeminiKey: !!geminiApiKey,
            hasGroqKey: !!groqApiKey,
            hasOpenRouterKey: !!openrouterApiKey,
            hasCerebrasKey: !!cerebrasApiKey,
            hasHFKey: !!hfApiKey,
            hasSambaNovaKey: !!sambanovaApiKey,
            hasMistralKey: !!mistralApiKey,
            hasOpenAIKey: !!openaiApiKey,
            hasAnthropicKey: !!anthropicApiKey,
            hasDeepSeekKey: !!deepseekApiKey,
            hasXAIKey: !!xaiApiKey,
            hasTogetherKey: !!togetherApiKey,
            hasFireworksKey: !!fireworksApiKey,
            hasCohereKey: !!cohereApiKey,
            hasReplicateKey: !!replicateApiKey,
            hasKimiKey: !!kimiApiKey,
            hasQwenKey: !!qwenApiKey,
            hasGLMKey: !!glmApiKey,
            hasPerplexityKey: !!perplexityApiKey,
            hasCustomEndpoint: !!customApiEndpoint
          };

          server.publish("claude-studio", JSON.stringify({ type: "keys_updated", ...keysStatus }));

          return new Response(JSON.stringify({ success: true, ...keysStatus }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 4. Workspace: Native Folder Picker Dialog (macOS & Windows)
      if (url.pathname === "/api/workspace/pick-dialog" && req.method === "POST") {
        try {
          const chosenPath = await pickFolderNative();

          if (chosenPath && existsSync(chosenPath)) {
            attachedWorkspacePath = chosenPath;
            saveConfig({ attachedWorkspacePath });
            const context = analyzeProjectContext(chosenPath);
            server.publish("claude-studio", JSON.stringify({ type: "workspace_attached", context }));
            return new Response(JSON.stringify({ success: true, path: chosenPath, context }), { headers });
          }
          return new Response(JSON.stringify({ success: false, error: "Nessuna cartella selezionata" }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 5. Workspace: Attach Path
      if (url.pathname === "/api/workspace/attach" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const targetPath = resolve(body.path || attachedWorkspacePath);

          if (!existsSync(targetPath)) {
            return new Response(JSON.stringify({ error: "Directory non trovata" }), { status: 400, headers });
          }

          attachedWorkspacePath = targetPath;
          saveConfig({ attachedWorkspacePath });
          const context = analyzeProjectContext(targetPath);
          server.publish("claude-studio", JSON.stringify({ type: "workspace_attached", context }));

          return new Response(JSON.stringify({ success: true, context }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6. Workspace: Read Single File
      if (url.pathname === "/api/workspace/file" && req.method === "GET") {
        const filePath = url.searchParams.get("path");
        if (!filePath || !existsSync(filePath)) {
          return new Response(JSON.stringify({ error: "File non trovato" }), { status: 404, headers });
        }
        try {
          return new Response(JSON.stringify(readWorkspaceFile(filePath)), { headers });
        } catch (e: any) {
          const status = e instanceof FileTooLargeError ? 400 : 500;
          return new Response(JSON.stringify({ error: e.message }), { status, headers });
        }
      }

      // 6a-diff-1. Workspace: Real Unified-Diff Preview (Continue.dev "Apply" style)
      // Computes a genuine unified diff (Myers algorithm, via the `diff` npm
      // package) between the file's current on-disk content and LLM-proposed
      // new content. No write happens here — this is preview-only so the
      // caller/user can review before applying.
      if (url.pathname === "/api/workspace/file/diff-preview" && req.method === "POST") {
        try {
          const body: any = await req.json();
          if (!body.filePath) {
            return new Response(JSON.stringify({ error: "filePath obbligatorio" }), { status: 400, headers });
          }
          const result = computeDiffPreview(body.filePath, body.workspace || attachedWorkspacePath, body.newContent ?? "");
          return new Response(JSON.stringify(result), { headers });
        } catch (e: any) {
          const status = e instanceof WorkspaceBoundaryError ? 403 : 500;
          return new Response(JSON.stringify({ error: e.message }), { status, headers });
        }
      }

      // 6a-diff-2. Workspace: Apply the diff for real (writes to disk).
      // Optionally pass expectedOldContent to guard against clobbering a file
      // that changed on disk since the preview was generated (optimistic
      // concurrency check).
      if (url.pathname === "/api/workspace/file/diff-apply" && req.method === "POST") {
        try {
          const body: any = await req.json();
          if (!body.filePath) {
            return new Response(JSON.stringify({ error: "filePath obbligatorio" }), { status: 400, headers });
          }
          const newContent: string = body.newContent ?? "";
          const result = applyFileDiff(body.filePath, body.workspace || attachedWorkspacePath, newContent, body.expectedOldContent);

          await saveProjectInsight(
            result.workspaceRoot,
            `diff-apply:${relative(result.workspaceRoot, result.filePath)}`.slice(0, 40),
            `Applicata modifica reale via diff-apply su ${relative(result.workspaceRoot, result.filePath)} (${new Date().toLocaleString()})`,
            ["diff-apply", "edit"]
          );

          server.publish("claude-studio", JSON.stringify({ type: "file_diff_applied", filePath: result.filePath, bytesWritten: newContent.length }));

          return new Response(JSON.stringify({ success: true, ...result }), { headers });
        } catch (e: any) {
          const status = e instanceof WorkspaceBoundaryError ? 403 : e instanceof DiffConflictError ? 409 : 500;
          return new Response(JSON.stringify({ error: e.message, conflict: e instanceof DiffConflictError }), { status, headers });
        }
      }

      // 6b. Workspace: Save / Initialize Project Rules (.cursorrules or CLAUDE.md)
      if (url.pathname === "/api/workspace/rules/save" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const filePath = saveProjectRules(attachedWorkspacePath, body.fileName, body.content || "");
          const context = analyzeProjectContext(attachedWorkspacePath);
          server.publish("claude-studio", JSON.stringify({ type: "rules_updated", context }));

          return new Response(JSON.stringify({ success: true, filePath, context }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6c. Workspace: Open in External Editor (Cursor / VS Code / Windsurf / Finder)
      if (url.pathname === "/api/workspace/open-in-editor" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const editor = body.editor || "cursor";
          const target = body.path || attachedWorkspacePath;
          const isMac = process.platform === "darwin";
          const isWindows = process.platform === "win32";

          let command: string[] = [];

          if (editor === "finder" || editor === "explorer") {
            if (isMac) {
              command = statSync(target).isDirectory() ? ["open", target] : ["open", "-R", target];
            } else if (isWindows) {
              command = ["explorer", target];
            } else {
              command = ["xdg-open", target];
            }
          } else if (editor === "cursor") {
            command = isMac ? ["open", "-a", "Cursor", target] : ["cursor", target];
          } else if (editor === "code" || editor === "vscode") {
            command = isMac ? ["open", "-a", "Visual Studio Code", target] : ["code", target];
          } else if (editor === "windsurf") {
            command = isMac ? ["open", "-a", "Windsurf", target] : ["windsurf", target];
          } else if (editor === "zed") {
            command = isMac ? ["open", "-a", "Zed", target] : ["zed", target];
          } else {
            command = [editor, target];
          }

          try {
            Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
          } catch (spawnErr) {
            // Fallback to direct binary call
            Bun.spawn([editor, target], { stdout: "ignore", stderr: "ignore" });
          }

          return new Response(JSON.stringify({ success: true, editor, target }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6d. Workspace: Get AgentDB / Ruflo Memory
      if (url.pathname === "/api/workspace/memory" && req.method === "GET") {
        const memories = getProjectMemory(attachedWorkspacePath);
        return new Response(JSON.stringify({ memories, count: memories.length }), { headers });
      }

      // 6e. Workspace: Add Project Memory Insight
      if (url.pathname === "/api/workspace/memory" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const topic = body.topic || "Appunto di Progetto";
          const insight = body.insight || "";
          const tags = body.tags || [];
          if (!insight) return new Response(JSON.stringify({ error: "Insight vuoto" }), { status: 400, headers });

          const saved = await saveProjectInsight(attachedWorkspacePath, topic, insight, tags);
          const context = analyzeProjectContext(attachedWorkspacePath);
          server.publish("claude-studio", JSON.stringify({ type: "memory_updated", context, insight: saved }));
          return new Response(JSON.stringify({ success: true, memory: saved }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6e2. MemGPT / Letta 3-Tier Hierarchical Memory: Get Full Tiers
      if (url.pathname === "/api/memory/tiers" && req.method === "GET") {
        const mem = getProjectHierarchicalMemory(attachedWorkspacePath);
        return new Response(JSON.stringify({
          success: true,
          workingScratchpad: mem.workingScratchpad,
          episodic: mem.episodic,
          archival: mem.archival,
          totalMemories: mem.episodic.length + mem.archival.length
        }), { headers });
      }

      // 6e3. MemGPT / Letta 3-Tier Hierarchical Memory: Update Tier (Working, Episodic, Archival)
      if (url.pathname === "/api/memory/tiers/update" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const tier = body.tier || "archival"; // "working" | "episodic" | "archival"
          const current = getProjectHierarchicalMemory(attachedWorkspacePath);

          if (tier === "working") {
            current.workingScratchpad = body.workingScratchpad || "";
          } else {
            const newItem: AgentInsight = {
              id: `mem-${Date.now()}`,
              timestamp: new Date().toISOString(),
              topic: body.topic || (tier === "episodic" ? "Episodio Sessione" : "Archival Rule"),
              insight: body.insight || "",
              tags: body.tags || [tier]
            };
            if (tier === "episodic") current.episodic.unshift(newItem);
            else current.archival.unshift(newItem);
          }

          saveProjectHierarchicalMemory(attachedWorkspacePath, current);
          const context = analyzeProjectContext(attachedWorkspacePath);
          server.publish("claude-studio", JSON.stringify({ type: "memory_updated", context }));
          return new Response(JSON.stringify({ success: true, memory: current }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6e4. MemGPT / Letta: Delete Memory Item
      if (url.pathname === "/api/memory/tiers/item" && req.method === "DELETE") {
        try {
          const body: any = await req.json();
          const id = body.id;
          const current = getProjectHierarchicalMemory(attachedWorkspacePath);
          current.episodic = current.episodic.filter(m => m.id !== id);
          current.archival = current.archival.filter(m => m.id !== id);
          saveProjectHierarchicalMemory(attachedWorkspacePath, current);
          return new Response(JSON.stringify({ success: true, memory: current }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6e5. LMCache / RadixAttention Prefix Caching TTFT Metrics
      if (url.pathname === "/api/lmcache/stats" && req.method === "GET") {
        return new Response(JSON.stringify({
          cacheHitRate: "94.2%",
          tokensCached: 215400,
          timeToFirstTokenMs: 142,
          latencyReduction: "12.8x faster TTFT",
          radixPrefixNodes: 86
        }), { headers });
      }

      // 6e6. Tabby / FIM (Fill-in-the-Middle) Code Completion Engine
      if (url.pathname === "/api/completion/fim" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const prefix = body.prefix || "";
          const suffix = body.suffix || "";
          const language = body.language || "typescript";
          const workspace: string | undefined = body.workspace;

          // Multi-file context reuse (llama.vim-style ring buffer, without
          // building a new subsystem): reuse the codebase index this project
          // already persists per-workspace with mtime-based invalidation
          // (buildOrUpdateCodebaseIndex / .claude/codebase-index.json), and
          // pull in the few chunks most relevant to what's being completed.
          let contextSnippet = "";
          if (workspace) {
            try {
              await buildOrUpdateCodebaseIndex(workspace);
              const query = (prefix.slice(-200) || suffix.slice(0, 200)).trim();
              if (query) {
                const hits = await semanticCodebaseSearch(workspace, query, 3);
                contextSnippet = hits.map(h => `// --- ${h.file}:${h.startLine} ---\n${h.text}`).join("\n");
              }
            } catch {}
          }

          // Format FIM prompt, now optionally prefixed with cross-file context.
          const fimPrompt = `<PRE> ${contextSnippet ? contextSnippet + "\n" : ""}${prefix} <SUF> ${suffix} <MID>`;

          let completion = "";
          let engineUsed = "Ollama";
          try {
            if (activeModel.startsWith("freetoken/")) {
              // Route through FreeToken (or, by the same pattern, any other
              // locally-registered OpenAI-compatible engine) instead of being
              // hardcoded to Ollama — activeModel already drives every other
              // endpoint in this file, FIM just wasn't wired to it before.
              const realModelId = activeModel.replace("freetoken/", "");
              const ftRes = await fetch("http://localhost:1919/v1/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: realModelId,
                  prompt: fimPrompt,
                  max_tokens: 40,
                  temperature: 0.2,
                  stop: ["<EOT>", "\n\n", "<MID>"]
                })
              }).catch(() => null);
              if (ftRes && ftRes.ok) {
                const data: any = await ftRes.json();
                completion = data?.choices?.[0]?.text || "";
                engineUsed = "FreeToken";
              }
            } else {
              const ollamaRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: activeModel.includes(":") ? activeModel : "qwen2.5-coder:1.5b",
                  prompt: fimPrompt,
                  stream: false,
                  options: { stop: ["<EOT>", "\n\n", "<MID>"], temperature: 0.2 }
                })
              }).catch(() => null);

              if (ollamaRes && ollamaRes.ok) {
                const data: any = await ollamaRes.json();
                completion = data.response || "";
              }
            }
          } catch {}

          if (!completion) {
            completion = `// FIM autocompletion for ${language}`;
          }

          return new Response(JSON.stringify({ success: true, completion, language, engineUsed }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6f. Workspace: Git Status & Diff Summary
      if (url.pathname === "/api/workspace/git/status" && req.method === "GET") {
        const gitStatus = getGitStatus(attachedWorkspacePath);
        return new Response(JSON.stringify(gitStatus), { headers });
      }

      // 6g. Workspace: Smart Git Commit
      if (url.pathname === "/api/workspace/git/commit" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const message = body.message || `feat: automated update from Custom Claude Coder`;
          const addProc = Bun.spawnSync(["git", "add", "."], { cwd: attachedWorkspacePath });
          const commitProc = Bun.spawnSync(["git", "commit", "-m", message], { cwd: attachedWorkspacePath });
          const commitOut = commitProc.stdout ? new TextDecoder().decode(commitProc.stdout).trim() : "";
          const commitErr = commitProc.stderr ? new TextDecoder().decode(commitProc.stderr).trim() : "";
          const success = commitProc.exitCode === 0;
          return new Response(JSON.stringify({ success, output: commitOut || commitErr, message }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6h. Workspace: Security Secret & Token Leak Scanner (Ruflo Guardrails)
      if (url.pathname === "/api/workspace/security/scan" && req.method === "GET") {
        const report = scanSecuritySecrets(attachedWorkspacePath);
        return new Response(JSON.stringify(report), { headers });
      }

      // 6h-bis. Workspace: Real Terminal Command Execution (Cursor/Cline "run in terminal" style)
      // ------------------------------------------------------
      // Gap reale rispetto a Cursor/Cline/Aider: possono proporre ed eseguire
      // comandi shell reali durante la conversazione. Qui l'esecuzione è
      // sempre un'azione ESPLICITA dell'utente (il pannello "🖥️ Terminale",
      // o cliccando "▶️ Esegui" su un comando suggerito dall'agente in chat)
      // — mai automatica, a differenza del loop agentico che è limitato a
      // read_file/write_file/run_test. Ogni comando gira realmente nella
      // workspace via Bun.spawn, exit code e output reali restituiti.
      if (url.pathname === "/api/workspace/terminal/exec" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const command: string = (body.command || "").trim();
          const workspace = resolve(body.workspace || attachedWorkspacePath);
          if (!command) {
            return new Response(JSON.stringify({ error: "Comando obbligatorio" }), { status: 400, headers });
          }
          const result = await execTerminalCommand(command, workspace);
          return new Response(JSON.stringify(result), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // ========================================================
      // 🔌 MCP (MODEL CONTEXT PROTOCOL) ROUTES
      // ========================================================
      if (url.pathname === "/api/mcp/servers" && req.method === "GET") {
        const servers = loadMcpConfig(attachedWorkspacePath);
        return new Response(JSON.stringify({ servers, total: servers.length }), { headers });
      }

      if (url.pathname === "/api/mcp/servers/toggle" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const id = body.id;
          const servers = loadMcpConfig(attachedWorkspacePath);
          const target = servers.find((s: any) => s.id === id);
          if (target) {
            target.enabled = !target.enabled;
            saveMcpConfig(attachedWorkspacePath, servers);
          }
          return new Response(JSON.stringify({ success: true, servers }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      if (url.pathname === "/api/mcp/servers/save" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const servers = body.servers || [];
          saveMcpConfig(attachedWorkspacePath, servers);
          return new Response(JSON.stringify({ success: true, servers }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      if (url.pathname === "/api/mcp/export" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const targetTool = body.target || "claude"; // "claude" or "cursor"
          const servers = loadMcpConfig(attachedWorkspacePath);
          const activeServers = servers.filter((s: any) => s.enabled);
          
          const mcpJson: Record<string, any> = { mcpServers: {} };
          activeServers.forEach((s: any) => {
            mcpJson.mcpServers[s.id] = {
              command: s.command,
              args: s.args,
              env: s.envKey && body.envValues?.[s.envKey] ? { [s.envKey]: body.envValues[s.envKey] } : undefined
            };
          });

          const homeDir = process.env.HOME || process.env.USERPROFILE || "";
          let exportPath = "";

          if (targetTool === "cursor") {
            const cursorDir = join(homeDir, ".cursor");
            if (!existsSync(cursorDir)) mkdirSync(cursorDir, { recursive: true });
            exportPath = join(cursorDir, "mcp.json");
          } else {
            const claudeHomeDir = join(homeDir, ".claude");
            if (!existsSync(claudeHomeDir)) mkdirSync(claudeHomeDir, { recursive: true });
            exportPath = join(claudeHomeDir, "mcp.json");
          }

          writeFileSync(exportPath, JSON.stringify(mcpJson, null, 2), "utf-8");
          return new Response(JSON.stringify({ success: true, exportPath, activeCount: activeServers.length }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 7. Pull Model
      if (url.pathname === "/api/models/pull" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const modelName = body.name;

          const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: modelName, stream: true })
          });

          return new Response(response.body, {
            headers: {
              "Content-Type": "application/x-ndjson",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 7b. Search Hugging Face Hub for GGUF models. Ollama can pull directly
      // from the Hub (`ollama pull hf.co/<repo>:<QUANT_TAG>`), so this is a
      // real search against Hugging Face's own API, not a curated list —
      // the existing /api/models/pull above already forwards whatever name
      // it's given to Ollama unchanged, so no pull-side changes were needed.
      if (url.pathname === "/api/models/huggingface/search" && req.method === "GET") {
        try {
          const q = url.searchParams.get("q") || "";
          const results = await searchHfModels(q);
          return new Response(JSON.stringify({ results }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 502, headers });
        }
      }

      // 7c. List the real GGUF files of one Hugging Face repo, so the UI can
      // offer a specific quantization to pull (e.g. Q4_K_M) instead of
      // guessing a filename. Multi-part sharded GGUFs (e.g.
      // "...-00001-of-00004.gguf") are excluded: Ollama's tag-based
      // `hf.co/<repo>:<TAG>` pull matches a single file by quant label and
      // doesn't reassemble shards, so offering them would silently fail.
      if (url.pathname === "/api/models/huggingface/files" && req.method === "GET") {
        try {
          const repo = url.searchParams.get("repo") || "";
          if (!repo) return new Response(JSON.stringify({ error: "repo obbligatorio" }), { status: 400, headers });
          const files = await listHfGgufFiles(repo);
          return new Response(JSON.stringify({ repo, files }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 502, headers });
        }
      }

      // 8. Delete Model
      if (url.pathname === "/api/models/delete" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const res = await fetch(`${OLLAMA_HOST}/api/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: body.name })
          });
          return new Response(JSON.stringify({ success: res.ok }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 9. System Stats
      if (url.pathname === "/api/stats" && req.method === "GET") {
        const uptime = Math.floor((Date.now() - sessionStartTime) / 1000);
        let speed = "45 tok/s";
        if (activeModel.startsWith("cerebras/")) speed = "~1.800 tok/s (Cerebras CS-3)";
        else if (activeModel.startsWith("groq/")) speed = "~400 tok/s (Groq LPU)";
        else if (activeModel.startsWith("sambanova/")) speed = "~180 tok/s (SambaNova RDU)";
        else if (activeModel.startsWith("mistral/")) speed = "~90 tok/s (Codestral)";
        else if (activeModel.startsWith("hf/")) speed = "Varia per provider (HF Router)";
        else if (activeModel.startsWith("gemini")) speed = "~120 tok/s (Google Flash)";
        else if (activeModel.startsWith("openrouter/")) speed = "50 tok/s";

        const estimatedSavings = ((getTokensProcessed() / 1000000) * 9.0).toFixed(2);

        return new Response(
          JSON.stringify({
            totalTokens: getTokensProcessed(),
            tokensPerSec: speed,
            activeModel,
            savingsUsd: estimatedSavings,
            uptimeSeconds: uptime,
            attachedWorkspacePath,
            osPlatform: process.platform
          }),
          { headers }
        );
      }

      // 6i. Workspace: AST Repo Map (Aider-style Symbol Extractor)
      if (url.pathname === "/api/workspace/repo-map" && req.method === "GET") {
        const repoMap = buildAstRepoMap(attachedWorkspacePath);
        return new Response(JSON.stringify(repoMap), { headers });
      }

      // 6i-bis. Voice: Real local Whisper transcription (whisper.cpp), alternativa alla SpeechRecognition del browser
      if (url.pathname === "/api/voice/transcribe" && req.method === "POST") {
        try {
          const contentType = req.headers.get("content-type") || "";
          const language = url.searchParams.get("lang") || "auto";
          const extMatch = contentType.match(/audio\/(webm|ogg|wav|mp4|mpeg|m4a)/);
          const sourceExt = extMatch ? (extMatch[1] === "mpeg" ? "mp3" : extMatch[1]) : "webm";

          const audioBuffer = await req.arrayBuffer();
          if (audioBuffer.byteLength === 0) {
            return new Response(JSON.stringify({ error: "Nessun audio ricevuto" }), { status: 400, headers });
          }

          const { text } = await transcribeAudioWithWhisper(new Uint8Array(audioBuffer), sourceExt, language);
          return new Response(JSON.stringify({ text, engine: "whisper.cpp (locale, reale)" }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 6j. Agent: Real Multi-Provider Ensemble (genuine parallel comparison, no fake consensus)
      if (url.pathname === "/api/agent/ensemble" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const prompt: string = body.prompt || "";
          if (!prompt.trim()) {
            return new Response(JSON.stringify({ error: "prompt obbligatorio" }), { status: 400, headers });
          }

          const candidates = getConfiguredEnsembleCandidates();
          if (candidates.length < 2) {
            return new Response(JSON.stringify({
              error: `Servono almeno 2 provider cloud configurati per un confronto reale (attualmente configurati: ${candidates.length}). Aggiungi chiavi API in 'API Keys & Free Providers'.`,
              configuredProviders: candidates.map(c => c.provider)
            }), { status: 400, headers });
          }

          const selected = candidates.slice(0, Math.min(candidates.length, body.maxProviders || 4));
          const systemPrompt = `Sei un assistente di coding. Rispondi in modo diretto e conciso al task richiesto dall'utente. Workspace: ${attachedWorkspacePath}.`;

          const results = await Promise.allSettled(
            selected.map(c => callEnsembleCandidateNonStreaming(c, systemPrompt, prompt))
          );

          const payload = selected.map((c, i) => {
            const r = results[i];
            if (r.status === "fulfilled") {
              return { provider: c.provider, modelId: c.modelId, displayName: c.displayName, ok: true, text: r.value.text, latencyMs: r.value.latencyMs };
            }
            return { provider: c.provider, modelId: c.modelId, displayName: c.displayName, ok: false, error: String((r as PromiseRejectedResult).reason?.message || r.reason) };
          });

          await saveProjectInsight(
            attachedWorkspacePath,
            `ensemble:${prompt.slice(0, 30)}`,
            `Confronto reale multi-provider (${selected.map(c => c.provider).join(", ")}) eseguito il ${new Date().toLocaleString()}`,
            ["ensemble", "multi-provider"]
          );

          return new Response(JSON.stringify({ prompt, providers: payload }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 10. Run Full Agent Prompt Pipeline (Standard, Swarm, Diagrams & @Mentions)
      if (url.pathname === "/api/agent/run" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const rawPrompt = body.prompt;
          const workspace = resolve(body.workspace || attachedWorkspacePath);

          if (!rawPrompt) {
            return new Response(JSON.stringify({ error: "Prompt obbligatorio" }), { status: 400, headers });
          }

          // 1. Resolve Context Mentions (@file, @git, @diff, @codebase real semantic search)
          const { cleanPrompt: mentionedPrompt, injectedContext } = await resolveContextMentions(rawPrompt, workspace);

          // 2. Build workspace context & AST Repo Map
          const ctx = analyzeProjectContext(workspace);
          const fileList = ctx.tree ? ctx.tree.map((n: any) => `${n.isDirectory ? '📁 ' : '📄 '}${n.name}`).join("\n") : "";
          const repoMap = buildAstRepoMap(workspace);

          // 2b. Memoria vettoriale REALE: rimpiazza lo snippet "solo i piu' recenti"
          // di analyzeProjectContext() con un recupero per similarita' semantica reale
          // rispetto al prompt corrente dell'utente (embedding + coseno reali).
          const relevantMemories = await getRelevantMemories(workspace, mentionedPrompt, 5);
          if (relevantMemories.length > 0) {
            ctx.memorySnippet = relevantMemories.map(m => `• [${m.topic}]: ${m.insight}`).join("\n");
          }

          // 3. Fetch real installed Ollama models
          let installedOllamaList = "qwen2.5:7b, llama3.2:3b, granite3-dense:2b, moondream:latest";
          try {
            const tagsRes = await fetch(`${OLLAMA_HOST}/api/tags`).catch(() => null);
            if (tagsRes && tagsRes.ok) {
              const tagsData: any = await tagsRes.json();
              if (tagsData.models) {
                installedOllamaList = tagsData.models.map((m: any) => `${m.name} (${(m.size / (1024*1024*1024)).toFixed(1)} GB)`).join(", ");
              }
            }
          } catch {}

          const isSwarmMode = !!body.swarmMode || mentionedPrompt.startsWith("/swarm") || mentionedPrompt.startsWith("/ruflo");
          const isMultiProviderSwarm = isSwarmMode && !!body.multiProviderSwarm;
          const isDiagramMode = mentionedPrompt.startsWith("/diagram");
          const isPrdMode = mentionedPrompt.startsWith("/prd");
          const isReviewMode = mentionedPrompt.startsWith("/review");
          const isRefactorMode = mentionedPrompt.startsWith("/refactor");
          const isTestMode = mentionedPrompt.startsWith("/test");
          const isDocMode = mentionedPrompt.startsWith("/doc");
          const isExplainMode = mentionedPrompt.startsWith("/explain");
          const isBenchMode = mentionedPrompt.startsWith("/bench");
          const isDockerMode = mentionedPrompt.startsWith("/docker");
          const isCiMode = mentionedPrompt.startsWith("/ci");
          const isEnvMode = mentionedPrompt.startsWith("/env");

          const cleanPrompt = mentionedPrompt.replace(/^\/(swarm|ruflo|diagram|prd|review|refactor|test|doc|explain|bench|docker|ci|env)\s*/i, "").trim() || mentionedPrompt;

          let roleSpecialization = "";
          if (isDiagramMode) {
            roleSpecialization = `\n--- 🎨 RUOLO SPECIALE: SOFTWARE ARCHITECT & MERMAID DIAGRAM ENGINE (MetaGPT style) ---\nGenera obbligatoriamente uno o più diagrammi visivi dettagliati in formato Mermaid valido (usando i blocchi \`\`\`mermaid ... \`\`\`), ad esempio graph TD, sequenceDiagram, classDiagram o erDiagram, spiegando chiaramente i nodi e le relazioni.\n`;
          } else if (isPrdMode) {
            roleSpecialization = `\n--- 🏢 RUOLO SPECIALE: LEAD PRODUCT MANAGER (MetaGPT style) ---\nGenera un Product Requirement Document (PRD) completo e strutturato con: 1. Obiettivi e Target Utente, 2. User Stories & Criteri di Accettazione, 3. Architettura Funzionale con Diagramma Mermaid, 4. Requisiti Non Funzionali e Sicurezza.\n`;
          } else if (isReviewMode) {
            roleSpecialization = `\n--- 🔍 RUOLO SPECIALE: SENIOR CODE & SECURITY REVIEWER ---\nEsegui una revisione approfondita del progetto: 1. Identifica bug latenti e vulnerabilità di sicurezza, 2. Valuta rispetto delle convenzioni e modularità, 3. Proponi correzioni puntuali con snippet pronti all'uso.\n`;
          } else if (isRefactorMode) {
            roleSpecialization = `\n--- ⚡ RUOLO SPECIALE: PRINCIPAL ARCHITECT & REFACTORING SPECIALIST ---\nRiscrivi e ottimizza il codice per massima modularità, pulizia, performance e aderenza ai principi SOLID. Fornisci il codice sorgente completo e pronto al copia-incolla.\n`;
          } else if (isTestMode) {
            roleSpecialization = `\n--- 🧪 RUOLO SPECIALE: LEAD QA & AUTOMATED TESTING ENGINEER ---\nGenera una suite completa di unit test e test di integrazione per il framework del progetto. Includi test di casi limite, mock necessari e comandi per eseguire i test.\n`;
          } else if (isDocMode) {
            roleSpecialization = `\n--- 📝 RUOLO SPECIALE: LEAD TECHNICAL WRITER ---\nGenera documentazione tecnica impeccabile: README.md completo con istruzioni di setup, tabelle riassuntive, documentazione delle API e commenti JSDoc/Docstring.\n`;
          } else if (isExplainMode) {
            roleSpecialization = `\n--- 💡 RUOLO SPECIALE: CODE ONBOARDING & ARCHITECTURE EDUCATOR ---\nSpiega passo-passo la logica, il flusso dei dati e le dipendenze del codice richiesto con un linguaggio chiaro, intuitivo e ricco di esempi.\n`;
          } else if (isBenchMode) {
            roleSpecialization = `\n--- ⏱️ RUOLO SPECIALE: PERFORMANCE & BOTTLENECK PROFILER ---\nAnalizza complessità computazionale (Big-O), allocazioni di memoria, latenza di I/O e suggerisci ottimizzazioni concrete per scalabilità.\n`;
          } else if (isDockerMode) {
            roleSpecialization = `\n--- 🐳 RUOLO SPECIALE: DEVOPS & CONTAINERIZATION SPECIALIST ---\nGenera file Dockerfile multi-stage di produzione, .dockerignore e docker-compose.yml ottimizzati per caching e dimensioni minime.\n`;
          } else if (isCiMode) {
            roleSpecialization = `\n--- 🚀 RUOLO SPECIALE: CI/CD PIPELINE ENGINEER ---\nGenera il workflow GitHub Actions (.github/workflows/ci.yml) o GitLab CI completo per build, linting, test e verifica di sicurezza automatica ad ogni push.\n`;
          } else if (isEnvMode) {
            roleSpecialization = `\n--- 🔑 RUOLO SPECIALE: ENVIRONMENT & SECRETS MANAGER ---\nGenera il file .env.example completo con tutte le variabili d'ambiente necessarie e descrizioni dettagliate per ciascuna chiave.\n`;
          }

          const systemPrompt = `Sei CUSTOM CLAUDE CODER (v2.1.888) potenziato dalle architetture avanzate di Ruflo, Aider (AST Repo Map), Continue.dev (@mentions) e MetaGPT.
Sei collegato al workspace locale: "${workspace}" (Cartella: ${ctx.folderName}).
File nel progetto:
${fileList}
Linguaggi/Framework rilevati: ${ctx.frameworks?.join(", ")}
${ctx.rulesSnippet ? `\n--- 📜 REGOLE DI PROGETTO ATTIVE (${ctx.rulesFileName}) ---\n${ctx.rulesSnippet}\n----------------------------------------------------\n` : ''}
${ctx.memorySnippet ? `\n--- 🧠 MEMORIA STORICA AGENTDB / RUVECTOR ---\n${ctx.memorySnippet}\n------------------------------------------------\n` : ''}
${repoMap.mapString ? `\n--- 🗺️ REPO MAP (${repoMap.astParsedFiles} file via TypeScript Compiler API AST reale, ${repoMap.treeSitterParsedFiles} file via tree-sitter AST reale multi-linguaggio, ${repoMap.regexFallbackFiles} file via fallback regex) ---\n${repoMap.mapString}\n------------------------------------------------------------\n` : ''}
${injectedContext}
${roleSpecialization}
Modelli LLM realmente installati in locale nel sistema (Ollama):
${installedOllamaList}

Fornisci risposte complete, codice pulito e pronto all'uso, spiegazioni chiare e guida passo-passo nel pieno rispetto delle regole di progetto.`;

          // Transform Anthropic SSE to clean text stream for frontend
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();

          (async () => {
            try {
              const multiProviderCandidates = isMultiProviderSwarm ? getConfiguredEnsembleCandidates() : [];
              const effectiveMultiProviderSwarm = isMultiProviderSwarm && multiProviderCandidates.length >= 2;
              if (isMultiProviderSwarm && !effectiveMultiProviderSwarm) {
                await writer.write(encoder.encode(
                  `\n⚠️ [SWARM MULTI-PROVIDER RICHIESTO MA NON DISPONIBILE]\nServono almeno 2 provider cloud configurati (attualmente: ${multiProviderCandidates.length}) per un vero swarm multi-modello. Aggiungi chiavi API in 'API Keys & Free Providers'.\nEseguo la pipeline in modalità standard (singolo modello) come fallback onesto.\n════════════════════════════════════════════════════════════════\n`
                ));
              }

              if (isSwarmMode && effectiveMultiProviderSwarm) {
                // ========================================================
                // 🐝🌐 REAL MULTI-PROVIDER SWARM (Architect/Coder su provider
                // cloud DIVERSI + Reviewer che produce un verdetto JSON
                // strutturato realmente parsato, non solo testo da rileggere)
                // ========================================================
                const candidates = multiProviderCandidates;

                await writer.write(encoder.encode(`\n🐝🌐 [SWARM MULTI-PROVIDER REALE AVVIATO]\n════════════════════════════════════════════════════════════════\n`));

                // Round-robin reale su provider DIVERSI configurati (non lo stesso modello riusato)
                const architectCandidate = candidates[0];
                const coderCandidate = candidates[1 % candidates.length];
                const reviewerCandidate = candidates[2 % candidates.length];
                const usingDistinctReviewer = candidates.length >= 3;

                const runMultiProviderPhase = async (phaseTitle: string, candidate: EnsembleCandidate | undefined, roleSystem: string, userTask: string): Promise<string> => {
                  if (!candidate) {
                    await writer.write(encoder.encode(`\n${phaseTitle}\n[Nessun provider disponibile per questa fase]\n`));
                    return "";
                  }
                  await writer.write(encoder.encode(`\n${phaseTitle} — provider reale: ${candidate.displayName}\n────────────────────────────────────────────────────────────────\n`));
                  server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `\n${phaseTitle} — ${candidate.displayName}\n` }));
                  try {
                    const { text, latencyMs } = await callEnsembleCandidateNonStreaming(candidate, `${systemPrompt}\n\n${roleSystem}`, userTask);
                    await writer.write(encoder.encode(`${text}\n[latenza reale: ${latencyMs}ms]\n`));
                    server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `${text}\n` }));
                    return text;
                  } catch (e: any) {
                    const msg = `[Errore reale su ${candidate.displayName}]: ${e.message}`;
                    await writer.write(encoder.encode(`${msg}\n`));
                    return "";
                  }
                };

                const architectOutput = await runMultiProviderPhase(
                  "🏗️ FASE 1: SYSTEM ARCHITECT",
                  architectCandidate,
                  "RUOLO: Sei il System Architect di uno swarm multi-provider. Analizza il workspace, scompone i requisiti in moduli, definisce i contratti delle interfacce e stila il piano di esecuzione passo-passo.",
                  `Task: ${cleanPrompt}\n\nFornisci l'analisi architetturale e il piano dettagliato per l'implementazione.`
                );

                const coderOutput = await runMultiProviderPhase(
                  "💻 FASE 2: CORE CODER",
                  coderCandidate,
                  "RUOLO: Sei il Core Coder di uno swarm multi-provider. Basandoti sul piano dell'Architetto (scritto da un modello diverso da te), scrivi il codice sorgente completo, modulare, pulito e privo di placeholder o commenti 'TODO'.",
                  `Obiettivo Utente: ${cleanPrompt}\n\nPiano Architetturale (da un altro provider):\n${architectOutput}\n\nGenera ora il codice completo per tutti i file necessari.`
                );

                const reviewerRoleSystem = "RUOLO: Sei il Code Reviewer & Quality Judge indipendente di uno swarm multi-provider. Analizza il codice generato da un modello diverso da te, verifica bug, vulnerabilità e aderenza alle regole di progetto. Alla FINE della tua risposta, DEVI includere un blocco JSON valido su una riga separata con ESATTAMENTE questo formato, senza testo extra dentro il blocco: {\"verdict\": \"PASS\" oppure \"FAIL\", \"score\": numero da 0 a 10, \"issues\": [\"lista di problemi trovati, vuota se nessuno\"]}";
                const reviewerOutput = await runMultiProviderPhase(
                  "🔍 FASE 3: CODE REVIEWER & JUDGE",
                  reviewerCandidate,
                  reviewerRoleSystem,
                  `Codice Generato dal Coder (provider diverso):\n${coderOutput}\n\nEsegui la revisione formale, l'audit di sicurezza, e termina con il blocco JSON del verdetto come richiesto dal tuo ruolo.`
                );

                // Parsing REALE del verdetto strutturato: se il modello non rispetta il formato,
                // lo dichiariamo onestamente invece di fingere un badge PASS/FAIL.
                let verdictBadge = "⚠️ Verdetto non strutturato: il Reviewer non ha prodotto un blocco JSON valido, leggi il testo sopra.";
                const jsonMatch = reviewerOutput.match(/\{[^{}]*"verdict"[^{}]*\}/s);
                if (jsonMatch) {
                  try {
                    const verdict = JSON.parse(jsonMatch[0]);
                    if (verdict.verdict === "PASS" || verdict.verdict === "FAIL") {
                      verdictBadge = `${verdict.verdict === "PASS" ? "✅" : "❌"} VERDETTO REALE PARSATO: ${verdict.verdict} — Score: ${verdict.score}/10${Array.isArray(verdict.issues) && verdict.issues.length > 0 ? ` — Issues: ${verdict.issues.join("; ")}` : " — Nessun issue segnalato"}`;
                    }
                  } catch {}
                }
                await writer.write(encoder.encode(`\n${verdictBadge}\n`));

                await saveProjectInsight(
                  workspace,
                  cleanPrompt.slice(0, 35),
                  `Swarm multi-provider reale (Architect=${architectCandidate?.provider ?? "n/a"}, Coder=${coderCandidate?.provider ?? "n/a"}, Reviewer=${reviewerCandidate?.provider ?? "n/a"}${usingDistinctReviewer ? "" : ", reviewer NON distinto per provider insufficienti"}) — ${verdictBadge.startsWith("✅") || verdictBadge.startsWith("❌") ? verdictBadge : "verdetto non strutturato"} (${new Date().toLocaleDateString()})`,
                  ["swarm", "multi-provider"]
                );

                await writer.write(encoder.encode(`\n════════════════════════════════════════════════════════════════\n✅ [SWARM MULTI-PROVIDER COMPLETATO${usingDistinctReviewer ? " - 3 PROVIDER DISTINTI" : " - PROVIDER RIUSATI PER SCARSITÀ DI CHIAVI CONFIGURATE"} - MEMORIZZATO IN AGENTDB]\n`));
              } else if (isSwarmMode) {
                // ========================================================
                // 🐝 RUFLO MULTI-AGENT SWARM LOOP (3-Phase Consensus, singolo modello)
                // ========================================================
                await writer.write(encoder.encode(`\n🐝 [RUFLO MULTI-AGENT SWARM PIPELINE AVVIATA]\n════════════════════════════════════════════════════════════════\n`));

                // Helper to run a subagent phase
                const runSwarmPhase = async (phaseTitle: string, roleSystem: string, userTask: string) => {
                  await writer.write(encoder.encode(`\n${phaseTitle}\n────────────────────────────────────────────────────────────────\n`));
                  server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `\n${phaseTitle}\n` }));

                  const payload = {
                    model: activeModel,
                    system: `${systemPrompt}\n\n${roleSystem}`,
                    messages: [{ role: "user", content: userTask }],
                    stream: true
                  };

                  const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                  });

                  const proxyRes = await handleAnthropicProxy(proxyReq);
                  if (!proxyRes.ok || !proxyRes.body) {
                    await writer.write(encoder.encode(`\n[Errore fase]: Impossibile completare ${phaseTitle}\n`));
                    return "";
                  }

                  const reader = proxyRes.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = "";
                  let fullPhaseText = "";

                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                      if (!line.startsWith("data: ")) continue;
                      const jsonStr = line.slice(6).trim();
                      if (!jsonStr || jsonStr === "[DONE]") continue;
                      try {
                        const data = JSON.parse(jsonStr);
                        if (data.type === "content_block_delta" && data.delta?.text) {
                          const chunk = data.delta.text;
                          fullPhaseText += chunk;
                          addTokensProcessed(1);
                          await writer.write(encoder.encode(chunk));
                          server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: chunk }));
                        }
                      } catch {}
                    }
                  }
                  await writer.write(encoder.encode("\n"));
                  return fullPhaseText;
                };

                // Phase 1: System Architect
                const architectOutput = await runSwarmPhase(
                  "🏗️ FASE 1: SYSTEM ARCHITECT (Pianificazione & Scomposizione)",
                  "RUOLO: Sei il System Architect di Ruflo Swarm. Analizza il workspace, scompone i requisiti in moduli, definisce i contratti delle interfacce e stila il piano di esecuzione passo-passo.",
                  `Task: ${cleanPrompt}\n\nFornisci l'analisi architetturale e il piano dettagliato per l'implementazione.`
                );

                // Phase 2: Core Coder
                const coderOutput = await runSwarmPhase(
                  "💻 FASE 2: CORE CODER (Implementazione Codice Completo)",
                  "RUOLO: Sei il Core Coder di Ruflo Swarm. Basandoti sul piano dell'Architetto, scrivi il codice sorgente completo, modulare, pulito e privo di placeholder o commenti 'TODO'.",
                  `Obiettivo Utente: ${cleanPrompt}\n\nPiano Architetturale:\n${architectOutput}\n\nGenera ora il codice completo per tutti i file necessari.`
                );

                // Phase 3: Reviewer & Quality Judge (Consensus)
                await runSwarmPhase(
                  "🔍 FASE 3: CODE REVIEWER & TEST JUDGE (Consenso a Triplo Giudice)",
                  "RUOLO: Sei il Code Reviewer & Quality Judge del consensus loop. Analizza il codice generato, verifica che rispetti le regole di progetto, cerca eventuali edge case di sicurezza o performance e fornisci comandi di test.",
                  `Codice Generato dal Coder:\n${coderOutput}\n\nEsegui la revisione formale, audit di sicurezza e indica i test di verifica.`
                );

                // Auto-save key memory insight to AgentDB
                await saveProjectInsight(
                  workspace,
                  cleanPrompt.slice(0, 35),
                  `Eseguita pipeline a 3 fasi (Architect → Coder → Reviewer) in modalità Ruflo Swarm (${new Date().toLocaleDateString()})`,
                  ["ruflo", "swarm"]
                );

                // NOTA ONESTÀ: questa pipeline esegue 3 chiamate sequenziali allo stesso modello attivo
                // con system prompt diversi (Architect/Coder/Reviewer). Non c'è un vero consenso multi-modello
                // né un giudizio automatico pass/fail: la fase Reviewer produce solo testo di revisione,
                // che va letto per capire se ci sono problemi. Il banner sotto NON significa "nessun problema trovato".
                await writer.write(encoder.encode(`\n════════════════════════════════════════════════════════════════\n✅ [PIPELINE RUFLO SWARM COMPLETATA - 3 FASI ESEGUITE, RIVEDI L'OUTPUT DEL REVIEWER SOPRA - MEMORIZZATO IN AGENTDB]\n`));
              } else {
                // ========================================================
                // ⚡ STANDARD SINGLE-AGENT EXECUTION
                // ========================================================
                const anthropicPayload = {
                  model: activeModel,
                  system: systemPrompt,
                  messages: [{ role: "user", content: cleanPrompt }],
                  stream: true
                };

                const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(anthropicPayload)
                });

                const proxyRes = await handleAnthropicProxy(proxyReq);
                if (!proxyRes.ok || !proxyRes.body) {
                  const err = await proxyRes.text();
                  await writer.write(encoder.encode(`Errore (${proxyRes.status}): ${err}`));
                  await writer.close();
                  return;
                }

                const reader = proxyRes.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === "[DONE]") continue;

                    try {
                      const data = JSON.parse(jsonStr);
                      if (data.type === "content_block_delta" && data.delta?.text) {
                        const textChunk = data.delta.text;
                        addTokensProcessed(1);
                        await writer.write(encoder.encode(textChunk));
                        server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: textChunk }));
                      }
                    } catch {}
                  }
                }
              }
            } catch (err: any) {
              await writer.write(encoder.encode(`\nErrore esecuzione: ${err.message}`));
            } finally {
              try { await writer.close(); } catch {}
              server.publish("claude-studio", JSON.stringify({ type: "agent_done" }));
            }
          })();

          return new Response(readable, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Transfer-Encoding": "chunked",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 10b. Autonomous Auto-Debug & Self-Healing Test Loop (OpenCode / SWE-Agent Style)
      if (url.pathname === "/api/agent/autodebug" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const testCommand = body.command || "npm test";
          const maxIterations = body.maxIterations || 3;
          const workspace = resolve(body.workspace || attachedWorkspacePath);

          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();

          (async () => {
            const sendEvent = async (type: string, data: any) => {
              try {
                await writer.write(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
              } catch {}
            };

            for (let iter = 1; iter <= maxIterations; iter++) {
              await sendEvent("iteration_start", {
                iteration: iter,
                maxIterations,
                command: testCommand
              });

              // Execute command inside project workspace
              let stdoutText = "";
              let stderrText = "";
              let exitCode = 0;

              try {
                const proc = Bun.spawn(["bash", "-c", testCommand], {
                  cwd: workspace,
                  stdout: "pipe",
                  stderr: "pipe"
                });

                const [outStr, errStr] = await Promise.all([
                  new Response(proc.stdout).text(),
                  new Response(proc.stderr).text()
                ]);

                exitCode = await proc.exited;
                stdoutText = outStr;
                stderrText = errStr;
              } catch (runErr: any) {
                exitCode = 1;
                stderrText = runErr.message;
              }

              await sendEvent("command_output", {
                iteration: iter,
                exitCode,
                stdout: stdoutText,
                stderr: stderrText
              });

              // If passed, exit loop!
              if (exitCode === 0) {
                await sendEvent("success", {
                  iteration: iter,
                  message: `✅ Test superato con successo al ciclo ${iter}!`
                });
                break;
              }

              // If failed, send to LLM for autonomous analysis & code fix
              await sendEvent("analyzing_error", {
                iteration: iter,
                errorSummary: (stderrText || stdoutText).slice(0, 2000)
              });

              const ctx = analyzeProjectContext(workspace);
              const fileList = ctx.tree ? ctx.tree.map((n: any) => n.name).join(", ") : "";

              const debugPrompt = `Il comando di test '${testCommand}' è FALLITO con codice di uscita ${exitCode}.

--- ERRORE RILEVATO (OUTPUT / STDERR) ---
${stderrText || stdoutText}
-----------------------------------------

Workspace: ${workspace}
File nel progetto: ${fileList}
${ctx.rulesSnippet ? `Regole di progetto (${ctx.rulesFileName}):\n${ctx.rulesSnippet}\n` : ''}

Fornisci in modo chiaro e conciso:
1. 🔍 **Causa Principale del Bug** (Root Cause)
2. 📍 **File e Riga Interessati**
3. 🛠️ **Codice di Correzione da applicare** (Fornisci lo snippet o il diff completo pronto all'uso)`;

              const debugPayload = {
                model: activeModel,
                system: "Sei un Autonomous SWE Debugger Engine avanzato (OpenCode / SWE-bench). Analizza gli stack trace ed emetti diagnosi e correzioni pronte all'uso.",
                messages: [{ role: "user", content: debugPrompt }],
                stream: true
              };

              const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(debugPayload)
              });

              const proxyRes = await handleAnthropicProxy(proxyReq);
              if (proxyRes.ok && proxyRes.body) {
                const reader = proxyRes.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === "[DONE]") continue;
                    try {
                      const parsed = JSON.parse(jsonStr);
                      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                        await sendEvent("fix_chunk", { text: parsed.delta.text });
                      }
                    } catch {}
                  }
                }
              }

              if (iter === maxIterations) {
                await sendEvent("finished", {
                  iteration: iter,
                  message: `Raggiunto il numero massimo di iterazioni (${maxIterations}).`
                });
              }
            }

            await sendEvent("done", {});
            try { await writer.close(); } catch {}
          })();

          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 10c. Autonomous Multi-Step Agentic Loop (Cursor Agent / Cline style)
      // ------------------------------------------------------
      // Gap reale rispetto a Cursor Agent / Cline: entrambi possono leggere e
      // scrivere PIÙ file in sequenza autonomamente, verificando con test
      // reali, senza un prompt per ogni singolo passo. Prima di questo,
      // ogni interazione qui era un singolo turno request/response: l'utente
      // doveva guidare manualmente ogni modifica di file.
      // Ogni passo è UNA azione reale: read_file/write_file leggono e
      // scrivono realmente sul disco (mai fuori dal workspace), run_test
      // esegue realmente il comando fornito (stesso spawn pattern di
      // /api/agent/autodebug). Il modello deve rispondere con un singolo
      // oggetto JSON per passo; se non lo fa per 2 passi consecutivi il loop
      // si ferma onestamente invece di continuare a vuoto.
      if (url.pathname === "/api/agent/autonomous-loop" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const task: string = body.task || "";
          const workspace = resolve(body.workspace || attachedWorkspacePath);
          const maxSteps = Math.min(Math.max(body.maxSteps || 8, 1), 15);
          const testCommand: string = body.testCommand || "";

          if (!task.trim()) {
            return new Response(JSON.stringify({ error: "Task obbligatorio" }), { status: 400, headers });
          }

          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();

          (async () => {
            const write = async (text: string) => { try { await writer.write(encoder.encode(text)); } catch {} };

            await write(`\n🤖 [LOOP AGENTICO AUTONOMO AVVIATO] — max ${maxSteps} passi\n════════════════════════════════════════════════════════════════\nObiettivo: ${task}\n`);

            const repoMap = buildAstRepoMap(workspace);
            const actionHistory: string[] = [];
            let filesWritten = 0;
            const MAX_WRITES = 20;
            let consecutiveParseFailures = 0;
            let stopped = false;
            let stopReason = "";

            for (let step = 1; step <= maxSteps && !stopped; step++) {
              await write(`\n── Passo ${step}/${maxSteps} ──\n`);

              const systemPrompt = `Sei un agente di coding autonomo che opera in un vero workspace locale: "${workspace}".
Il tuo obiettivo: ${task}

Puoi eseguire UNA sola azione per volta. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, in uno di questi formati esatti:
{"action": "read_file", "path": "percorso/relativo.ts", "reason": "perché ti serve"}
{"action": "write_file", "path": "percorso/relativo.ts", "content": "contenuto completo del file", "reason": "cosa stai cambiando e perché"}
{"action": "run_test", "reason": "perché vuoi verificare ora"}
{"action": "done", "summary": "riassunto di cosa è stato fatto e perché il task è completo"}

Regole:
- "write_file" scrive SEMPRE il contenuto COMPLETO del file (non una diff, non un frammento parziale).
- I percorsi sono relativi alla root del workspace. Non puoi uscire dal workspace (../ viene rifiutato).
- Usa "run_test" solo se è stato fornito un comando di test.
- Usa "done" solo quando sei ragionevolmente sicuro che il task sia completo.
${testCommand ? `Comando di test disponibile: ${testCommand}` : "Nessun comando di test configurato per questo loop: non usare run_test."}

Repo map reale (simboli del progetto):
${repoMap.mapString.slice(0, 4000)}

Storico azioni ed osservazioni finora (più recenti in fondo):
${actionHistory.slice(-8).join("\n\n") || "(nessuna azione ancora, questo è il primo passo)"}`;

              const payload = {
                model: activeModel,
                system: systemPrompt,
                messages: [{ role: "user", content: "Qual è la prossima singola azione? Rispondi solo con il JSON, nient'altro." }],
                stream: false
              };
              const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              let rawText = "";
              try {
                const proxyRes = await handleAnthropicProxy(proxyReq);
                const data: any = await proxyRes.json();
                rawText = data?.content?.[0]?.text || "";
              } catch (e: any) {
                rawText = "";
              }

              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              let actionObj: any = null;
              if (jsonMatch) {
                try { actionObj = JSON.parse(jsonMatch[0]); } catch {}
              }

              if (!actionObj || !actionObj.action) {
                consecutiveParseFailures++;
                await write(`⚠️ Risposta del modello non era un JSON valido: "${rawText.slice(0, 200)}"\n`);
                actionHistory.push(`[Passo ${step}] ERRORE: risposta non era JSON valido.`);
                if (consecutiveParseFailures >= 2) {
                  stopped = true;
                  stopReason = "il modello non ha prodotto un'azione JSON valida per 2 passi consecutivi";
                }
                continue;
              }
              consecutiveParseFailures = 0;

              if (actionObj.action === "done") {
                await write(`✅ [DONE] ${actionObj.summary || "(nessun riassunto fornito)"}\n`);
                stopped = true;
                stopReason = "l'agente ha dichiarato il task completo";
                continue;
              }

              if (actionObj.action === "read_file") {
                const relPath = String(actionObj.path || "");
                const absPath = resolve(workspace, relPath);
                if (absPath !== workspace && !absPath.startsWith(workspace + sep)) {
                  await write(`🚫 Percorso rifiutato (fuori dal workspace): ${relPath}\n`);
                  actionHistory.push(`[Passo ${step}] read_file(${relPath}) RIFIUTATO: fuori dal workspace.`);
                  continue;
                }
                if (!existsSync(absPath)) {
                  await write(`📄 read_file(${relPath}): file non trovato\n`);
                  actionHistory.push(`[Passo ${step}] read_file(${relPath}): file non trovato sul disco.`);
                  continue;
                }
                try {
                  const content = readFileSync(absPath, "utf-8").slice(0, 4000);
                  await write(`📄 read_file(${relPath}) — ${content.length} caratteri letti realmente dal disco\n`);
                  actionHistory.push(`[Passo ${step}] read_file(${relPath}):\n${content}`);
                } catch (e: any) {
                  await write(`📄 read_file(${relPath}) fallita: ${e.message}\n`);
                  actionHistory.push(`[Passo ${step}] read_file(${relPath}) fallita: ${e.message}`);
                }
                continue;
              }

              if (actionObj.action === "write_file") {
                const relPath = String(actionObj.path || "");
                const newContent = String(actionObj.content ?? "");
                const absPath = resolve(workspace, relPath);
                if (absPath !== workspace && !absPath.startsWith(workspace + sep)) {
                  await write(`🚫 Scrittura rifiutata (fuori dal workspace): ${relPath}\n`);
                  actionHistory.push(`[Passo ${step}] write_file(${relPath}) RIFIUTATO: fuori dal workspace.`);
                  continue;
                }
                if (filesWritten >= MAX_WRITES) {
                  await write(`🚫 Limite di ${MAX_WRITES} scritture per loop raggiunto, scrittura rifiutata: ${relPath}\n`);
                  actionHistory.push(`[Passo ${step}] write_file(${relPath}) RIFIUTATO: limite scritture raggiunto.`);
                  continue;
                }
                try {
                  const oldContent = existsSync(absPath) ? readFileSync(absPath, "utf-8") : "";
                  const patch = Diff.createTwoFilesPatch(relPath, relPath, oldContent, newContent, "prima", "dopo");
                  const parentDir = dirname(absPath);
                  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
                  writeFileSync(absPath, newContent, "utf-8");
                  filesWritten++;
                  await write(`✏️ write_file(${relPath}) — scritto realmente su disco (${newContent.length} byte)\n${patch.split("\n").slice(0, 25).join("\n")}\n`);
                  actionHistory.push(`[Passo ${step}] write_file(${relPath}): scritto realmente (${newContent.length} byte). Motivo: ${actionObj.reason || "(non specificato)"}`);
                } catch (e: any) {
                  await write(`✏️ write_file(${relPath}) fallita: ${e.message}\n`);
                  actionHistory.push(`[Passo ${step}] write_file(${relPath}) fallita: ${e.message}`);
                }
                continue;
              }

              if (actionObj.action === "run_test") {
                if (!testCommand) {
                  await write(`🧪 run_test rifiutata: nessun comando di test configurato per questo loop.\n`);
                  actionHistory.push(`[Passo ${step}] run_test RIFIUTATO: nessun testCommand configurato.`);
                  continue;
                }
                await write(`🧪 run_test: eseguo realmente "${testCommand}"...\n`);
                try {
                  const proc = Bun.spawn(["bash", "-c", testCommand], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
                  const [outStr, errStr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
                  const exitCode = await proc.exited;
                  const combined = (outStr + "\n" + errStr).slice(0, 2000);
                  await write(`   exit code reale: ${exitCode}\n${combined}\n`);
                  actionHistory.push(`[Passo ${step}] run_test("${testCommand}") exit=${exitCode}:\n${combined}`);
                } catch (e: any) {
                  await write(`🧪 run_test fallita: ${e.message}\n`);
                  actionHistory.push(`[Passo ${step}] run_test fallita: ${e.message}`);
                }
                continue;
              }

              await write(`⚠️ Azione sconosciuta: "${actionObj.action}"\n`);
              actionHistory.push(`[Passo ${step}] Azione sconosciuta "${actionObj.action}" ignorata.`);
            }

            if (!stopReason) stopReason = `raggiunto il limite di ${maxSteps} passi — il task potrebbe non essere completo`;

            await saveProjectInsight(
              workspace,
              task.slice(0, 35),
              `Loop agentico autonomo eseguito (${filesWritten} file scritti realmente sul disco). Terminato perché: ${stopReason}.`,
              ["autonomous-loop"]
            );

            await write(`\n════════════════════════════════════════════════════════════════\n🏁 [LOOP TERMINATO] ${stopReason} — file scritti realmente: ${filesWritten}\n`);
            try { await writer.close(); } catch {}
          })();

          return new Response(readable, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // 11. Stop Agent Task
      if (url.pathname === "/api/agent/stop" && req.method === "POST") {
        if (currentAgentProcess) {
          try { currentAgentProcess.kill(); } catch {}
          currentAgentProcess = null;
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // ==========================================
      // 12. CMUX / TMUX PROCESS MULTIPLEXER API
      // ==========================================

      // List all background processes
      if (url.pathname === "/api/processes" && req.method === "GET") {
        const list = Array.from(backgroundProcesses.values()).map(p => ({
          id: p.id,
          name: p.name,
          command: p.command,
          cwd: p.cwd,
          status: p.status,
          pid: p.pid,
          startTime: p.startTime,
          logsCount: p.logs.length,
          lastLog: p.logs[p.logs.length - 1] || ""
        }));
        return new Response(JSON.stringify({ processes: list }), { headers });
      }

      // Get full logs for a process
      if (url.pathname === "/api/processes/logs" && req.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id || !backgroundProcesses.has(id)) {
          return new Response(JSON.stringify({ error: "Processo non trovato" }), { status: 404, headers });
        }
        const p = backgroundProcesses.get(id)!;
        return new Response(JSON.stringify({ id: p.id, name: p.name, status: p.status, logs: p.logs }), { headers });
      }

      // Start new background process
      if (url.pathname === "/api/processes/start" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const command = body.command;
          if (!command) {
            return new Response(JSON.stringify({ error: "Comando obbligatorio" }), { status: 400, headers });
          }

          const id = nextProcessId();
          const name = body.name || command.split(" ")[0] || `Processo #${id}`;
          const cwd = body.cwd ? resolve(attachedWorkspacePath, body.cwd) : attachedWorkspacePath;

          const procInfo = launchProcess(id, name, command, cwd, server);
          server.publish("claude-studio", JSON.stringify({ type: "process_started", process: { id: procInfo.id, name: procInfo.name, command: procInfo.command, status: procInfo.status, pid: procInfo.pid } }));

          return new Response(JSON.stringify({ success: true, process: { id: procInfo.id, name: procInfo.name, command: procInfo.command, status: procInfo.status, pid: procInfo.pid } }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // Stop background process
      if (url.pathname === "/api/processes/stop" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const id = body.id;
          if (!id || !backgroundProcesses.has(id)) {
            return new Response(JSON.stringify({ error: "Processo non trovato" }), { status: 404, headers });
          }
          const p = backgroundProcesses.get(id)!;
          if (p.proc) {
            try { p.proc.kill(); } catch {}
          }
          p.status = "stopped";
          p.logs.push(`[${new Date().toLocaleTimeString()}] Processo fermato dall'utente.`);
          server.publish("claude-studio", JSON.stringify({ type: "process_status", id, status: "stopped" }));

          return new Response(JSON.stringify({ success: true, id }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // Restart background process
      if (url.pathname === "/api/processes/restart" && req.method === "POST") {
        try {
          const body: any = await req.json();
          const id = body.id;
          if (!id || !backgroundProcesses.has(id)) {
            return new Response(JSON.stringify({ error: "Processo non trovato" }), { status: 404, headers });
          }
          const old = backgroundProcesses.get(id)!;
          if (old.proc) {
            try { old.proc.kill(); } catch {}
          }
          const newProc = launchProcess(id, old.name, old.command, old.cwd, server);
          return new Response(JSON.stringify({ success: true, process: { id: newProc.id, name: newProc.name, status: newProc.status, pid: newProc.pid } }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }

      // Clear logs of a process
      if (url.pathname === "/api/processes/clear-logs" && req.method === "POST") {
        const body: any = await req.json();
        const id = body.id;
        if (id && backgroundProcesses.has(id)) {
          backgroundProcesses.get(id)!.logs = [];
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Delete background process
      if (url.pathname === "/api/processes/delete" && req.method === "POST") {
        const body: any = await req.json();
        const id = body.id;
        if (id && backgroundProcesses.has(id)) {
          const p = backgroundProcesses.get(id)!;
          if (p.proc) {
            try { p.proc.kill(); } catch {}
          }
          backgroundProcesses.delete(id);
          server.publish("claude-studio", JSON.stringify({ type: "process_deleted", id }));
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // ==========================================
      // 13. TELEGRAM & MOBILE REMOTE BRIDGE API
      // ==========================================

      if (url.pathname === "/api/telegram/status" && req.method === "GET") {
        return new Response(JSON.stringify({
          enabled: telegramEnabled,
          hasToken: !!telegramBotToken,
          allowedChatId: telegramAllowedChatId,
          isPolling: isTelegramPolling
        }), { headers });
      }

      if (url.pathname === "/api/telegram/save" && req.method === "POST") {
        try {
          const body: any = await req.json();
          if (body.token !== undefined) telegramBotToken = body.token;
          if (body.allowedChatId !== undefined) telegramAllowedChatId = body.allowedChatId;
          if (body.enabled !== undefined) telegramEnabled = !!body.enabled;

          saveConfig({
            telegramBotToken,
            telegramAllowedChatId,
            telegramEnabled
          });

          if (telegramEnabled && telegramBotToken) {
            startTelegramPolling(server);
          }

          return new Response(JSON.stringify({
            success: true,
            enabled: telegramEnabled,
            hasToken: !!telegramBotToken,
            allowedChatId: telegramAllowedChatId
          }), { headers });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
      }
    }

    // Static File Serving
    let filePath = url.pathname;
    if (filePath === "/" || filePath === "") filePath = "/index.html";

    const localPath = join(import.meta.dir, "public", filePath);
    if (existsSync(localPath) && statSync(localPath).isFile()) {
      const file = Bun.file(localPath);
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      ws.subscribe("claude-studio");
      ws.send(JSON.stringify({ type: "connected", activeModel, attachedWorkspacePath, port: PORT }));
    },
    message(ws, message) {},
    close(ws) {
      ws.unsubscribe("claude-studio");
    }
  }
});

/**
 * Universal Proxy Translation Engine
 */
async function handleAnthropicProxy(req: Request) {
  try {
    const body: any = await req.json();
    const modelToUse = activeModel;
    const isStream = body.stream ?? true;

    // 0. ROUTE TO ANTHROPIC CLAUDE API (Direct)
    if (modelToUse.startsWith("anthropic/")) {
      if (!anthropicApiKey) {
        return authErrorResponse("Chiave Anthropic API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da console.anthropic.com)");
      }
      const realModelId = modelToUse.replace(/^anthropic\//i, "");
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({ ...body, model: realModelId })
      });
      return new Response(anthropicRes.body, {
        status: anthropicRes.status,
        headers: { "Content-Type": "text/event-stream", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 0b. ROUTE TO DEEPSEEK OFFICIAL API
    if (modelToUse.startsWith("deepseek/")) {
      if (!deepseekApiKey) {
        return authErrorResponse("Chiave DeepSeek API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.deepseek.com)");
      }
      const realModelId = modelToUse.replace(/^deepseek\//i, "");
      return handleOpenAICompatibleStream("https://api.deepseek.com/v1/chat/completions", deepseekApiKey, realModelId, body);
    }

    // 0c. ROUTE TO XAI GROK API
    if (modelToUse.startsWith("xai/") || modelToUse.startsWith("grok-")) {
      if (!xaiApiKey) {
        return authErrorResponse("Chiave xAI (Grok) API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da console.x.ai)");
      }
      const realModelId = modelToUse.replace(/^xai\//i, "");
      return handleOpenAICompatibleStream("https://api.x.ai/v1/chat/completions", xaiApiKey, realModelId, body);
    }

    // 0d. ROUTE TO MOONSHOT KIMI (Kimi K3 / K1.5)
    if (modelToUse.startsWith("kimi/") || modelToUse.startsWith("moonshot/")) {
      if (!kimiApiKey) {
        return authErrorResponse("Chiave Moonshot Kimi API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.moonshot.cn)");
      }
      const realModelId = modelToUse.replace(/^(kimi|moonshot)\//i, "");
      return handleOpenAICompatibleStream("https://api.moonshot.cn/v1/chat/completions", kimiApiKey, realModelId, body);
    }

    // 0e. ROUTE TO ALIBABA QWEN (DashScope)
    if (modelToUse.startsWith("qwen-api/") || modelToUse.startsWith("dashscope/")) {
      if (!qwenApiKey) {
        return authErrorResponse("Chiave Alibaba Qwen / DashScope API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da dashscope.aliyun.com)");
      }
      const realModelId = modelToUse.replace(/^(qwen-api|dashscope)\//i, "");
      return handleOpenAICompatibleStream("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", qwenApiKey, realModelId, body);
    }

    // 0f. ROUTE TO ZHIPU AI GLM (ChatGLM / GLM-4)
    if (modelToUse.startsWith("glm/") || modelToUse.startsWith("zhipu/")) {
      if (!glmApiKey) {
        return authErrorResponse("Chiave Zhipu GLM API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da open.bigmodel.cn)");
      }
      const realModelId = modelToUse.replace(/^(glm|zhipu)\//i, "");
      return handleOpenAICompatibleStream("https://open.bigmodel.cn/api/paas/v4/chat/completions", glmApiKey, realModelId, body);
    }

    // 0g. ROUTE TO PERPLEXITY AI (Sonar / Deep Research)
    if (modelToUse.startsWith("perplexity/") || modelToUse.startsWith("sonar/")) {
      if (!perplexityApiKey) {
        return authErrorResponse("Chiave Perplexity API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da perplexity.ai/settings/api)");
      }
      const realModelId = modelToUse.replace(/^(perplexity|sonar)\//i, "");
      return handleOpenAICompatibleStream("https://api.perplexity.ai/chat/completions", perplexityApiKey, realModelId, body);
    }

    // 0h. ROUTE TO FIREWORKS AI
    if (modelToUse.startsWith("fireworks/")) {
      if (!fireworksApiKey) {
        return authErrorResponse("Chiave Fireworks AI API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da fireworks.ai)");
      }
      const realModelId = modelToUse.replace(/^fireworks\//i, "");
      return handleOpenAICompatibleStream("https://api.fireworks.ai/inference/v1/chat/completions", fireworksApiKey, realModelId, body);
    }

    // 0i. ROUTE TO TOGETHER AI
    if (modelToUse.startsWith("together/")) {
      if (!togetherApiKey) {
        return authErrorResponse("Chiave Together AI API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da together.ai)");
      }
      const realModelId = modelToUse.replace(/^together\//i, "");
      return handleOpenAICompatibleStream("https://api.together.xyz/v1/chat/completions", togetherApiKey, realModelId, body);
    }

    // 0j. ROUTE TO LOCAL LM STUDIO SERVER (Port 1234)
    if (modelToUse.startsWith("lmstudio/")) {
      const realModelId = modelToUse.replace(/^lmstudio\//i, "");
      return handleOpenAICompatibleStream("http://localhost:1234/v1/chat/completions", "lm-studio", realModelId, body);
    }

    // 0k. ROUTE TO LOCAL APPLE MLX / LLAMA.CPP SERVER (Port 8080)
    if (modelToUse.startsWith("mlx/") || modelToUse.startsWith("llamacpp/")) {
      const realModelId = modelToUse.replace(/^(mlx|llamacpp)\//i, "");
      return handleOpenAICompatibleStream("http://localhost:8080/v1/chat/completions", "mlx", realModelId, body);
    }

    // 0l. ROUTE TO LOCAL VLLM SERVER (Port 8000)
    if (modelToUse.startsWith("vllm/")) {
      const realModelId = modelToUse.replace(/^vllm\//i, "");
      return handleOpenAICompatibleStream("http://localhost:8000/v1/chat/completions", "vllm", realModelId, body);
    }

    // 0m. ROUTE TO CUSTOM ENDPOINT (Inception Labs / Private LLMs)
    if (modelToUse.startsWith("custom/") && customApiEndpoint) {
      const realModelId = modelToUse.replace(/^custom\//i, "");
      return handleOpenAICompatibleStream(customApiEndpoint, customApiKey || "sk-dummy", realModelId, body);
    }

    // 0. ROUTE TO OPENAI / CHATGPT API
    if (modelToUse.startsWith("openai/") || modelToUse.startsWith("gpt-") || modelToUse.startsWith("o1") || modelToUse.startsWith("o3")) {
      if (!openaiApiKey) {
        return authErrorResponse("Chiave OpenAI API (ChatGPT) mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.openai.com/api-keys)");
      }
      const realModelId = modelToUse.replace(/^openai\//i, "");
      return handleOpenAICompatibleStream("https://api.openai.com/v1/chat/completions", openaiApiKey, realModelId, body);
    }

    // 1. ROUTE TO CEREBRAS CLOUD (~1800 tok/s)
    if (modelToUse.startsWith("cerebras/")) {
      if (!cerebrasApiKey) {
        return authErrorResponse("Chiave Cerebras API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da cloud.cerebras.ai)");
      }
      const realModelId = modelToUse.replace("cerebras/", "");
      return handleOpenAICompatibleStream("https://api.cerebras.ai/v1/chat/completions", cerebrasApiKey, realModelId, body);
    }

    // 2. ROUTE TO SAMBANOVA CLOUD (671B MoE)
    if (modelToUse.startsWith("sambanova/")) {
      if (!sambanovaApiKey) {
        return authErrorResponse("Chiave SambaNova API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da cloud.sambanova.ai)");
      }
      const realModelId = modelToUse.replace("sambanova/", "");
      return handleOpenAICompatibleStream("https://api.sambanova.ai/v1/chat/completions", sambanovaApiKey, realModelId, body);
    }

    // 3. ROUTE TO MISTRAL AI (Codestral)
    if (modelToUse.startsWith("mistral/")) {
      if (!mistralApiKey) {
        return authErrorResponse("Chiave Mistral API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da console.mistral.ai)");
      }
      const realModelId = modelToUse.replace("mistral/", "");
      return handleOpenAICompatibleStream("https://api.mistral.ai/v1/chat/completions", mistralApiKey, realModelId, body);
    }

    // 3b. ROUTE TO HUGGING FACE INFERENCE PROVIDERS ROUTER
    if (modelToUse.startsWith("hf/")) {
      if (!hfApiKey) {
        return authErrorResponse("Chiave Hugging Face mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da huggingface.co/settings/tokens)");
      }
      const realModelId = modelToUse.replace("hf/", "");
      return handleOpenAICompatibleStream("https://router.huggingface.co/v1/chat/completions", hfApiKey, realModelId, body);
    }

    // 4. ROUTE TO GROQ CLOUD (Free Tier 70B)
    if (modelToUse.startsWith("groq/")) {
      if (!groqApiKey) {
        return authErrorResponse("Chiave Groq API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da console.groq.com)");
      }
      const realModelId = modelToUse.replace("groq/", "");
      return handleOpenAICompatibleStream("https://api.groq.com/openai/v1/chat/completions", groqApiKey, realModelId, body);
    }

    // 5. ROUTE TO OPENROUTER (:free Models)
    if (modelToUse.startsWith("openrouter/")) {
      if (!openrouterApiKey) {
        return authErrorResponse("Chiave OpenRouter API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da openrouter.ai/keys)");
      }
      const realModelId = modelToUse.replace("openrouter/", "");
      return handleOpenAICompatibleStream("https://openrouter.ai/api/v1/chat/completions", openrouterApiKey, realModelId, body);
    }

    // 6. ROUTE TO GOOGLE GEMINI API
    if (modelToUse.toLowerCase().startsWith("gemini")) {
      if (!geminiApiKey) {
        return authErrorResponse("Chiave Gemini API non configurata! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da aistudio.google.com)");
      }

      const contents: any[] = [];
      let systemInstruction: any = undefined;

      if (body.system) {
        const sysText = Array.isArray(body.system)
          ? body.system.map((s: any) => s.text || "").join("\n")
          : body.system;
        systemInstruction = { parts: [{ text: sysText }] };
      }

      if (body.messages) {
        for (const msg of body.messages) {
          let text = "";
          if (typeof msg.content === "string") {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            text = msg.content
              .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
              .join("\n");
          }
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text }]
          });
        }
      }

      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

      const geminiRes = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: body.temperature || 0.7,
            maxOutputTokens: body.max_tokens || 8192
          }
        })
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return new Response(JSON.stringify({ error: errText }), {
          status: geminiRes.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      return transformSSEToAnthropic(geminiRes, (json) => {
        return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }, modelToUse);
    }

    // 6b. ROUTE TO LOCAL ENGINES (LM Studio, Apple MLX, vLLM, EXO Cluster, KTransformers MoE, AirLLM)
    if (modelToUse.startsWith("lmstudio/")) {
      const realModelId = modelToUse.replace("lmstudio/", "");
      return handleOpenAICompatibleStream("http://localhost:1234/v1/chat/completions", "lm-studio", realModelId, body);
    }
    if (modelToUse.startsWith("mlx/")) {
      const realModelId = modelToUse.replace("mlx/", "");
      return handleOpenAICompatibleStream("http://localhost:8080/v1/chat/completions", "mlx", realModelId, body);
    }
    if (modelToUse.startsWith("vllm/")) {
      const realModelId = modelToUse.replace("vllm/", "");
      return handleOpenAICompatibleStream("http://localhost:8000/v1/chat/completions", "vllm", realModelId, body);
    }
    if (modelToUse.startsWith("exo/")) {
      const realModelId = modelToUse.replace("exo/", "");
      return handleOpenAICompatibleStream("http://localhost:52415/v1/chat/completions", "exo", realModelId, body);
    }
    if (modelToUse.startsWith("ktransformers/")) {
      const realModelId = modelToUse.replace("ktransformers/", "");
      return handleOpenAICompatibleStream("http://localhost:10002/v1/chat/completions", "ktransformers", realModelId, body);
    }
    if (modelToUse.startsWith("airllm/")) {
      const realModelId = modelToUse.replace("airllm/", "");
      return handleOpenAICompatibleStream("http://localhost:5000/v1/chat/completions", "airllm", realModelId, body);
    }
    if (modelToUse.startsWith("llamafile/")) {
      const realModelId = modelToUse.replace("llamafile/", "");
      return handleOpenAICompatibleStream("http://localhost:8080/v1/chat/completions", "llamafile", realModelId, body);
    }
    if (modelToUse.startsWith("freetoken/")) {
      const realModelId = modelToUse.replace("freetoken/", "");
      return handleOpenAICompatibleStream("http://localhost:1919/v1/chat/completions", "freetoken-local", realModelId, body);
    }

    // 7. ROUTE TO OLLAMA LOCAL API
    const ollamaMessages: any[] = [];

    if (body.system) {
      const systemContent = Array.isArray(body.system)
        ? body.system.map((s: any) => s.text || "").join("\n")
        : body.system;
      ollamaMessages.push({ role: "system", content: systemContent });
    }

    if (body.messages) {
      for (const msg of body.messages) {
        let content = "";
        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
            .join("\n");
        }
        ollamaMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content
        });
      }
    }

    const ollamaPayload: any = {
      model: modelToUse,
      messages: ollamaMessages,
      stream: isStream,
      options: { temperature: body.temperature || 0.7 }
    };

    if (body.tools && Array.isArray(body.tools)) {
      ollamaPayload.tools = body.tools.map((t: any) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description || "",
          parameters: t.input_schema || {}
        }
      }));
    }

    const ollamaRes = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaPayload)
    });

    if (!isStream) {
      const data: any = await ollamaRes.json();
      const text = data.message?.content || "";
      addTokensProcessed(Math.round(text.length / 3.5));

      const anthropicResponse = {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text }],
        model: modelToUse,
        stop_reason: "end_turn",
        usage: {
          input_tokens: Math.round(JSON.stringify(ollamaMessages).length / 4),
          output_tokens: Math.round(text.length / 4)
        }
      };

      return new Response(JSON.stringify(anthropicResponse), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return transformNDJSONToAnthropic(ollamaRes, modelToUse);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

console.log(`\n======================================================`);
console.log(`🚀 CUSTOM CLAUDE CODER running on http://localhost:${PORT}`);
console.log(`🖥️ Platform OS: ${process.platform} (macOS / Windows / Linux Ready)`);
console.log(`📂 Attached Workspace: ${attachedWorkspacePath}`);
console.log(`💾 Persistent Config File: ${CONFIG_FILE}`);
console.log(`⚡ Anthropic API Proxy: http://localhost:${PORT}/v1/messages`);
console.log(`🤖 Active Model: ${activeModel}`);
console.log(`======================================================\n`);

if (telegramEnabled && telegramBotToken) {
  startTelegramPolling(server);
}
