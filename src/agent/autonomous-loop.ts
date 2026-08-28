/**
 * Autonomous Multi-Step Agentic Loop (Cursor Agent / Cline style)
 * ------------------------------------------------------
 * Gap reale rispetto a Cursor Agent / Cline: legge e scrive PIÙ file in
 * sequenza autonomamente, verificando con test reali, senza un prompt per
 * ogni singolo passo. Ogni passo è UNA azione reale: read_file/write_file
 * leggono e scrivono realmente sul disco (mai fuori dal workspace),
 * run_test esegue realmente il comando fornito.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 8) — nessun cambio di
 * comportamento. Stesso pattern di contesto di agent/run.ts e autodebug.ts.
 */
import { resolve, dirname, sep } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import * as Diff from "diff";
import { handleAnthropicProxy } from "../providers/dispatch";
import { buildAstRepoMap } from "../workspace/repo-map";
import { saveProjectInsight } from "../workspace/memory";
import { createRun, recordCheckpoint } from "./checkpoints";
import type { AgentRunContext } from "./run";

const PORT = Number(process.env.PORT) || 3001;

export async function handleAgentAutonomousLoop(req: Request, runCtx: AgentRunContext): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      try {
        const body: any = await req.json();
        const task: string = body.task || "";
        const workspace = resolve(body.workspace || runCtx.attachedWorkspacePath);
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

          const runId = crypto.randomUUID();
          const checkpointRun = createRun(workspace, runId, task);

          await write(`\n🤖 [LOOP AGENTICO AUTONOMO AVVIATO] — max ${maxSteps} passi — run: ${runId}\n════════════════════════════════════════════════════════════════\nObiettivo: ${task}\n`);

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
              model: runCtx.activeModel,
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
              const proxyRes = await handleAnthropicProxy(proxyReq, runCtx.activeModel, runCtx.keys);
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
                const hadExisted = existsSync(absPath);
                const oldContent = hadExisted ? readFileSync(absPath, "utf-8") : "";
                // Checkpoint REALE prima di scrivere: persiste subito su disco, non
                // solo a fine loop, così sopravvive anche a un'interruzione a metà.
                recordCheckpoint(checkpointRun, step, relPath, hadExisted, oldContent);
                const patch = Diff.createTwoFilesPatch(relPath, relPath, oldContent, newContent, "prima", "dopo");
                const parentDir = dirname(absPath);
                if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
                writeFileSync(absPath, newContent, "utf-8");
                filesWritten++;
                await write(`✏️ write_file(${relPath}) — scritto realmente su disco (${newContent.length} byte) [checkpoint step ${step} salvato, ripristinabile da "🕐 Checkpoints" con run ${runId}]\n${patch.split("\n").slice(0, 25).join("\n")}\n`);
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
            `Loop agentico autonomo eseguito (${filesWritten} file scritti realmente sul disco, run ${runId}). Terminato perché: ${stopReason}.`,
            ["autonomous-loop"]
          );

          await write(`\n════════════════════════════════════════════════════════════════\n🏁 [LOOP TERMINATO] ${stopReason} — file scritti realmente: ${filesWritten}${filesWritten > 0 ? `\n🕐 Per annullare queste modifiche apri "Checkpoints" e ripristina la run ${runId}.` : ""}\n`);
          try { await writer.close(); } catch {}
        })();

        return new Response(readable, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
}
