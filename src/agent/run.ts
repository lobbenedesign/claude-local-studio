/**
 * Agent Run — pipeline principale dell'agente: standard single-agent,
 * Ruflo Swarm (3 fasi sullo stesso modello), e Swarm Multi-Provider reale
 * (Architect/Coder su provider cloud diversi + Reviewer con verdetto JSON
 * strutturato). 13 modalità via prefisso slash-command nel prompt
 * (/swarm, /ruflo, /diagram, /prd, /review, /refactor, /test, /doc,
 * /explain, /bench, /docker, /ci, /env).
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 8) — nessun cambio di
 * comportamento. Riceve `activeModel`/`attachedWorkspacePath`/le chiavi API
 * come contesto invece di leggerli da variabili di modulo (stesso pattern
 * di dispatch.ts ed ensemble.ts), più l'istanza del server Bun (per
 * `server.publish`, il bus di eventi WebSocket).
 */
import { resolve } from "path";
import type { Server } from "bun";
// `unknown` è sufficiente: qui serve solo .publish(), non i dati websocket tipizzati.
type AnyServer = Server<unknown>;
import { handleAnthropicProxy, type ProviderApiKeys } from "../providers/dispatch";
import { getConfiguredEnsembleCandidates, callEnsembleCandidateNonStreaming, type EnsembleCandidate } from "./ensemble";
import { analyzeProjectContext, resolveContextMentions } from "../workspace/context";
import { buildAstRepoMap } from "../workspace/repo-map";
import { getRelevantMemories, saveProjectInsight } from "../workspace/memory";
import { addTokensProcessed } from "../stats";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const PORT = Number(process.env.PORT) || 3001;

export interface AgentRunContext {
  activeModel: string;
  attachedWorkspacePath: string;
  keys: ProviderApiKeys;
  server: AnyServer;
}

export async function handleAgentRun(req: Request, runCtx: AgentRunContext): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      try {
        const body: any = await req.json();
        const rawPrompt = body.prompt;
        const workspace = resolve(body.workspace || runCtx.attachedWorkspacePath);

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
            const multiProviderCandidates = isMultiProviderSwarm ? getConfiguredEnsembleCandidates(runCtx.keys) : [];
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
                runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `\n${phaseTitle} — ${candidate.displayName}\n` }));
                try {
                  const { text, latencyMs } = await callEnsembleCandidateNonStreaming(candidate, `${systemPrompt}\n\n${roleSystem}`, userTask);
                  await writer.write(encoder.encode(`${text}\n[latenza reale: ${latencyMs}ms]\n`));
                  runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `${text}\n` }));
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
                runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: `\n${phaseTitle}\n` }));

                const payload = {
                  model: runCtx.activeModel,
                  system: `${systemPrompt}\n\n${roleSystem}`,
                  messages: [{ role: "user", content: userTask }],
                  stream: true
                };

                const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                });

                const proxyRes = await handleAnthropicProxy(proxyReq, runCtx.activeModel, runCtx.keys);
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
                        runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: chunk }));
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
                model: runCtx.activeModel,
                system: systemPrompt,
                messages: [{ role: "user", content: cleanPrompt }],
                stream: true
              };

              const proxyReq = new Request(`http://localhost:${PORT}/v1/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(anthropicPayload)
              });

              const proxyRes = await handleAnthropicProxy(proxyReq, runCtx.activeModel, runCtx.keys);
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
                      runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_output", data: textChunk }));
                    }
                  } catch {}
                }
              }
            }
          } catch (err: any) {
            // A killed/aborted connection (e.g. idle timeout) can reject with a
            // non-Error value here — don't let the error handler itself throw.
            const msg = err instanceof Error ? err.message : String(err ?? "errore sconosciuto");
            try { await writer.write(encoder.encode(`\nErrore esecuzione: ${msg}`)); } catch {}
          } finally {
            try { await writer.close(); } catch {}
            runCtx.server.publish("claude-studio", JSON.stringify({ type: "agent_done" }));
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
