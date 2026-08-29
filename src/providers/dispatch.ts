/**
 * Anthropic-compatible proxy dispatch — instrada `/v1/messages` verso il
 * provider giusto in base al prefisso del nome modello (~20 provider cloud
 * + i motori locali OpenAI-compatibili + Ollama).
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 7) — nessun cambio di
 * comportamento. Le ~20 chiavi API restano variabili globali mutabili in
 * server.ts (non ancora consolidate in un vero config store, step 9): questa
 * funzione le riceve come parametro `keys` invece di leggerle da variabili
 * di modulo, cosa che avrebbe richiesto rinominare ~20 identificatori in
 * tutto il file con rischio di refactor inutilmente ampio. server.ts
 * costruisce l'oggetto `keys` dalle sue variabili globali ad ogni chiamata.
 */
import { addTokensProcessed } from "../stats";
import {
  authErrorResponse,
  handleOpenAICompatibleStream,
  transformSSEToAnthropic,
  transformNDJSONToAnthropic
} from "./openai-compat";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
// Same default port (8080) as the mlx/llamacpp route below — LocalAI's own
// default. Set LOCALAI_HOST if running both a raw llama.cpp/MLX server and
// LocalAI locally at the same time.
const LOCALAI_HOST = process.env.LOCALAI_HOST || "http://localhost:8080";

export interface ProviderApiKeys {
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
  kimiApiKey: string;
  qwenApiKey: string;
  glmApiKey: string;
  perplexityApiKey: string;
  customApiEndpoint: string;
  customApiKey: string;
}

