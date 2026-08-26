/**
 * OpenAI-compatible provider proxy helpers.
 * ------------------------------------------------------
 * Traduce richieste/risposte in stile Anthropic verso/da qualunque backend
 * OpenAI-compatibile (i ~20 provider cloud + i motori locali gestiti da
 * handleAnthropicProxy, che resta in server.ts perché è il pezzo più
 * accoppiato — vedi ROADMAP.md, Fase 1, step 7).
 *
 * Estratto da server.ts — nessun cambio di comportamento.
 */
import { addTokensProcessed } from "../stats";

export function authErrorResponse(message: string) {
  return new Response(
    JSON.stringify({
      error: {
        type: "authentication_error",
        message
      }
    }),
    { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
}

/**
 * Handles OpenAI-compatible streams
 */
export async function handleOpenAICompatibleStream(endpoint: string, apiKey: string, modelId: string, anthropicBody: any) {
  const openaiMessages: any[] = [];

  if (anthropicBody.system) {
    const sysText = Array.isArray(anthropicBody.system)
      ? anthropicBody.system.map((s: any) => s.text || "").join("\n")
      : anthropicBody.system;
    openaiMessages.push({ role: "system", content: sysText });
  }

  if (anthropicBody.messages) {
    for (const msg of anthropicBody.messages) {
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n");
      }
      openaiMessages.push({ role: msg.role, content });
    }
  }

  const openaiPayload: any = {
    model: modelId,
    messages: openaiMessages,
    temperature: anthropicBody.temperature || 0.7,
    stream: true
  };

  if (anthropicBody.tools && Array.isArray(anthropicBody.tools)) {
    openaiPayload.tools = anthropicBody.tools.map((t: any) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: t.input_schema || {}
      }
    }));
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "Custom Claude Coder"
    },
    body: JSON.stringify(openaiPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    return new Response(JSON.stringify({ error: errText }), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  return transformSSEToAnthropic(res, (json) => {
    return json.choices?.[0]?.delta?.content || "";
  }, modelId);
}

/**
 * SSE to Anthropic SSE transformer
 */
export function transformSSEToAnthropic(upstreamRes: Response, extractTextFn: (json: any) => string, modelName: string) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const msgId = `msg_${Date.now()}`;

  (async () => {
    if (!upstreamRes.body) return;
    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    await writer.write(
      encoder.encode(
        `event: message_start\ndata: ${JSON.stringify({
          type: "message_start",
          message: {
            id: msgId,
            type: "message",
            role: "assistant",
            content: [],
            model: modelName,
            usage: { input_tokens: 100, output_tokens: 0 }
          }
        })}\n\n`
      )
    );

    await writer.write(
      encoder.encode(
        `event: content_block_start\ndata: ${JSON.stringify({
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" }
        })}\n\n`
      )
    );

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
          const json = JSON.parse(jsonStr);
          const textChunk = extractTextFn(json);
          if (textChunk) {
            addTokensProcessed(1);
            await writer.write(
              encoder.encode(
                `event: content_block_delta\ndata: ${JSON.stringify({
                  type: "content_block_delta",
                  index: 0,
                  delta: { type: "text_delta", text: textChunk }
                })}\n\n`
              )
            );
          }
        } catch {}
      }
    }

    await writer.write(encoder.encode(`event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`));
    await writer.write(
      encoder.encode(
        `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":50}}\n\n`
      )
    );
    await writer.write(encoder.encode(`event: message_stop\ndata: {"type":"message_stop"}\n\n`));
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * NDJSON to Anthropic SSE transformer (for Ollama)
 */
export function transformNDJSONToAnthropic(ollamaRes: Response, modelName: string) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const msgId = `msg_${Date.now()}`;

  (async () => {
    if (!ollamaRes.body) return;
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    await writer.write(
      encoder.encode(
        `event: message_start\ndata: ${JSON.stringify({
          type: "message_start",
          message: {
            id: msgId,
            type: "message",
            role: "assistant",
            content: [],
            model: modelName,
            usage: { input_tokens: 100, output_tokens: 0 }
          }
        })}\n\n`
      )
    );

    await writer.write(
      encoder.encode(
        `event: content_block_start\ndata: ${JSON.stringify({
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" }
        })}\n\n`
      )
    );

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const deltaText = chunk.message?.content || "";
          if (deltaText) {
            addTokensProcessed(1);
            await writer.write(
              encoder.encode(
                `event: content_block_delta\ndata: ${JSON.stringify({
                  type: "content_block_delta",
                  index: 0,
                  delta: { type: "text_delta", text: deltaText }
                })}\n\n`
              )
            );
          }
        } catch {}
      }
    }

    await writer.write(encoder.encode(`event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`));
    await writer.write(
      encoder.encode(
        `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":50}}\n\n`
      )
    );
    await writer.write(encoder.encode(`event: message_stop\ndata: {"type":"message_stop"}\n\n`));
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
