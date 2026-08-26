/**
 * Cataloghi statici dei modelli mostrati nel Model Hub.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 4) — nessun cambio di
 * comportamento, solo spostamento di dati statici in un proprio modulo.
 * Nota: per Cerebras il catalogo statico qui sotto è solo un fallback —
 * server.ts sostituisce dinamicamente cerebrasModels con un probe live di
 * /v1/models quando è configurata una chiave (vedi CHANGELOG del progetto).
 */

// ==========================================
// MODEL CATALOG DEFINITIONS
// ==========================================

export const FEATURED_LOCAL_MODELS = [
  {
    name: "qwen2.5-coder:7b",
    displayName: "Qwen 2.5 Coder 7B",
    author: "Alibaba Cloud",
    provider: "ollama",
    size: "4.7 GB",
    minRam: "8 GB",
    context: "32k Context",
    speed: "45 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Top model di coding locale. Eccellente in Python, TypeScript, refactoring e tool use.",
    tag: "Consigliato Locale"
  },
  {
    name: "qwen2.5-coder:1.5b",
    displayName: "Qwen 2.5 Coder 1.5B",
    author: "Alibaba Cloud",
    provider: "ollama",
    size: "1.0 GB",
    minRam: "4 GB",
    context: "32k Context",
    speed: "95 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Leggerissimo e velocissimo. Ideale per computer portatili e script rapidi.",
    tag: "Ultra-Fast"
  },
  {
    name: "deepseek-coder-v2:16b",
    displayName: "DeepSeek Coder V2 16B",
    author: "DeepSeek AI",
    provider: "ollama",
    size: "8.9 GB",
    minRam: "16 GB",
    context: "64k Context",
    speed: "30 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Architettura Mixture-of-Experts con forte capacità logica e comprensione del codice.",
    tag: "High Reasoning"
  },
  {
    name: "llama3.2:3b",
    displayName: "Llama 3.2 3B",
    author: "Meta",
    provider: "ollama",
    size: "2.0 GB",
    minRam: "6 GB",
    context: "128k Context",
    speed: "65 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Modello compatto di Meta con finestra di contesto nativa fino a 128k token.",
    tag: "Large Context"
  },
  {
    name: "deepseek-r1:7b",
    displayName: "DeepSeek R1 Distill 7B",
    author: "DeepSeek AI",
    provider: "ollama",
    size: "4.7 GB",
    minRam: "8 GB",
    context: "64k Context",
    speed: "40 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Il celebre modello di ragionamento matematico e logico DeepSeek R1 distillato su architettura 7B.",
    tag: "🧠 R1 Reasoning"
  },
  {
    name: "deepseek-r1:14b",
    displayName: "DeepSeek R1 Distill 14B",
    author: "DeepSeek AI",
    provider: "ollama",
    size: "9.0 GB",
    minRam: "16 GB",
    context: "64k Context",
    speed: "25 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Equilibrio perfetto tra potenza di ragionamento da 70B e consumo di RAM contenuto.",
    tag: "🧠 R1 14B"
  },
  {
    name: "deepseek-r1:32b",
    displayName: "DeepSeek R1 Distill 32B",
    author: "DeepSeek AI",
    provider: "ollama",
    size: "19.0 GB",
    minRam: "24 GB",
    context: "64k Context",
    speed: "15 tok/s",
    cost: "€ 0.00 (Illimitato)",
    desc: "Ragionamento di livello GPT-4o eseguibile localmente su macchine con 24GB+ RAM.",
    tag: "🧠 R1 32B"
  }
];