export async function handleAnthropicProxy(req: Request, activeModel: string, keys: ProviderApiKeys) {
  try {
    const body: any = await req.json();
    const modelToUse = activeModel;
    const isStream = body.stream ?? true;

    // 0. ROUTE TO ANTHROPIC CLAUDE API (Direct)
    if (modelToUse.startsWith("anthropic/")) {
      if (!keys.anthropicApiKey) {
        return authErrorResponse("Chiave Anthropic API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da console.anthropic.com)");
      }
      const realModelId = modelToUse.replace(/^anthropic\//i, "");
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keys.anthropicApiKey,
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
      if (!keys.deepseekApiKey) {
        return authErrorResponse("Chiave DeepSeek API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.deepseek.com)");
      }
      const realModelId = modelToUse.replace(/^deepseek\//i, "");
      return handleOpenAICompatibleStream("https://api.deepseek.com/v1/chat/completions", keys.deepseekApiKey, realModelId, body);
    }

    // 0c. ROUTE TO XAI GROK API
    if (modelToUse.startsWith("xai/") || modelToUse.startsWith("grok-")) {
      if (!keys.xaiApiKey) {
        return authErrorResponse("Chiave xAI (Grok) API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da console.x.ai)");
      }
      const realModelId = modelToUse.replace(/^xai\//i, "");
      return handleOpenAICompatibleStream("https://api.x.ai/v1/chat/completions", keys.xaiApiKey, realModelId, body);
    }

    // 0d. ROUTE TO MOONSHOT KIMI (Kimi K3 / K1.5)
    if (modelToUse.startsWith("kimi/") || modelToUse.startsWith("moonshot/")) {
      if (!keys.kimiApiKey) {
        return authErrorResponse("Chiave Moonshot Kimi API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.moonshot.cn)");
      }
      const realModelId = modelToUse.replace(/^(kimi|moonshot)\//i, "");
      return handleOpenAICompatibleStream("https://api.moonshot.cn/v1/chat/completions", keys.kimiApiKey, realModelId, body);
    }

    // 0e. ROUTE TO ALIBABA QWEN (DashScope)
    if (modelToUse.startsWith("qwen-api/") || modelToUse.startsWith("dashscope/")) {
      if (!keys.qwenApiKey) {
        return authErrorResponse("Chiave Alibaba Qwen / DashScope API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da dashscope.aliyun.com)");
      }
      const realModelId = modelToUse.replace(/^(qwen-api|dashscope)\//i, "");
      return handleOpenAICompatibleStream("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", keys.qwenApiKey, realModelId, body);
    }

    // 0f. ROUTE TO ZHIPU AI GLM (ChatGLM / GLM-4)
    if (modelToUse.startsWith("glm/") || modelToUse.startsWith("zhipu/")) {
      if (!keys.glmApiKey) {
        return authErrorResponse("Chiave Zhipu GLM API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da open.bigmodel.cn)");
      }
      const realModelId = modelToUse.replace(/^(glm|zhipu)\//i, "");
      return handleOpenAICompatibleStream("https://open.bigmodel.cn/api/paas/v4/chat/completions", keys.glmApiKey, realModelId, body);
    }

    // 0g. ROUTE TO PERPLEXITY AI (Sonar / Deep Research)
    if (modelToUse.startsWith("perplexity/") || modelToUse.startsWith("sonar/")) {
      if (!keys.perplexityApiKey) {
        return authErrorResponse("Chiave Perplexity API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da perplexity.ai/settings/api)");
      }
      const realModelId = modelToUse.replace(/^(perplexity|sonar)\//i, "");
      return handleOpenAICompatibleStream("https://api.perplexity.ai/chat/completions", keys.perplexityApiKey, realModelId, body);
    }

    // 0h. ROUTE TO FIREWORKS AI
    if (modelToUse.startsWith("fireworks/")) {
      if (!keys.fireworksApiKey) {
        return authErrorResponse("Chiave Fireworks AI API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da fireworks.ai)");
      }
      const realModelId = modelToUse.replace(/^fireworks\//i, "");
      return handleOpenAICompatibleStream("https://api.fireworks.ai/inference/v1/chat/completions", keys.fireworksApiKey, realModelId, body);
    }

    // 0i. ROUTE TO TOGETHER AI
    if (modelToUse.startsWith("together/")) {
      if (!keys.togetherApiKey) {
        return authErrorResponse("Chiave Together AI API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da together.ai)");
      }
      const realModelId = modelToUse.replace(/^together\//i, "");
      return handleOpenAICompatibleStream("https://api.together.xyz/v1/chat/completions", keys.togetherApiKey, realModelId, body);
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

    // 0l2. ROUTE TO LOCAL LOCALAI SERVER (Port 8080 by default, see LOCALAI_HOST above)
    // LocalAI (github.com/mudler/LocalAI) fronts 60+ inference backends
    // (llama.cpp, vLLM, MLX, exllama, ...) behind one OpenAI-compatible API,
    // so this single route reaches all of them without a dedicated adapter
    // per backend, the same way the mlx/llamacpp/vllm routes above each
    // reach exactly one. LocalAI doesn't validate the API key by default,
    // so any placeholder works.
    if (modelToUse.startsWith("localai/")) {
      const realModelId = modelToUse.replace(/^localai\//i, "");
      return handleOpenAICompatibleStream(`${LOCALAI_HOST}/v1/chat/completions`, "sk-localai", realModelId, body);
    }

    // 0m. ROUTE TO CUSTOM ENDPOINT (Inception Labs / Private LLMs)
    if (modelToUse.startsWith("custom/") && keys.customApiEndpoint) {
      const realModelId = modelToUse.replace(/^custom\//i, "");
      return handleOpenAICompatibleStream(keys.customApiEndpoint, keys.customApiKey || "sk-dummy", realModelId, body);
    }

    // 0. ROUTE TO OPENAI / CHATGPT API
    if (modelToUse.startsWith("openai/") || modelToUse.startsWith("gpt-") || modelToUse.startsWith("o1") || modelToUse.startsWith("o3")) {
      if (!keys.openaiApiKey) {
        return authErrorResponse("Chiave OpenAI API (ChatGPT) mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila da platform.openai.com/api-keys)");
      }
      const realModelId = modelToUse.replace(/^openai\//i, "");
      return handleOpenAICompatibleStream("https://api.openai.com/v1/chat/completions", keys.openaiApiKey, realModelId, body);
    }

    // 1. ROUTE TO CEREBRAS CLOUD (~1800 tok/s)
    if (modelToUse.startsWith("cerebras/")) {
      if (!keys.cerebrasApiKey) {
        return authErrorResponse("Chiave Cerebras API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da cloud.cerebras.ai)");
      }
      const realModelId = modelToUse.replace("cerebras/", "");
      return handleOpenAICompatibleStream("https://api.cerebras.ai/v1/chat/completions", keys.cerebrasApiKey, realModelId, body);
    }

    // 2. ROUTE TO SAMBANOVA CLOUD (671B MoE)
    if (modelToUse.startsWith("sambanova/")) {
      if (!keys.sambanovaApiKey) {
        return authErrorResponse("Chiave SambaNova API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da cloud.sambanova.ai)");
      }
      const realModelId = modelToUse.replace("sambanova/", "");
      return handleOpenAICompatibleStream("https://api.sambanova.ai/v1/chat/completions", keys.sambanovaApiKey, realModelId, body);
    }

    // 3. ROUTE TO MISTRAL AI (Codestral)
    if (modelToUse.startsWith("mistral/")) {
      if (!keys.mistralApiKey) {
        return authErrorResponse("Chiave Mistral API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da console.mistral.ai)");
      }
      const realModelId = modelToUse.replace("mistral/", "");
      return handleOpenAICompatibleStream("https://api.mistral.ai/v1/chat/completions", keys.mistralApiKey, realModelId, body);
    }

    // 3b. ROUTE TO HUGGING FACE INFERENCE PROVIDERS ROUTER
    if (modelToUse.startsWith("hf/")) {
      if (!keys.hfApiKey) {
        return authErrorResponse("Chiave Hugging Face mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da huggingface.co/settings/tokens)");
      }
      const realModelId = modelToUse.replace("hf/", "");
      return handleOpenAICompatibleStream("https://router.huggingface.co/v1/chat/completions", keys.hfApiKey, realModelId, body);
    }

    // 4. ROUTE TO GROQ CLOUD (Free Tier 70B)
    if (modelToUse.startsWith("groq/")) {
      if (!keys.groqApiKey) {
        return authErrorResponse("Chiave Groq API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da console.groq.com)");
      }
      const realModelId = modelToUse.replace("groq/", "");
      return handleOpenAICompatibleStream("https://api.groq.com/openai/v1/chat/completions", keys.groqApiKey, realModelId, body);
    }

    // 5. ROUTE TO OPENROUTER (:free Models)
    if (modelToUse.startsWith("openrouter/")) {
      if (!keys.openrouterApiKey) {
        return authErrorResponse("Chiave OpenRouter API mancante! Inseriscila nella scheda 'API Keys & Free Providers'. (Ottienila gratis da openrouter.ai/keys)");
      }
      const realModelId = modelToUse.replace("openrouter/", "");
      return handleOpenAICompatibleStream("https://openrouter.ai/api/v1/chat/completions", keys.openrouterApiKey, realModelId, body);
    }

    // 6. ROUTE TO GOOGLE GEMINI API
    if (modelToUse.toLowerCase().startsWith("gemini")) {
      if (!keys.geminiApiKey) {
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

      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?key=${keys.geminiApiKey}&alt=sse`;

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
