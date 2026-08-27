/**
 * Autonomous Auto-Debug & Self-Healing Test Loop (OpenCode / SWE-Agent Style)
 * ------------------------------------------------------
 * Esegue realmente il comando di test fornito, e se fallisce manda l'errore
 * a `handleAnthropicProxy` (via self-HTTP-loopback) per una diagnosi/fix,
 * ripetendo fino a maxIterations o al primo successo. Streaming SSE.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 8) — nessun cambio di
 * comportamento. Stesso pattern di contesto di agent/run.ts (parametro
 * `runCtx`, non `ctx`, perché il codice usa già una `ctx` locale da
 * `analyzeProjectContext`).
 */
import { resolve } from "path";
import { handleAnthropicProxy } from "../providers/dispatch";
import { analyzeProjectContext } from "../workspace/context";
import type { AgentRunContext } from "./run";

const PORT = Number(process.env.PORT) || 3001;

// Riusa lo stesso AgentRunContext di agent/run.ts (activeModel,
// attachedWorkspacePath, keys, server) anche se qui non serve `server` —
// evita di duplicare un tipo quasi identico, e il chiamante lo costruisce
// comunque una sola volta.
export async function handleAgentAutodebug(req: Request, runCtx: AgentRunContext): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      try {
        const body: any = await req.json();
        const testCommand = body.command || "npm test";
        const maxIterations = body.maxIterations || 3;
        const workspace = resolve(body.workspace || runCtx.attachedWorkspacePath);

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
              model: runCtx.activeModel,
              system: "Sei un Autonomous SWE Debugger Engine avanzato (OpenCode / SWE-bench). Analizza gli stack trace ed emetti diagnosi e correzioni pronte all'uso.",
              messages: [{ role: "user", content: debugPrompt }],
              stream: true
            };

            const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(debugPayload)
            });

            const proxyRes = await handleAnthropicProxy(proxyReq, runCtx.activeModel, runCtx.keys);
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