export const GROQ_FREE_MODELS = [
  {
    name: "groq/llama-3.3-70b-versatile",
    modelId: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B Versatile",
    author: "Meta & Groq Cloud",
    provider: "groq",
    size: "Cloud API",
    context: "128k Context",
    speed: "~350 tok/s (Groq LPU)",
    cost: "Free Tier (14.4k req/giorno)",
    desc: "Modello da 70 miliardi di parametri con velocità fulminea su chip Groq.",
    tag: "Groq 70B Free"
  },
  {
    name: "groq/deepseek-r1-distill-llama-70b",
    modelId: "deepseek-r1-distill-llama-70b",
    displayName: "DeepSeek R1 Distill 70B",
    author: "DeepSeek & Groq",
    provider: "groq",
    size: "Cloud API",
    context: "128k Context",
    speed: "~300 tok/s",
    cost: "Free Tier",
    desc: "Il motore di ragionamento di DeepSeek R1 distillato su architettura 70B.",
    tag: "DeepSeek R1 Free"
  },
  {
    name: "groq/qwen-2.5-coder-32b",
    modelId: "qwen-2.5-coder-32b",
    displayName: "Qwen 2.5 Coder 32B",
    author: "Alibaba & Groq",
    provider: "groq",
    size: "Cloud API",
    context: "128k Context",
    speed: "~400 tok/s",
    cost: "Free Tier",
    desc: "Modello specializzato in codice da 32B con velocità ultra-rapida su Groq.",
    tag: "Qwen 32B Free"
  }
];

// Static fallback only — Cerebras's actual free-tier lineup is fetched live
// from /v1/models in the /api/models handler below whenever a Cerebras key
// is configured, because this list goes stale: llama-3.3-70b/llama3.1-8b
// (previously hardcoded here) started returning HTTP 404 "model_not_found"
// once Cerebras rotated their free model lineup — confirmed by querying
// https://api.cerebras.ai/v1/models directly with a real account key, which
// returned only gpt-oss-120b and gemma-4-31b. This list is just what's shown
// before a key is entered / if the live probe fails.
export const CEREBRAS_FREE_MODELS = [
  {
    name: "cerebras/gpt-oss-120b",
    modelId: "gpt-oss-120b",
    displayName: "GPT-OSS 120B (Cerebras)",
    author: "OpenAI OSS & Cerebras AI",
    provider: "cerebras",
    size: "Cloud API",
    context: "128k Context",
    speed: "Cerebras Wafer-Scale Engine",
    cost: "Free Developer Tier",
    desc: "Modello open-weight da 120B servito su hardware wafer-scale Cerebras.",
    tag: "⚡ Cerebras"
  },
  {
    name: "cerebras/gemma-4-31b",
    modelId: "gemma-4-31b",
    displayName: "Gemma 4 31B (Cerebras)",
    author: "Google & Cerebras AI",
    provider: "cerebras",
    size: "Cloud API",
    context: "128k Context",
    speed: "Cerebras Wafer-Scale Engine",
    cost: "Free Developer Tier",
    desc: "Gemma 4 31B servito su hardware wafer-scale Cerebras.",
    tag: "⚡ Cerebras"
  }
];

// Catalogo minimo: il router HF dà accesso a migliaia di modelli tramite
// provider partner (Together, Novita, Fireworks, ecc.) — questi sono solo
// alcuni punti di partenza noti, non un elenco esaustivo. Il formato
// "repo:provider" (o ":auto" per selezione automatica) è quello richiesto
// da https://router.huggingface.co/v1/chat/completions.
export const HF_ROUTER_MODELS = [
  {
    name: "hf/deepseek-ai/DeepSeek-V3.1:auto",
    modelId: "deepseek-ai/DeepSeek-V3.1:auto",
    displayName: "DeepSeek V3.1 (HF Router, auto)",
    author: "DeepSeek AI",
    provider: "huggingface",
    size: "Cloud API",
    context: "128k Context",
    speed: "Varia per provider",
    cost: "Free/Pay-per-use (credito HF incluso)",
    desc: "Instradato automaticamente al miglior provider disponibile su Hugging Face Inference Providers.",
    tag: "🤗 HF Router"
  },
  {
    name: "hf/openai/gpt-oss-120b:auto",
    modelId: "openai/gpt-oss-120b:auto",
    displayName: "GPT-OSS 120B (HF Router, auto)",
    author: "OpenAI OSS",
    provider: "huggingface",
    size: "Cloud API",
    context: "128k Context",
    speed: "Varia per provider",
    cost: "Free/Pay-per-use (credito HF incluso)",
    desc: "Modello open-weight OpenAI instradato tramite Hugging Face Inference Providers.",
    tag: "🤗 HF Router"
  },
  {
    name: "hf/Qwen/Qwen2.5-Coder-32B-Instruct:auto",
    modelId: "Qwen/Qwen2.5-Coder-32B-Instruct:auto",
    displayName: "Qwen 2.5 Coder 32B (HF Router, auto)",
    author: "Alibaba Cloud",
    provider: "huggingface",
    size: "Cloud API",
    context: "32k Context",
    speed: "Varia per provider",
    cost: "Free/Pay-per-use (credito HF incluso)",
    desc: "Modello di coding instradato tramite Hugging Face Inference Providers.",
    tag: "🤗 HF Router"
  }
];

