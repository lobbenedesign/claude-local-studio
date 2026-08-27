/**
 * Persistent app configuration (API keys, active model, workspace path,
 * Telegram bridge settings) — caricata/salvata in `.config/settings.json`
 * nella root del progetto.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 9) — nessun cambio di
 * comportamento. Le ~20 variabili `let xxxApiKey` restano dichiarate in
 * server.ts (non consolidate in un oggetto unico): con server.ts ormai
 * sceso sotto le 1.700 righe e organizzato in moduli, il rischio di una
 * rinomina di massa di ~20 identificatori in tutto il file (incluse le
 * shorthand `{ activeModel, ... }` già create per gli step precedenti) non
 * è più giustificato dal beneficio — sarebbe il refactor col rapporto
 * rischio/valore peggiore di tutta la Fase 1.
 */
import { join, resolve } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { homedir } from "os";
import { CONFIG_DIR, PROJECT_ROOT, IS_COMPILED } from "./paths";

export const CONFIG_FILE = join(CONFIG_DIR, "settings.json");

export interface AppConfig {
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

export function loadConfig(): AppConfig {
  const defaultConfig: AppConfig = {
    activeModel: "qwen2.5:7b",
    // Il workspace di default è la cartella che contiene claude-local-studio
    // (in questo repo, la cartella "LLM" con i progetti gemelli). In un
    // binario compilato (Fase 4, packaging) PROJECT_ROOT è invece
    // Contents/Resources dentro il bundle .app — puntarci la workspace di
    // default mostrerebbe all'utente i file interni dell'app invece dei
    // suoi progetti, quindi lì il default è la home dell'utente.
    attachedWorkspacePath: IS_COMPILED ? homedir() : resolve(PROJECT_ROOT, ".."),
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
      // Self-heal i permessi anche su un file creato prima di questo
      // hardening (ROADMAP.md, Fase 2) — non aspetta il prossimo save.
      try { chmodSync(CONFIG_FILE, 0o600); } catch {}
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    }
  } catch (e) {
    console.error("Error reading settings.json:", e);
  }
  return defaultConfig;
}

export function saveConfig(cfg: Partial<AppConfig>) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = loadConfig();
    const updated = { ...current, ...cfg };
    writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
    // Contiene ~20 chiavi API in chiaro (ROADMAP.md, Fase 2): leggibile solo
    // dal proprietario. chmod è no-op innocuo su Windows (dove ACL NTFS,
    // non i permessi POSIX, governano l'accesso al file).
    try { chmodSync(CONFIG_FILE, 0o600); } catch {}
    return updated;
  } catch (e) {
    console.error("Error saving settings.json:", e);
    return loadConfig();
  }
}