export const SAMBANOVA_FREE_MODELS = [
  {
    name: "sambanova/DeepSeek-R1",
    modelId: "DeepSeek-R1",
    displayName: "DeepSeek R1 (671B Full MoE)",
    author: "DeepSeek & SambaNova",
    provider: "sambanova",
    size: "Cloud API",
    context: "64k Context",
    speed: "~160 tok/s (SN40L RDU)",
    cost: "Free Tier (SambaNova Cloud)",
    desc: "Il mastodontico modello originale da 671 miliardi di parametri su hardware SambaNova Reconfigurable Dataflow.",
    tag: "671B MoE Free"
  },
  {
    name: "sambanova/Meta-Llama-3.3-70B-Instruct",
    modelId: "Meta-Llama-3.3-70B-Instruct",
    displayName: "Llama 3.3 70B Instruct",
    author: "Meta & SambaNova",
    provider: "sambanova",
    size: "Cloud API",
    context: "128k Context",
    speed: "~200 tok/s",
    cost: "Free Tier",
    desc: "Llama 3.3 70B accelerato per compiti di coding e reasoning.",
    tag: "70B Free"
  },
  {
    name: "sambanova/Qwen2.5-Coder-32B-Instruct",
    modelId: "Qwen2.5-Coder-32B-Instruct",
    displayName: "Qwen 2.5 Coder 32B",
    author: "Alibaba & SambaNova",
    provider: "sambanova",
    size: "Cloud API",
    context: "32k Context",
    speed: "~180 tok/s",
    cost: "Free Tier",
    desc: "Modello Qwen di riferimento per lo sviluppo software.",
    tag: "Coder 32B"
  }
];

export const MISTRAL_FREE_MODELS = [
  {
    name: "mistral/codestral-latest",
    modelId: "codestral-latest",
    displayName: "Codestral Latest (22B)",
    author: "Mistral AI",
    provider: "mistral",
    size: "Cloud API",
    context: "256k Context",
    speed: "~80 tok/s",
    cost: "Free Dev Tier (La Plateforme)",
    desc: "Il celebre modello specializzato di Mistral AI, addestrato su oltre 80 linguaggi con 256k token di contesto.",
    tag: "Codestral 256k"
  },
  {
    name: "mistral/mistral-small-latest",
    modelId: "mistral-small-latest",
    displayName: "Mistral Small Latest",
    author: "Mistral AI",
    provider: "mistral",
    size: "Cloud API",
    context: "128k Context",
    speed: "~110 tok/s",
    cost: "Free Dev Tier",
    desc: "Modello compatto di ultima generazione per refactoring e coding rapido.",
    tag: "Mistral Small"
  }
];

export const OPENROUTER_FREE_MODELS = [
  {
    name: "openrouter/deepseek/deepseek-r1:free",
    modelId: "deepseek/deepseek-r1:free",
    displayName: "DeepSeek R1 (671B Full)",
    author: "DeepSeek & OpenRouter",
    provider: "openrouter",
    size: "Cloud API",
    context: "64k Context",
    speed: "~40 tok/s",
    cost: "100% Free (:free tag)",
    desc: "DeepSeek R1 completo da 671 miliardi di parametri con catena di pensiero libera.",
    tag: "671B MoE Free"
  },
  {
    name: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    displayName: "Llama 3.3 70B Instruct",
    author: "Meta & OpenRouter",
    provider: "openrouter",
    size: "Cloud API",
    context: "128k Context",
    speed: "~50 tok/s",
    cost: "100% Free (:free tag)",
    desc: "Modello open-weight di punta di Meta con supporto avanzato per coding.",
    tag: "Meta 70B Free"
  },
  {
    name: "openrouter/qwen/qwen-2.5-coder-32b-instruct:free",
    modelId: "qwen/qwen-2.5-coder-32b-instruct:free",
    displayName: "Qwen 2.5 Coder 32B Instruct",
    author: "Alibaba & OpenRouter",
    provider: "openrouter",
    size: "Cloud API",
    context: "32k Context",
    speed: "~45 tok/s",
    cost: "100% Free (:free tag)",
    desc: "Modello specializzato con supporto esteso a decine di linguaggi di programmazione.",
    tag: "Coder 32B Free"
  }
];

export const GEMINI_MODELS = [
  {
    name: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    author: "Google DeepMind",
    provider: "gemini",
    size: "Cloud API",
    context: "2.000.000 Token (2M)",
    speed: "High Reasoning",
    cost: "API Gratuita AI Studio",
    desc: "Flagship Google con contesto da 2 Milioni di token. Ideale per caricare intere codebase in memoria.",
    tag: "Google Flagship"
  },
  {
    name: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    author: "Google DeepMind",
    provider: "gemini",
    size: "Cloud API",
    context: "1.000.000 Token (1M)",
    speed: "Real-Time (~120 tok/s)",
    cost: "API Gratuita AI Studio",
    desc: "Velocissimo con 1M di contesto. Perfetto per refactoring e generazioni veloci.",
    tag: "Ultra-Fast Flash"
  },
  {
    name: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    author: "Google DeepMind",
    provider: "gemini",
    size: "Cloud API",
    context: "1.000.000 Token (1M)",
    speed: "Real-Time",
    cost: "API Gratuita AI Studio",
    desc: "Bassa latenza e forte supporto per esecuzione comandi agente.",
    tag: "Next-Gen Flash"
  }
];

export const OPENAI_MODELS = [
  {
    name: "openai/gpt-4o",
    modelId: "gpt-4o",
    displayName: "GPT-4o (Omni)",
    author: "OpenAI",
    provider: "openai",
    size: "Cloud API",
    context: "128k Context",
    speed: "Real-Time (~90 tok/s)",
    cost: "OpenAI API",
    desc: "Il modello ammiraglio multimodale di OpenAI con massime capacità di coding e reasoning.",
    tag: "Flagship GPT-4o"
  },
  {
    name: "openai/gpt-4o-mini",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    author: "OpenAI",
    provider: "openai",
    size: "Cloud API",
    context: "128k Context",
    speed: "Ultra-Fast (~140 tok/s)",
    cost: "OpenAI API Economica",
    desc: "Veloce ed economico, ideale per modifiche rapide e generazione di test.",
    tag: "Fast & Lightweight"
  },
  {
    name: "openai/o3-mini",
    modelId: "o3-mini",
    displayName: "OpenAI o3-mini (Reasoning)",
    author: "OpenAI",
    provider: "openai",
    size: "Cloud API",
    context: "200k Context",
    speed: "~80 tok/s",
    cost: "OpenAI API",
    desc: "Modello specializzato nel ragionamento logico, matematico e programmazione complessa.",
    tag: "High Reasoning"
  }
];
