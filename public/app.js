// CUSTOM CLAUDE CODER Frontend Engine
let activeModel = "qwen2.5:7b";
let apiKeysStatus = {
  hasGeminiKey: false,
  hasGroqKey: false,
  hasOpenRouterKey: false,
  hasCerebrasKey: false,
  hasSambaNovaKey: false,
  hasMistralKey: false
};

let localModels = [];
let featuredLocalModels = [];
let cerebrasModels = [];
let sambanovaModels = [];
let mistralModels = [];
let groqModels = [];
let openrouterModels = [];
let geminiModels = [];
let openaiModels = [];
let isPulling = false;
let socket = null;
let currentAgentRunning = false;
let attachedWorkspacePath = "/Users/giuseppelobbene/Desktop/APP PYTHON - FLUTTER ARCHIVE/LLM";

// DOM Elements
const quickModelSelect = document.getElementById("quick-model-select");
const localModelsGrid = document.getElementById("local-models-grid");
const cerebrasModelsGrid = document.getElementById("cerebras-models-grid");
const sambanovaModelsGrid = document.getElementById("sambanova-models-grid");
const mistralModelsGrid = document.getElementById("mistral-models-grid");
const groqModelsGrid = document.getElementById("groq-models-grid");
const openrouterModelsGrid = document.getElementById("openrouter-models-grid");
const geminiModelsGrid = document.getElementById("gemini-models-grid");
const openaiModelsGrid = document.getElementById("openai-models-grid");
const consoleOutput = document.getElementById("console-output");
const agentPromptForm = document.getElementById("agent-prompt-form");
const agentPromptInput = document.getElementById("agent-prompt-input");
const btnSendPrompt = document.getElementById("btn-send-prompt");
const btnStopAgent = document.getElementById("btn-stop-agent");
const btnClearConsole = document.getElementById("btn-clear-console");
const pullProgressCard = document.getElementById("pull-progress-card");
const progressModelName = document.getElementById("progress-model-name");
const progressStatusText = document.getElementById("progress-status-text");
const progressBarFill = document.getElementById("progress-bar-fill");
const btnPullCustom = document.getElementById("btn-pull-custom");
const customModelInput = document.getElementById("custom-model-input");

// Key Badges
const badgeCerebrasStatus = document.getElementById("badge-cerebras-status");
const badgeSambanovaStatus = document.getElementById("badge-sambanova-status");
const badgeMistralStatus = document.getElementById("badge-mistral-status");
const badgeGroqStatus = document.getElementById("badge-groq-status");
const badgeOpenrouterStatus = document.getElementById("badge-openrouter-status");
const badgeGeminiStatus = document.getElementById("badge-gemini-status");
const badgeOpenaiStatus = document.getElementById("badge-openai-status");

// Key Inputs
const inputCerebrasKey = document.getElementById("input-cerebras-key");
const inputSambanovaKey = document.getElementById("input-sambanova-key");
const inputMistralKey = document.getElementById("input-mistral-key");
const inputGroqKey = document.getElementById("input-groq-key");
const inputOpenrouterKey = document.getElementById("input-openrouter-key");
const inputGeminiKey = document.getElementById("input-gemini-key");
const inputOpenaiKey = document.getElementById("input-openai-key");
const inputAnthropicKey = document.getElementById("input-anthropic-key");
const inputDeepseekKey = document.getElementById("input-deepseek-key");
const inputXaiKey = document.getElementById("input-xai-key");
const inputKimiKey = document.getElementById("input-kimi-key");
const inputQwenKey = document.getElementById("input-qwen-key");
const inputGlmKey = document.getElementById("input-glm-key");
const inputPerplexityKey = document.getElementById("input-perplexity-key");
const inputTogetherKey = document.getElementById("input-together-key");
const inputFireworksKey = document.getElementById("input-fireworks-key");
const inputCohereKey = document.getElementById("input-cohere-key");
const inputCustomEndpoint = document.getElementById("input-custom-endpoint");
const inputCustomKey = document.getElementById("input-custom-key");
const btnSaveAllKeys = document.getElementById("btn-save-all-keys");

// Workspace Elements
const headerFolderName = document.getElementById("header-folder-name");
const sidebarProjectTitle = document.getElementById("sidebar-project-title");
const sidebarProjectPath = document.getElementById("sidebar-project-path");
const chipFilesCount = document.getElementById("chip-files-count");
const chipFramework = document.getElementById("chip-framework");
const chipRulesStatus = document.getElementById("chip-rules-status");
const chipActiveProvider = document.getElementById("chip-active-provider");
const fileTreeContainer = document.getElementById("file-tree-container");
const consolePinnedFolder = document.getElementById("console-pinned-folder");
const consoleModelBadge = document.getElementById("console-model-badge");
const bannerWorkspacePath = document.getElementById("banner-workspace-path");
const bannerModelName = document.getElementById("banner-model-name");
const inputFolderTag = document.getElementById("input-folder-tag");
const inputModelTag = document.getElementById("input-model-tag");
const btnBrowseFolder = document.getElementById("btn-browse-folder");
const btnReselectFolder = document.getElementById("btn-reselect-folder");
const btnRefreshTree = document.getElementById("btn-refresh-tree");
const btnEditRules = document.getElementById("btn-edit-rules");
const btnOpenCursor = document.getElementById("btn-open-cursor");
const btnOpenVscode = document.getElementById("btn-open-vscode");

// Rules Modal Elements
const rulesModal = document.getElementById("rules-modal");
const btnCloseRulesModal = document.getElementById("btn-close-rules-modal");
const btnCancelRules = document.getElementById("btn-cancel-rules");
const btnSaveRules = document.getElementById("btn-save-rules");
const selectRulesFileType = document.getElementById("select-rules-file-type");
const btnInsertRulesTemplate = document.getElementById("btn-insert-rules-template");
const textareaRulesContent = document.getElementById("textarea-rules-content");
const rulesModalTitle = document.getElementById("rules-modal-title");
let currentProjectContext = null;

// Explorer Tab Elements
const explorerFolderName = document.getElementById("explorer-folder-name");
const explorerTreeContainer = document.getElementById("explorer-tree-container");
const explorerCurrentFilename = document.getElementById("explorer-current-filename");
const explorerCurrentMeta = document.getElementById("explorer-current-meta");
const explorerCodeContent = document.getElementById("explorer-code-content");
const btnExplorerBrowse = document.getElementById("btn-explorer-browse");
const explorerFileActions = document.getElementById("explorer-file-actions");
const btnExplorerOpenCursor = document.getElementById("btn-explorer-open-cursor");
const btnExplorerOpenVscode = document.getElementById("btn-explorer-open-vscode");
const btnExplorerOpenFinder = document.getElementById("btn-explorer-open-finder");

// Modal Elements
const fileModal = document.getElementById("file-modal");
const modalFileName = document.getElementById("modal-file-name");
const modalFileContent = document.getElementById("modal-file-content");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnModalOpenCursor = document.getElementById("btn-modal-open-cursor");
const btnModalOpenVscode = document.getElementById("btn-modal-open-vscode");
const btnModalOpenFinder = document.getElementById("btn-modal-open-finder");

// Auto-Debug Modal Elements
const btnOpenAutodebug = document.getElementById("btn-open-autodebug");
const autodebugModal = document.getElementById("autodebug-modal");
const btnCloseAutodebugModal = document.getElementById("btn-close-autodebug-modal");
const btnCancelAutodebug = document.getElementById("btn-cancel-autodebug");
const btnRunAutodebug = document.getElementById("btn-run-autodebug");
const inputAutodebugCmd = document.getElementById("input-autodebug-cmd");
const selectAutodebugIterations = document.getElementById("select-autodebug-iterations");

// Autonomous Agentic Loop Modal Elements
const btnOpenAgentLoop = document.getElementById("btn-open-agentloop");
const agentLoopModal = document.getElementById("agentloop-modal");
const btnCloseAgentLoopModal = document.getElementById("btn-close-agentloop-modal");
const btnCancelAgentLoop = document.getElementById("btn-cancel-agentloop");
const btnRunAgentLoop = document.getElementById("btn-run-agentloop");
const inputAgentLoopTask = document.getElementById("input-agentloop-task");
const inputAgentLoopTestCmd = document.getElementById("input-agentloop-testcmd");
const selectAgentLoopMaxSteps = document.getElementById("select-agentloop-maxsteps");

// CMUX Process Multiplexer Elements
const cmuxProcessList = document.getElementById("cmux-process-list");
const cmuxCurrentStatusBadge = document.getElementById("cmux-current-status-badge");
const cmuxCurrentName = document.getElementById("cmux-current-name");
const cmuxCurrentCmd = document.getElementById("cmux-current-cmd");
const cmuxActionsToolbar = document.getElementById("cmux-actions-toolbar");
const cmuxLogsViewer = document.getElementById("cmux-logs-viewer");
const btnCmuxNewProcess = document.getElementById("btn-cmux-new-process");
const btnCmuxRefreshList = document.getElementById("btn-cmux-refresh-list");
const btnCmuxRestart = document.getElementById("btn-cmux-restart");
const btnCmuxStop = document.getElementById("btn-cmux-stop");
const btnCmuxClear = document.getElementById("btn-cmux-clear");
const btnCmuxDelete = document.getElementById("btn-cmux-delete");
const cmuxModal = document.getElementById("cmux-modal");
const btnCloseCmuxModal = document.getElementById("btn-close-cmux-modal");
const btnCancelCmux = document.getElementById("btn-cancel-cmux");
const btnSubmitCmuxProcess = document.getElementById("btn-submit-cmux-process");
const inputCmuxName = document.getElementById("input-cmux-name");
const inputCmuxCmd = document.getElementById("input-cmux-cmd");

// Telegram Bot Remote Bridge Elements
const inputTelegramToken = document.getElementById("input-telegram-token");
const inputTelegramChatId = document.getElementById("input-telegram-chatid");
const checkTelegramEnabled = document.getElementById("check-telegram-enabled");
const btnSaveTelegram = document.getElementById("btn-save-telegram");
const telegramStatusText = document.getElementById("telegram-status-text");

let cmuxProcesses = [];
let activeCmuxProcessId = null;

let activePreviewFilePath = "";
let activeExplorerFilePath = "";

// Stats Elements
const statTotalTokens = document.getElementById("stat-total-tokens");
const statSavings = document.getElementById("stat-savings");
const statSpeed = document.getElementById("stat-speed");
const statUptime = document.getElementById("stat-uptime");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initWebSocket();
  fetchModels();
  attachWorkspace(attachedWorkspacePath);
  fetchCmuxProcesses();
  fetchTelegramStatus();
  fetchStats();
  setInterval(fetchStats, 3000);
  setInterval(fetchCmuxProcesses, 4000);
  initEventListeners();
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = tab.getAttribute("data-tab");
      if (tabName) switchTab(tabName);
    });
  });
}

window.switchTab = function(tabName) {
  const tabs = document.querySelectorAll(".nav-tab");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach(t => {
    if (t.getAttribute("data-tab") === tabName) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  panes.forEach(p => {
    if (p.id === `tab-${tabName}`) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  if (tabName === "explorer") {
    attachWorkspace(attachedWorkspacePath);
  } else if (tabName === "models" || tabName === "settings") {
    fetchModels();
  } else if (tabName === "stats") {
    fetchStats();
  } else if (tabName === "mcp") {
    if (window.fetchMcpServers) window.fetchMcpServers();
  }
};

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "agent_output") {
        appendAgentOutput(msg.data, false);
      } else if (msg.type === "agent_error") {
        appendAgentOutput(msg.data, true);
      } else if (msg.type === "agent_done") {
        setAgentRunningState(false);
      } else if (msg.type === "model_changed") {
        activeModel = msg.model;
        updateActiveModelUI();
      } else if (msg.type === "workspace_attached") {
        renderWorkspaceContext(msg.context);
      } else if (msg.type === "keys_updated") {
        apiKeysStatus.hasGeminiKey = msg.hasGeminiKey;
        apiKeysStatus.hasGroqKey = msg.hasGroqKey;
        apiKeysStatus.hasOpenRouterKey = msg.hasOpenRouterKey;
        apiKeysStatus.hasCerebrasKey = msg.hasCerebrasKey;
        apiKeysStatus.hasSambaNovaKey = msg.hasSambaNovaKey;
        apiKeysStatus.hasMistralKey = msg.hasMistralKey;
        updateKeyBadges();
      } else if (msg.type === "process_log") {
        if (msg.id === activeCmuxProcessId && cmuxLogsViewer) {
          cmuxLogsViewer.textContent += `\n${msg.log}`;
          cmuxLogsViewer.scrollTop = cmuxLogsViewer.scrollHeight;
        }
      } else if (msg.type === "process_started" || msg.type === "process_status" || msg.type === "process_exit" || msg.type === "process_deleted") {
        fetchCmuxProcesses();
      }
    } catch {}
  };

  socket.onclose = () => {
    setTimeout(initWebSocket, 2000);
  };
}

// Attach & Inspect Workspace
async function attachWorkspace(path) {
  try {
    const res = await fetch("/api/workspace/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (data.success && data.context) {
      attachedWorkspacePath = path;
      renderWorkspaceContext(data.context);
    }
  } catch (err) {
    console.error("Error attaching workspace:", err);
  }
}

// Open Native System Folder Picker (macOS Finder or Windows Explorer)
window.openNativeFolderPicker = async function openNativeFolderPicker() {
  try {
    // 1. If running inside Tauri Desktop App
    if (window.__TAURI__ && window.__TAURI__.core) {
      try {
        const chosenPath = await window.__TAURI__.core.invoke("pick_folder");
        if (chosenPath) {
          attachedWorkspacePath = chosenPath;
          await attachWorkspace(chosenPath);
          appendAgentOutput(`\n[Custom Claude Coder] Workspace aggiornato: ${chosenPath}\n`, false);
          return;
        }
      } catch (tauriErr) {
        console.warn("Tauri pick_folder fallback:", tauriErr);
      }
    }

    // 2. Server REST API Fallback
    const res = await fetch("/api/workspace/pick-dialog", { method: "POST" });
    const data = await res.json();
    if (data.success && data.context) {
      attachedWorkspacePath = data.path;
      renderWorkspaceContext(data.context);
      appendAgentOutput(`\n[Custom Claude Coder] Workspace aggiornato: ${data.path}\n`, false);
    }
  } catch (err) {
    console.error("Error picking folder:", err);
  }
}

// Render Workspace Context
function renderWorkspaceContext(ctx) {
  if (!ctx) return;
  currentProjectContext = ctx;

  headerFolderName.textContent = ctx.folderName;
  sidebarProjectTitle.textContent = ctx.folderName;
  sidebarProjectPath.textContent = ctx.fullPath;
  consolePinnedFolder.textContent = ctx.folderName;
  if (bannerWorkspacePath) bannerWorkspacePath.textContent = ctx.fullPath;
  if (explorerFolderName) explorerFolderName.textContent = ctx.folderName;
  inputFolderTag.textContent = `📁 ${ctx.folderName}`;

  chipFilesCount.textContent = `${ctx.totalFiles} file`;
  chipFramework.textContent = ctx.frameworks ? ctx.frameworks.join(", ") : "Generic";

  if (chipRulesStatus) {
    if (ctx.hasRulesFile) {
      chipRulesStatus.textContent = `📜 ${ctx.rulesFileName}`;
      chipRulesStatus.style.borderColor = "var(--primary-color)";
      chipRulesStatus.style.color = "var(--primary-color)";
      chipRulesStatus.title = `Regole attive lette da ${ctx.rulesFileName}`;
    } else {
      chipRulesStatus.textContent = "📜 Nessuna regola";
      chipRulesStatus.style.borderColor = "";
      chipRulesStatus.style.color = "";
      chipRulesStatus.title = "Nessun file .cursorrules o CLAUDE.md trovato. Clicca per crearne uno.";
    }
  }

  const chipMemoryStatus = document.getElementById("chip-memory-status");
  if (chipMemoryStatus) {
    const memCount = ctx.memoriesCount || (ctx.memories ? ctx.memories.length : 0);
    chipMemoryStatus.textContent = `🧠 ${memCount} Ricordi`;
    chipMemoryStatus.title = ctx.memorySnippet ? `Memoria storica AgentDB / RuVector:\n${ctx.memorySnippet}` : "Nessun ricordo registrato. Gli insight vengono salvati in automatico con Ruflo Swarm.";
    if (memCount > 0) {
      chipMemoryStatus.style.borderColor = "#06b6d4";
      chipMemoryStatus.style.color = "#06b6d4";
    }
  }

  const chipRepoMap = document.getElementById("chip-repo-map");
  if (chipRepoMap) {
    fetch("/api/workspace/repo-map").then(r => r.json()).then(data => {
      chipRepoMap.textContent = `🗺️ ${data.totalSymbols || 0} Simboli AST`;
      chipRepoMap.title = data.mapString ? `Mappa Simboli e Firme Estratti (Aider style):\n${data.mapString.slice(0, 400)}...` : "Mappa AST del progetto pronta";
      if (data.totalSymbols > 0) {
        chipRepoMap.style.borderColor = "#10b981";
        chipRepoMap.style.color = "#10b981";
      }
    }).catch(() => {});
  }

  renderFileTree(ctx.tree, fileTreeContainer, false);
  if (explorerTreeContainer) {
    renderFileTree(ctx.tree, explorerTreeContainer, true);
  }
}

// Open Project Rules Modal
function openRulesModal() {
  if (!currentProjectContext) return;

  if (currentProjectContext.hasRulesFile) {
    selectRulesFileType.value = currentProjectContext.rulesFileName;
    textareaRulesContent.value = currentProjectContext.rulesSnippet || "";
    rulesModalTitle.textContent = `📜 Modifica ${currentProjectContext.rulesFileName}`;
  } else {
    selectRulesFileType.value = ".cursorrules";
    textareaRulesContent.value = generateDefaultRulesTemplate(currentProjectContext.frameworks || []);
    rulesModalTitle.textContent = "📜 Crea Nuove Regole di Progetto";
  }

  rulesModal.style.display = "flex";
}

// Generate Default Rules Template (Enhanced with Ruflo Swarm Meta-Harness Standards)
function generateDefaultRulesTemplate(frameworks = []) {
  const fw = frameworks.join(", ");
  const folder = currentProjectContext ? currentProjectContext.folderName : 'Project';
  
  return `# RUFLO & CLAUDE CODE ENTERPRISE RULES (${folder})
# Frameworks Rilevati: ${fw || 'Standard'}
# Data Inizializzazione: ${new Date().toLocaleDateString()}

## 1. RUOLI ED ESECUZIONE (Ruflo Agentic Standard)
- Sei l'agente esecutivo di programmazione.
- Scomponi compiti complessi in fasi: Pianificazione, Codifica e Verifica/Consenso.
- Non fermarti dopo aver descritto la soluzione: genera sempre il codice sorgente completo e pronto all'uso.
- Evita categoricamente placeholder come '// TODO', '// Codice qui', o implementazioni parziali.

## 2. LINEE GUIDA DI STILE & ARCHITETTURA (${fw || 'Progetto'})
- Mantieni rigorosamente la separazione delle responsabilità (Separation of Concerns).
- Segui le convenzioni idiomatiche di ${fw || 'linguaggio'}.
- Non alterare configurazioni di sistema senza spiegare il motivo.
- Ogni modifica deve preservare la retrocompatibilità del codice esistente.

## 3. VERIFICA & SICUREZZA
- Prima di rilasciare una modifica, convalida la sintassi ed esegui i test unitari.
- Analizza sempre le cause alla radice degli errori prima di applicare modifiche superficiali.
- Registra le convenzioni di progetto riuscite nella memoria persistente AgentDB.
`;
}

// Save Project Rules
async function saveProjectRules() {
  const fileName = selectRulesFileType.value;
  const content = textareaRulesContent.value;

  try {
    const res = await fetch("/api/workspace/rules/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, content })
    });
    const data = await res.json();
    if (data.success && data.context) {
      renderWorkspaceContext(data.context);
      rulesModal.style.display = "none";
      appendAgentOutput(`\n[Custom Claude Coder] Regole di progetto salvate con successo in '${fileName}'!\n`, false);
    } else {
      alert("Errore nel salvataggio delle regole: " + (data.error || "Sconosciuto"));
    }
  } catch (err) {
    alert("Errore di connessione: " + err.message);
  }
}

// Open In External Editor (Cursor, VS Code, Finder, Windsurf)
async function openInEditor(editor, targetPath) {
  const path = targetPath || attachedWorkspacePath;
  try {
    const res = await fetch("/api/workspace/open-in-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor, path })
    });
    const data = await res.json();
    if (data.success) {
      const editorLabel = editor === 'cursor' ? 'Cursor IDE' : editor === 'code' ? 'VS Code' : editor === 'finder' ? 'Finder' : editor;
      appendAgentOutput(`\n[Custom Claude Coder] Aperto in ${editorLabel}: ${path}\n`, false);
    }
  } catch (err) {
    alert(`Impossibile avviare ${editor}. Assicurati che sia installato nel PATH.`);
  }
}

// Open Auto-Debug Modal
window.openAutoDebugModal = function() {
  if (currentProjectContext && currentProjectContext.frameworks) {
    const fw = currentProjectContext.frameworks.join(" ").toLowerCase();
    if (fw.includes("python") && !inputAutodebugCmd.value) inputAutodebugCmd.value = "pytest";
    else if (fw.includes("rust") && !inputAutodebugCmd.value) inputAutodebugCmd.value = "cargo test";
    else if (fw.includes("flutter") && !inputAutodebugCmd.value) inputAutodebugCmd.value = "flutter test";
    else if (!inputAutodebugCmd.value) inputAutodebugCmd.value = "npm test";
  } else if (!inputAutodebugCmd.value) {
    inputAutodebugCmd.value = "npm test";
  }

  autodebugModal.style.display = "flex";
};

window.setAutoDebugCmd = function(cmd) {
  if (inputAutodebugCmd) inputAutodebugCmd.value = cmd;
};

// Open Autonomous Agentic Loop Modal
window.openAgentLoopModal = function() {
  if (agentLoopModal) agentLoopModal.style.display = "flex";
};

// Autonomous Multi-Step Agentic Loop Runner (Cursor Agent / Cline style)
async function runAutonomousLoop(task, testCommand, maxSteps = 8) {
  if (currentAgentRunning) {
    alert("Un task o ciclo è già in esecuzione!");
    return;
  }
  if (!task || !task.trim()) {
    alert("Descrivi un obiettivo per il loop agentico.");
    return;
  }

  setAgentRunningState(true);
  if (agentLoopModal) agentLoopModal.style.display = "none";
  switchTab("tab-workspace");

  appendAgentOutput(`\n======================================================\n🤖 AVVIO LOOP AGENTICO AUTONOMO (Cursor Agent / Cline style)\nObiettivo: ${task}\nComando di test: ${testCommand || "(nessuno)"}\nPassi massimi: ${maxSteps}\nWorkspace: ${attachedWorkspacePath}\n======================================================\n`, false);

  try {
    const res = await fetch("/api/agent/autonomous-loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        testCommand,
        maxSteps,
        workspace: attachedWorkspacePath
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      appendAgentOutput(`\n❌ Errore avvio loop agentico: ${errText}\n`, true);
      setAgentRunningState(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) appendAgentOutput(chunk, false);
    }
  } catch (err) {
    appendAgentOutput(`\n❌ Errore durante l'esecuzione del loop agentico: ${err.message}\n`, true);
  } finally {
    setAgentRunningState(false);
  }
}

// Autonomous Auto-Debug & Test Loop Runner
async function runAutoDebugTestLoop(command, maxIterations = 3) {
  if (currentAgentRunning) {
    alert("Un task o ciclo di debug è già in esecuzione!");
    return;
  }

  setAgentRunningState(true);
  autodebugModal.style.display = "none";
  switchTab("tab-workspace");

  appendAgentOutput(`\n======================================================\n🧪 AVVIO AUTO-DEBUG & SELF-HEALING TEST LOOP (OpenCode Engine)\nComando: ${command}\nIterazioni massime: ${maxIterations}\nWorkspace: ${attachedWorkspacePath}\n======================================================\n`, false);

  try {
    const res = await fetch("/api/agent/autodebug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command,
        maxIterations,
        workspace: attachedWorkspacePath
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      appendAgentOutput(`\n❌ Errore avvio loop: ${errText}\n`, true);
      setAgentRunningState(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (currentEvent === "iteration_start") {
              appendAgentOutput(`\n🔄 [CICLO ${data.iteration}/${data.maxIterations}] Esecuzione comando: \`${data.command}\`...\n`, false);
            } else if (currentEvent === "command_output") {
              if (data.exitCode === 0) {
                appendAgentOutput(`✅ [TERMINAL OUTPUT - EXIT CODE 0]\n${data.stdout || '(Nessun output)'}\n`, false);
              } else {
                appendAgentOutput(`❌ [ERRORE RILEVATO - EXIT CODE ${data.exitCode}]\n${data.stderr || data.stdout}\n`, true);
              }
            } else if (currentEvent === "analyzing_error") {
              appendAgentOutput(`\n🧠 [AUTONOMOUS SWE DEBUGGER] Analisi dello stack trace e ricerca soluzione con ${activeModel}...\n\n`, false);
            } else if (currentEvent === "fix_chunk") {
              appendAgentOutput(data.text, false);
            } else if (currentEvent === "success") {
              appendAgentOutput(`\n\n🎉 ${data.message}\n`, false);
            } else if (currentEvent === "finished") {
              appendAgentOutput(`\n🏁 ${data.message}\n`, false);
            }
          } catch {}
        }
      }
    }

    appendAgentOutput(`\n======================================================\n🏁 Loop di Auto-Debug completato.\n======================================================\n`, false);
    setAgentRunningState(false);
  } catch (err) {
    appendAgentOutput(`\n❌ Errore durante l'esecuzione del loop: ${err.message}\n`, true);
    setAgentRunningState(false);
  }
}

// ==========================================
// CMUX / TMUX PROCESS MULTIPLEXER FUNCTIONS
// ==========================================

// Fetch Background Processes List
async function fetchCmuxProcesses() {
  try {
    const res = await fetch("/api/processes");
    const data = await res.json();
    cmuxProcesses = data.processes || [];
    renderCmuxProcesses();
    if (activeCmuxProcessId) {
      const activeP = cmuxProcesses.find(p => p.id === activeCmuxProcessId);
      if (activeP) updateCmuxActiveHeader(activeP);
    }
  } catch (err) {
    console.error("Error fetching cmux processes:", err);
  }
}

// Render Processes in Left Sidebar
function renderCmuxProcesses() {
  if (!cmuxProcessList) return;
  cmuxProcessList.innerHTML = "";

  if (cmuxProcesses.length === 0) {
    cmuxProcessList.innerHTML = `<div class="tree-loading" style="padding: 12px 0;">Nessun processo avviato.</div>`;
    return;
  }

  cmuxProcesses.forEach(proc => {
    const isSelected = proc.id === activeCmuxProcessId;
    const card = document.createElement("div");
    card.className = "card";
    card.style.padding = "10px 12px";
    card.style.cursor = "pointer";
    card.style.border = isSelected ? "1px solid var(--primary-color)" : "1px solid var(--border-color)";
    card.style.background = isSelected ? "rgba(99, 102, 241, 0.08)" : "var(--bg-card)";

    const isRunning = proc.status === "running";
    const statusBadge = isRunning
      ? `<span class="badge badge-success" style="font-size: 10.5px; padding: 2px 6px;">🟢 PID ${proc.pid || '...'}</span>`
      : `<span class="badge badge-tag" style="font-size: 10.5px; padding: 2px 6px;">🔴 Fermato</span>`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 600; font-size: 13px;">${proc.name}</span>
        ${statusBadge}
      </div>
      <div style="font-family: monospace; font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${proc.command}
      </div>
    `;

    card.onclick = () => selectCmuxProcess(proc.id);
    cmuxProcessList.appendChild(card);
  });
}

// Select a Process and load its full logs
async function selectCmuxProcess(id) {
  activeCmuxProcessId = id;
  renderCmuxProcesses();

  try {
    const res = await fetch(`/api/processes/logs?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data && data.logs) {
      updateCmuxActiveHeader(data);
      if (cmuxLogsViewer) {
        cmuxLogsViewer.textContent = data.logs.length ? data.logs.join("\n") : "// Nessun log generato finora...";
        cmuxLogsViewer.scrollTop = cmuxLogsViewer.scrollHeight;
      }
      if (cmuxActionsToolbar) cmuxActionsToolbar.style.display = "flex";
    }
  } catch (err) {
    if (cmuxLogsViewer) cmuxLogsViewer.textContent = `Errore nel caricamento dei log: ${err.message}`;
  }
}

function updateCmuxActiveHeader(proc) {
  if (cmuxCurrentName) cmuxCurrentName.textContent = proc.name || proc.id;
  if (cmuxCurrentCmd) cmuxCurrentCmd.textContent = proc.command ? `(${proc.command})` : "";
  if (cmuxCurrentStatusBadge) {
    const isRunning = proc.status === "running";
    cmuxCurrentStatusBadge.className = isRunning ? "badge badge-success" : "badge badge-tag";
    cmuxCurrentStatusBadge.textContent = isRunning ? "🟢 In esecuzione" : "🔴 Fermato";
  }
}

// Start New Process
async function startCmuxProcess(name, command, cwd = "") {
  try {
    const res = await fetch("/api/processes/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, command, cwd: cwd || attachedWorkspacePath })
    });
    const data = await res.json();
    if (data.success && data.process) {
      if (cmuxModal) cmuxModal.style.display = "none";
      await fetchCmuxProcesses();
      selectCmuxProcess(data.process.id);
      appendAgentOutput(`\n[cmux] Processo avviato in background: '${name}' (\`${command}\`)\n`, false);
    } else {
      alert("Errore avvio processo: " + (data.error || "Sconosciuto"));
    }
  } catch (err) {
    alert("Errore di connessione: " + err.message);
  }
}

// Stop Process
async function stopCmuxProcess(id) {
  try {
    await fetch("/api/processes/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    await fetchCmuxProcesses();
    if (activeCmuxProcessId === id) selectCmuxProcess(id);
  } catch (err) {
    console.error("Error stopping process:", err);
  }
}

// Restart Process
async function restartCmuxProcess(id) {
  try {
    await fetch("/api/processes/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    await fetchCmuxProcesses();
    if (activeCmuxProcessId === id) selectCmuxProcess(id);
  } catch (err) {
    console.error("Error restarting process:", err);
  }
}

// Clear Process Logs
async function clearCmuxLogs(id) {
  try {
    await fetch("/api/processes/clear-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (cmuxLogsViewer) cmuxLogsViewer.textContent = "// Log puliti.";
  } catch (err) {
    console.error("Error clearing logs:", err);
  }
}

// Delete Process
async function deleteCmuxProcess(id) {
  if (!confirm("Sei sicuro di voler eliminare questo processo dalla lista?")) return;
  try {
    await fetch("/api/processes/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    activeCmuxProcessId = null;
    if (cmuxLogsViewer) cmuxLogsViewer.textContent = "// Seleziona un processo a sinistra...";
    if (cmuxActionsToolbar) cmuxActionsToolbar.style.display = "none";
    if (cmuxCurrentName) cmuxCurrentName.textContent = "Seleziona un processo";
    if (cmuxCurrentCmd) cmuxCurrentCmd.textContent = "";
    if (cmuxCurrentStatusBadge) {
      cmuxCurrentStatusBadge.className = "badge badge-tag";
      cmuxCurrentStatusBadge.textContent = "Nessun processo";
    }
    await fetchCmuxProcesses();
  } catch (err) {
    console.error("Error deleting process:", err);
  }
}

window.cmuxStartPreset = function(name, command) {
  if (inputCmuxName) inputCmuxName.value = name;
  if (inputCmuxCmd) inputCmuxCmd.value = command;
  const inputCmuxCwd = document.getElementById("input-cmux-cwd");
  if (inputCmuxCwd) inputCmuxCwd.value = "";
  if (cmuxModal) cmuxModal.style.display = "flex";
};

// Render File Tree Nodes
function renderFileTree(nodes, container, isExplorerTab) {
  container.innerHTML = "";
  if (!nodes || nodes.length === 0) {
    container.innerHTML = `<div class="tree-loading">Nessun file visibile.</div>`;
    return;
  }

  nodes.forEach(node => {
    const el = document.createElement("div");
    el.className = "tree-node";
    
    const icon = node.isDirectory ? "📁" : getFileIcon(node.name);
    const sizeStr = node.isDirectory ? "" : formatBytes(node.size);

    el.innerHTML = `
      <span class="tree-icon">${icon}</span>
      <span class="tree-name">${node.name}</span>
      ${sizeStr ? `<span class="tree-size">${sizeStr}</span>` : ''}
    `;

    if (!node.isDirectory) {
      el.onclick = () => {
        if (isExplorerTab) {
          viewFileInExplorer(node.path);
        } else {
          previewFile(node.path);
        }
      };
    }

    container.appendChild(el);

    if (node.isDirectory && node.children && node.children.length > 0) {
      const childContainer = document.createElement("div");
      childContainer.style.paddingLeft = "12px";
      renderFileTree(node.children, childContainer, isExplorerTab);
      container.appendChild(childContainer);
    }
  });
}

function getFileIcon(name) {
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "🔷";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "🟨";
  if (name.endsWith(".py")) return "🐍";
  if (name.endsWith(".json")) return "⚙️";
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".html") || name.endsWith(".css")) return "🌐";
  if (name.endsWith(".dart") || name.endsWith(".yaml")) return "🎯";
  return "📄";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Preview File in Modal
async function previewFile(filePath) {
  try {
    activePreviewFilePath = filePath;
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content !== undefined) {
      modalFileName.textContent = data.name;
      modalFileContent.textContent = data.content;
      fileModal.style.display = "flex";
    }
  } catch (err) {
    alert("Impossibile aprire il file: " + err.message);
  }
}

// View File in Explorer Tab
async function viewFileInExplorer(filePath) {
  try {
    activeExplorerFilePath = filePath;
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content !== undefined) {
      explorerCurrentFilename.textContent = data.name;
      explorerCurrentMeta.textContent = `(${data.path})`;
      explorerCodeContent.textContent = data.content;
      if (explorerFileActions) explorerFileActions.style.display = "flex";
    }
  } catch (err) {
    explorerCodeContent.textContent = `Errore nel caricamento: ${err.message}`;
  }
}

// Fetch All Models & Persistent API Keys State
async function fetchModels() {
  try {
    const res = await fetch("/api/models");
    const data = await res.json();

    activeModel = data.activeModel || "qwen2.5:7b";
    apiKeysStatus = data.apiKeysStatus || {};
    localModels = data.localModels || [];
    featuredLocalModels = data.featuredLocalModels || [];
    cerebrasModels = data.cerebrasModels || [];
    sambanovaModels = data.sambanovaModels || [];
    mistralModels = data.mistralModels || [];
    groqModels = data.groqModels || [];
    openrouterModels = data.openrouterModels || [];
    geminiModels = data.geminiModels || [];
    openaiModels = data.openaiModels || [];

    // Pre-populate Persistent Saved Keys in Form
    if (data.savedKeys) {
      if (inputCerebrasKey && data.savedKeys.cerebrasKey) inputCerebrasKey.value = data.savedKeys.cerebrasKey;
      if (inputSambanovaKey && data.savedKeys.sambanovaKey) inputSambanovaKey.value = data.savedKeys.sambanovaKey;
      if (inputMistralKey && data.savedKeys.mistralKey) inputMistralKey.value = data.savedKeys.mistralKey;
      if (inputGroqKey && data.savedKeys.groqKey) inputGroqKey.value = data.savedKeys.groqKey;
      if (inputOpenrouterKey && data.savedKeys.openrouterKey) inputOpenrouterKey.value = data.savedKeys.openrouterKey;
      if (inputGeminiKey && data.savedKeys.geminiKey) inputGeminiKey.value = data.savedKeys.geminiKey;
      if (inputOpenaiKey && data.savedKeys.openaiKey) inputOpenaiKey.value = data.savedKeys.openaiKey;
      if (inputAnthropicKey && data.savedKeys.anthropicKey) inputAnthropicKey.value = data.savedKeys.anthropicKey;
      if (inputDeepseekKey && data.savedKeys.deepseekKey) inputDeepseekKey.value = data.savedKeys.deepseekKey;
      if (inputXaiKey && data.savedKeys.xaiKey) inputXaiKey.value = data.savedKeys.xaiKey;
      if (inputKimiKey && data.savedKeys.kimiKey) inputKimiKey.value = data.savedKeys.kimiKey;
      if (inputQwenKey && data.savedKeys.qwenKey) inputQwenKey.value = data.savedKeys.qwenKey;
      if (inputGlmKey && data.savedKeys.glmKey) inputGlmKey.value = data.savedKeys.glmKey;
      if (inputPerplexityKey && data.savedKeys.perplexityKey) inputPerplexityKey.value = data.savedKeys.perplexityKey;
      if (inputTogetherKey && data.savedKeys.togetherKey) inputTogetherKey.value = data.savedKeys.togetherKey;
      if (inputFireworksKey && data.savedKeys.fireworksKey) inputFireworksKey.value = data.savedKeys.fireworksKey;
      if (inputCohereKey && data.savedKeys.cohereKey) inputCohereKey.value = data.savedKeys.cohereKey;
      if (inputCustomEndpoint && data.savedKeys.customApiEndpoint) inputCustomEndpoint.value = data.savedKeys.customApiEndpoint;
      if (inputCustomKey && data.savedKeys.customApiKey) inputCustomKey.value = data.savedKeys.customApiKey;
    }

    renderModelDropdown();
    renderLocalModels();
    renderCerebrasModels();
    renderSambaNovaModels();
    renderMistralModels();
    renderGroqModels();
    renderOpenRouterModels();
    renderGeminiModels();
    renderOpenAIModels();
    updateActiveModelUI();
    updateKeyBadges();
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

// Update API Key Badges
function updateKeyBadges() {
  const setBadge = (el, hasKey, name) => {
    if (!el) return;
    el.className = hasKey ? "badge badge-success" : "badge badge-tag";
    el.textContent = hasKey ? `✓ ${name} Key Attiva` : "API Key: Non impostata";
  };

  setBadge(badgeCerebrasStatus, apiKeysStatus.hasCerebrasKey, "Cerebras");
  setBadge(badgeSambanovaStatus, apiKeysStatus.hasSambaNovaKey, "SambaNova");
  setBadge(badgeMistralStatus, apiKeysStatus.hasMistralKey, "Mistral");
  setBadge(badgeGroqStatus, apiKeysStatus.hasGroqKey, "Groq");
  setBadge(badgeOpenrouterStatus, apiKeysStatus.hasOpenRouterKey, "OpenRouter");
  setBadge(badgeGeminiStatus, apiKeysStatus.hasGeminiKey, "Gemini");
  setBadge(badgeOpenaiStatus, apiKeysStatus.hasOpenAIKey, "OpenAI");
}

// Render Dropdown Groups
function renderModelDropdown() {
  quickModelSelect.innerHTML = "";

  const addGroup = (label, models, formatFn) => {
    if (!models || models.length === 0) return;
    const group = document.createElement("optgroup");
    group.label = label;
    models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.textContent = formatFn ? formatFn(m) : m.displayName || m.name;
      if (m.name === activeModel) opt.selected = true;
      group.appendChild(opt);
    });
    quickModelSelect.appendChild(group);
  };

  addGroup("⚡ Modelli Locali (Ollama)", localModels, m => m.name);
  addGroup("🤖 OpenAI (ChatGPT)", openaiModels, m => m.displayName);
  addGroup("⚡ Cerebras Cloud (Record ~1800 tok/s)", cerebrasModels, m => `${m.displayName} (~1800 tok/s)`);
  addGroup("🧠 SambaNova Cloud (671B MoE Free)", sambanovaModels, m => `${m.displayName}`);
  addGroup("🎯 Mistral AI (Codestral 256k)", mistralModels, m => `${m.displayName}`);
  addGroup("🚀 Groq Cloud (Free Tier ~400 tok/s)", groqModels, m => `${m.displayName} (~400 tok/s)`);
  addGroup("🌐 OpenRouter (100% Free :free)", openrouterModels, m => `${m.displayName}`);
  addGroup("✨ Google Gemini API", geminiModels, m => `${m.displayName} (${m.context})`);
}

// Generic Model Card Renderer
function createModelCard(m, extraPill) {
  const isAct = m.name === activeModel;
  const card = document.createElement("div");
  card.className = `model-card ${isAct ? 'is-active' : ''}`;
  card.innerHTML = `
    <div>
      <div class="card-header-row">
        <div>
          <div class="card-model-title">${m.displayName}</div>
          <div class="card-model-author">${m.author}</div>
        </div>
        <span class="badge badge-tag">${m.tag}</span>
      </div>
      <p class="card-model-desc" style="margin-top: 8px;">${m.desc}</p>
      <div class="card-badges-row" style="margin-top: 10px;">
        <span class="pill-meta">⚡ ${m.speed}</span>
        <span class="pill-meta">📖 ${m.context}</span>
        ${extraPill ? `<span class="pill-meta">💰 ${extraPill}</span>` : ''}
      </div>
    </div>
    <div style="margin-top: 14px;">
      <button class="btn ${isAct ? 'btn-secondary' : 'btn-primary'}" style="width: 100%;" onclick="setActiveModel('${m.name}')">
        ${isAct ? '✓ Attivo' : 'Usa con Custom Claude Coder'}
      </button>
    </div>
  `;
  return card;
}

// Render Local Models Grid
function renderLocalModels() {
  localModelsGrid.innerHTML = "";

  localModels.forEach(m => {
    const isAct = m.name === activeModel;
    const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(1);
    const paramSize = m.details?.parameter_size || "N/A";
    const quant = m.details?.quantization_level || "Q4";

    const engine = m.engine || "Ollama";
    const title = m.displayName || m.name;
    const card = document.createElement("div");
    card.className = `model-card ${isAct ? 'is-active' : ''}`;
    card.innerHTML = `
      <div>
        <div class="card-header-row">
          <div>
            <div class="card-model-title">${title}</div>
            <div class="card-model-author">${engine} Local • ${paramSize}</div>
          </div>
          ${isAct ? '<span class="badge badge-success">Attivo</span>' : ''}
        </div>
        <div class="card-badges-row" style="margin-top: 10px;">
          ${m.size > 0 ? `<span class="pill-meta">💾 ${sizeGb} GB</span>` : ''}
          <span class="pill-meta">⚙️ ${quant}</span>
          <span class="pill-meta">⚡ ${engine} Local</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button class="btn ${isAct ? 'btn-secondary' : 'btn-primary'}" style="flex: 1;" onclick="setActiveModel('${m.name}')">
          ${isAct ? '✓ Attivo' : 'Seleziona'}
        </button>
        ${engine === 'Ollama' ? `<button class="btn btn-secondary btn-icon" onclick="deleteModel('${m.name}')" title="Elimina modello">🗑️</button>` : ''}
      </div>
    `;
    localModelsGrid.appendChild(card);
  });
}

function renderCerebrasModels() {
  cerebrasModelsGrid.innerHTML = "";
  cerebrasModels.forEach(m => cerebrasModelsGrid.appendChild(createModelCard(m, m.cost)));
}

function renderSambaNovaModels() {
  sambanovaModelsGrid.innerHTML = "";
  sambanovaModels.forEach(m => sambanovaModelsGrid.appendChild(createModelCard(m, m.cost)));
}

function renderMistralModels() {
  mistralModelsGrid.innerHTML = "";
  mistralModels.forEach(m => mistralModelsGrid.appendChild(createModelCard(m, m.cost)));
}

function renderGroqModels() {
  groqModelsGrid.innerHTML = "";
  groqModels.forEach(m => groqModelsGrid.appendChild(createModelCard(m, m.cost)));
}

function renderOpenRouterModels() {
  openrouterModelsGrid.innerHTML = "";
  openrouterModels.forEach(m => openrouterModelsGrid.appendChild(createModelCard(m, m.cost)));
}

function renderGeminiModels() {
  if (geminiModelsGrid) {
    geminiModelsGrid.innerHTML = "";
    geminiModels.forEach(m => geminiModelsGrid.appendChild(createModelCard(m, m.cost)));
  }
}

function renderOpenAIModels() {
  if (openaiModelsGrid) {
    openaiModelsGrid.innerHTML = "";
    openaiModels.forEach(m => openaiModelsGrid.appendChild(createModelCard(m, m.cost)));
  }
}

// Set Active Model
async function setActiveModel(name) {
  try {
    const res = await fetch("/api/models/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name })
    });
    const data = await res.json();
    if (data.success) {
      activeModel = name;
      updateActiveModelUI();
      renderLocalModels();
      renderCerebrasModels();
      renderSambaNovaModels();
      renderMistralModels();
      renderGroqModels();
      renderOpenRouterModels();
      renderGeminiModels();
      renderOpenAIModels();
      appendAgentOutput(`\n[Custom Claude Coder] Modello attivo salvato su: ${name}\n`, false);
    }
  } catch (err) {
    console.error("Error setting active model:", err);
  }
}

function updateActiveModelUI() {
  quickModelSelect.value = activeModel;
  if (consoleModelBadge) consoleModelBadge.textContent = activeModel;
  if (bannerModelName) bannerModelName.textContent = activeModel;
  if (inputModelTag) inputModelTag.textContent = `⚡ ${activeModel}`;

  if (chipActiveProvider) {
    if (activeModel.startsWith("openai/") || activeModel.startsWith("gpt-") || activeModel.startsWith("o1") || activeModel.startsWith("o3")) chipActiveProvider.textContent = "🤖 OpenAI ChatGPT";
    else if (activeModel.startsWith("cerebras/")) chipActiveProvider.textContent = "⚡ Cerebras (~1800 tok/s)";
    else if (activeModel.startsWith("sambanova/")) chipActiveProvider.textContent = "🧠 SambaNova (671B)";
    else if (activeModel.startsWith("mistral/")) chipActiveProvider.textContent = "🎯 Mistral Codestral";
    else if (activeModel.startsWith("groq/")) chipActiveProvider.textContent = "🚀 Groq Cloud (~400 tok/s)";
    else if (activeModel.startsWith("openrouter/")) chipActiveProvider.textContent = "🌐 OpenRouter :free";
    else if (activeModel.startsWith("gemini")) chipActiveProvider.textContent = "✨ Google Gemini API";
    else chipActiveProvider.textContent = "⚡ Local Ollama";
  }
}

// Pull Model from Ollama
async function pullModel(modelName) {
  if (isPulling) {
    alert("Un download è già in corso!");
    return;
  }

  isPulling = true;
  pullProgressCard.style.display = "block";
  progressModelName.textContent = `Download di ${modelName}...`;
  progressStatusText.textContent = "Avvio download da Ollama Registry...";
  progressBarFill.style.width = "0%";

  try {
    const response = await fetch("/api/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.status) {
            progressStatusText.textContent = data.status;
          }
          if (data.total && data.completed) {
            const pct = Math.round((data.completed / data.total) * 100);
            progressBarFill.style.width = `${pct}%`;
            progressStatusText.textContent = `${data.status} (${pct}%)`;
          }
        } catch {}
      }
    }

    progressStatusText.textContent = "Download completato con successo!";
    progressBarFill.style.width = "100%";
    setTimeout(() => {
      pullProgressCard.style.display = "none";
      isPulling = false;
      fetchModels();
    }, 2000);

  } catch (err) {
    progressStatusText.textContent = `Errore: ${err.message}`;
    isPulling = false;
  }
}

// Delete Model
async function deleteModel(name) {
  if (!confirm(`Sei sicuro di voler eliminare ${name} dal disco?`)) return;

  try {
    await fetch("/api/models/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    fetchModels();
  } catch (err) {
    alert("Errore durante l'eliminazione: " + err.message);
  }
}

// Save All API Keys Persistently
async function saveAllApiKeys() {
  const payload = {
    cerebrasKey: inputCerebrasKey ? inputCerebrasKey.value.trim() : "",
    sambanovaKey: inputSambanovaKey ? inputSambanovaKey.value.trim() : "",
    mistralKey: inputMistralKey ? inputMistralKey.value.trim() : "",
    groqKey: inputGroqKey ? inputGroqKey.value.trim() : "",
    openrouterKey: inputOpenrouterKey ? inputOpenrouterKey.value.trim() : "",
    geminiKey: inputGeminiKey ? inputGeminiKey.value.trim() : "",
    openaiKey: inputOpenaiKey ? inputOpenaiKey.value.trim() : "",
    anthropicKey: inputAnthropicKey ? inputAnthropicKey.value.trim() : "",
    deepseekKey: inputDeepseekKey ? inputDeepseekKey.value.trim() : "",
    xaiKey: inputXaiKey ? inputXaiKey.value.trim() : "",
    kimiKey: inputKimiKey ? inputKimiKey.value.trim() : "",
    qwenKey: inputQwenKey ? inputQwenKey.value.trim() : "",
    glmKey: inputGlmKey ? inputGlmKey.value.trim() : "",
    perplexityKey: inputPerplexityKey ? inputPerplexityKey.value.trim() : "",
    togetherKey: inputTogetherKey ? inputTogetherKey.value.trim() : "",
    fireworksKey: inputFireworksKey ? inputFireworksKey.value.trim() : "",
    cohereKey: inputCohereKey ? inputCohereKey.value.trim() : "",
    customApiEndpoint: inputCustomEndpoint ? inputCustomEndpoint.value.trim() : "",
    customApiKey: inputCustomKey ? inputCustomKey.value.trim() : ""
  };

  try {
    const res = await fetch("/api/settings/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      apiKeysStatus = data;
      updateKeyBadges();
      alert("✓ Tutte le chiavi API sono state salvate permanentemente su disco!");
    }
  } catch (err) {
    alert("Errore nel salvataggio delle chiavi: " + err.message);
  }
}

// Telegram Bot Status and Settings
async function fetchTelegramStatus() {
  try {
    const res = await fetch("/api/telegram/status");
    const data = await res.json();
    if (checkTelegramEnabled) checkTelegramEnabled.checked = !!data.enabled;
    if (inputTelegramChatId && data.allowedChatId) inputTelegramChatId.value = data.allowedChatId;
    if (telegramStatusText) {
      if (data.enabled && data.hasToken) {
        telegramStatusText.innerHTML = `<strong style="color: #10b981;">🟢 Connesso & In Ascolto</strong> (Chat ID: ${data.allowedChatId || 'In attesa del primo messaggio...'})`;
      } else if (data.hasToken) {
        telegramStatusText.innerHTML = `<span style="color: #f59e0b;">⏸️ Token presente ma bot disabilitato</span>`;
      } else {
        telegramStatusText.innerHTML = `<span>⚪ Non configurato</span>`;
      }
    }
  } catch (err) {
    console.error("Error fetching telegram status:", err);
  }
}

async function saveTelegramSettings() {
  const token = inputTelegramToken ? inputTelegramToken.value.trim() : "";
  const allowedChatId = inputTelegramChatId ? inputTelegramChatId.value.trim() : "";
  const enabled = checkTelegramEnabled ? checkTelegramEnabled.checked : false;

  try {
    const res = await fetch("/api/telegram/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token || undefined, allowedChatId, enabled })
    });
    const data = await res.json();
    if (data.success) {
      fetchTelegramStatus();
      alert("✓ Impostazioni Telegram salvate con successo!");
    }
  } catch (err) {
    alert("Errore salvataggio Telegram: " + err.message);
  }
}

// Run Agent Prompt on Attached Workspace
async function runAgentPrompt(prompt) {
  if (!prompt.trim()) return;

  // Handle local slash commands
  if (prompt === "/clear") {
    btnClearConsole.click();
    return;
  }
  if (prompt === "/help") {
    appendAgentOutput(`
═══════════════════════════════════════════════════════════════════════
🚀 CUSTOM CLAUDE CODER — GUIDA AI COMANDI RAPIDI (/SLASH COMMANDS)
═══════════════════════════════════════════════════════════════════════
🐝 MULTI-AGENTE & SPECIFICHE
  • /swarm <task>    -> Pipeline Ruflo a 3 agenti (Architetto -> Coder -> Reviewer)
  • /diagram <task>  -> Generatore di diagrammi architetturali visuali (Mermaid.js)
  • /prd <feature>   -> Generatore di Product Requirement Document (MetaGPT)

🧪 QUALITÀ, TEST & BUG FIXING
  • /autofix         -> Auto-Debug & Self-Healing Loop autonomo sui test
  • /review          -> Audit approfondito di sicurezza, bug latenti e best practice
  • /refactor        -> Refactoring modulare, pulizia e ottimizzazione SOLID
  • /test            -> Generazione automatica di suite di test unitari completi
  • /bench           -> Analisi della complessità computazionale (Big-O) e bottlenecks

⚡ DEVOPS, GIT & ENVIRONMENT
  • /commit          -> Smart Git Commit convenzionale automatico basato su diff
  • /secscan         -> Scansione sicurezza per fughe di token/API key nel workspace
  • /docker          -> Generazione Dockerfile multi-stage e docker-compose.yml
  • /ci              -> Generazione workflow GitHub Actions CI/CD automatizzato
  • /env             -> Creazione del file .env.example documentato

📚 DOCUMENTAZIONE & ONBOARDING
  • /explain         -> Spiegazione passo-passo della logica e del flusso dati
  • /doc             -> Creazione automatica di README.md e documentazione API
  • /clear           -> Pulisce lo schermo della console
  • /help            -> Mostra questa schermata di aiuto

🎯 CONTEXT MENTIONS:
  • @file:<percorso> -> Allega il codice di un file specifico al prompt
  • @git o @diff     -> Allega il diff delle modifiche non committate
═══════════════════════════════════════════════════════════════════════
`, false);
    return;
  }

  const userEntry = document.createElement("div");
  userEntry.className = "console-entry user";
  userEntry.textContent = `❯ [${headerFolderName.textContent}] ${prompt}`;
  consoleOutput.appendChild(userEntry);

  const checkSwarmMode = document.getElementById("check-swarm-mode");
  const checkMultiProviderSwarm = document.getElementById("check-multi-provider-swarm");
  const isSwarm = !!(checkSwarmMode && checkSwarmMode.checked) || prompt.startsWith("/swarm") || prompt.startsWith("/ruflo");
  const isMultiProviderSwarm = isSwarm && !!(checkMultiProviderSwarm && checkMultiProviderSwarm.checked);

  const assistantEntry = document.createElement("div");
  assistantEntry.className = "console-entry assistant";
  assistantEntry.id = "current-streaming-entry";
  assistantEntry.textContent = isMultiProviderSwarm
    ? `🐝🌐 Swarm Multi-Provider REALE in avvio (Architetto/Coder/Reviewer su provider cloud diversi)...`
    : isSwarm
    ? `🐝 Ruflo Swarm Pipeline in avvio con ${activeModel} (Architetto -> Coder -> Reviewer)...`
    : `Custom Claude Coder sta elaborando con ${activeModel}...`;
  consoleOutput.appendChild(assistantEntry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;

  setAgentRunningState(true);

  try {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        workspace: attachedWorkspacePath,
        swarmMode: isSwarm,
        multiProviderSwarm: isMultiProviderSwarm
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      assistantEntry.textContent = `Errore (${res.status}): ${errText}`;
      setAgentRunningState(false);
      return;
    }

    // Direct HTTP Stream Reading
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let hasReceivedChunk = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        if (!hasReceivedChunk) {
          assistantEntry.textContent = "";
          hasReceivedChunk = true;
        }
        assistantEntry.textContent += chunk;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
      }
    }

    setAgentRunningState(false);
  } catch (err) {
    assistantEntry.textContent = `Errore di connessione: ${err.message}`;
    setAgentRunningState(false);
  }
}

function appendAgentOutput(text, isError) {
  const currentEntry = document.getElementById("current-streaming-entry");
  if (currentEntry) {
    if (currentEntry.textContent.startsWith("Custom Claude Coder sta elaborando")) {
      currentEntry.textContent = "";
    }
    currentEntry.textContent += text;
    if (isError) currentEntry.classList.add("error");
  } else {
    const entry = document.createElement("div");
    entry.className = `console-entry ${isError ? 'error' : 'assistant'}`;
    entry.textContent = text;
    consoleOutput.appendChild(entry);
  }
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function setAgentRunningState(running) {
  currentAgentRunning = running;
  btnSendPrompt.disabled = running;
  btnStopAgent.style.display = running ? "inline-flex" : "none";
  if (!running) {
    const currentEntry = document.getElementById("current-streaming-entry");
    if (currentEntry) currentEntry.removeAttribute("id");
    attachWorkspace(attachedWorkspacePath);
    renderMermaidDiagrams();
  }
}

// Render Mermaid Architecture & Flow Diagrams (MetaGPT / ChatDev style)
function renderMermaidDiagrams() {
  if (typeof mermaid === "undefined") return;
  try {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const entries = document.querySelectorAll(".console-entry.assistant");
    entries.forEach((entry) => {
      const text = entry.textContent;
      const mermaidMatch = text.match(/```mermaid([\s\S]*?)```/);
      if (mermaidMatch && !entry.querySelector(".mermaid-container")) {
        const diagramCode = mermaidMatch[1].trim();
        const container = document.createElement("div");
        container.className = "mermaid-container";
        container.style.background = "rgba(13, 17, 23, 0.95)";
        container.style.border = "1px solid rgba(99, 102, 241, 0.35)";
        container.style.borderRadius = "8px";
        container.style.padding = "16px";
        container.style.marginTop = "12px";
        container.style.overflowX = "auto";
        
        const id = `mermaid-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        mermaid.render(id, diagramCode).then(({ svg }) => {
          container.innerHTML = `<div style="font-size: 11px; font-weight: 600; color: #818cf8; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;"><span>🎨</span> DIAGRAMMA ARCHITETTURALE (Mermaid)</div>` + svg;
          entry.appendChild(container);
          consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }).catch(err => {
          console.warn("Mermaid render error:", err);
        });
      }
    });
  } catch (e) {
    console.warn("Mermaid error:", e);
  }
}

// Stop Agent Task
async function stopAgent() {
  try {
    await fetch("/api/agent/stop", { method: "POST" });
    setAgentRunningState(false);
    appendAgentOutput("\n[Interrotto dall'utente]\n", true);
  } catch {}
}

// Fetch Telemetry Stats
async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    statTotalTokens.textContent = Number(data.totalTokens).toLocaleString();
    statSavings.textContent = `€ ${data.savingsUsd}`;
    statSpeed.textContent = data.tokensPerSec;

    const mins = Math.floor(data.uptimeSeconds / 60);
    const secs = data.uptimeSeconds % 60;
    statUptime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } catch {}
}

// Event Listeners
function initEventListeners() {
  agentPromptForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = agentPromptInput.value.trim();
    if (prompt) {
      runAgentPrompt(prompt);
      agentPromptInput.value = "";
    }
  });

  agentPromptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      agentPromptForm.dispatchEvent(new Event("submit"));
    }
  });

  quickModelSelect.addEventListener("change", (e) => {
    setActiveModel(e.target.value);
  });

  btnStopAgent.addEventListener("click", stopAgent);

  btnClearConsole.addEventListener("click", () => {
    const banner = document.querySelector(".claude-terminal-banner");
    const bannerHTML = banner ? banner.outerHTML : '<div class="claude-terminal-banner"><pre class="ascii-logo">CUSTOM CLAUDE CODER</pre></div>';
    consoleOutput.innerHTML = bannerHTML;
  });

  btnPullCustom.addEventListener("click", () => {
    const model = customModelInput.value.trim();
    if (model) {
      pullModel(model);
      customModelInput.value = "";
    }
  });

  if (btnSaveAllKeys) {
    btnSaveAllKeys.addEventListener("click", saveAllApiKeys);
  }

  if (btnSaveTelegram) {
    btnSaveTelegram.addEventListener("click", saveTelegramSettings);
  }

  // Folder Pickers
  btnBrowseFolder.addEventListener("click", openNativeFolderPicker);
  btnReselectFolder.addEventListener("click", openNativeFolderPicker);
  if (btnExplorerBrowse) btnExplorerBrowse.addEventListener("click", openNativeFolderPicker);
  btnRefreshTree.addEventListener("click", () => attachWorkspace(attachedWorkspacePath));

  // Editor & Rules Handlers
  if (btnEditRules) btnEditRules.addEventListener("click", openRulesModal);
  if (btnOpenCursor) btnOpenCursor.addEventListener("click", () => openInEditor("cursor"));
  if (btnOpenVscode) btnOpenVscode.addEventListener("click", () => openInEditor("code"));
  if (chipRulesStatus) chipRulesStatus.addEventListener("click", openRulesModal);

  // Explorer File Actions
  if (btnExplorerOpenCursor) btnExplorerOpenCursor.addEventListener("click", () => openInEditor("cursor", activeExplorerFilePath));
  if (btnExplorerOpenVscode) btnExplorerOpenVscode.addEventListener("click", () => openInEditor("code", activeExplorerFilePath));
  if (btnExplorerOpenFinder) btnExplorerOpenFinder.addEventListener("click", () => openInEditor("finder", activeExplorerFilePath));

  // Modal File Actions
  if (btnModalOpenCursor) btnModalOpenCursor.addEventListener("click", () => openInEditor("cursor", activePreviewFilePath));
  if (btnModalOpenVscode) btnModalOpenVscode.addEventListener("click", () => openInEditor("code", activePreviewFilePath));
  if (btnModalOpenFinder) btnModalOpenFinder.addEventListener("click", () => openInEditor("finder", activePreviewFilePath));

  // Rules Modal Actions
  if (btnCloseRulesModal) btnCloseRulesModal.addEventListener("click", () => rulesModal.style.display = "none");
  if (btnCancelRules) btnCancelRules.addEventListener("click", () => rulesModal.style.display = "none");
  if (btnSaveRules) btnSaveRules.addEventListener("click", saveProjectRules);
  if (btnInsertRulesTemplate) {
    btnInsertRulesTemplate.addEventListener("click", () => {
      textareaRulesContent.value = generateDefaultRulesTemplate(currentProjectContext ? currentProjectContext.frameworks || [] : []);
    });
  }
  if (rulesModal) {
    rulesModal.addEventListener("click", (e) => {
      if (e.target === rulesModal) rulesModal.style.display = "none";
    });
  }

  // Auto-Debug Modal Actions
  if (btnOpenAutodebug) btnOpenAutodebug.addEventListener("click", window.openAutoDebugModal);
  if (btnCloseAutodebugModal) btnCloseAutodebugModal.addEventListener("click", () => autodebugModal.style.display = "none");
  if (btnCancelAutodebug) btnCancelAutodebug.addEventListener("click", () => autodebugModal.style.display = "none");
  if (btnRunAutodebug) {
    btnRunAutodebug.addEventListener("click", () => {
      const cmd = inputAutodebugCmd.value.trim() || "npm test";
      const maxIters = parseInt(selectAutodebugIterations.value, 10) || 3;
      runAutoDebugTestLoop(cmd, maxIters);
    });
  }
  if (autodebugModal) {
    autodebugModal.addEventListener("click", (e) => {
      if (e.target === autodebugModal) autodebugModal.style.display = "none";
    });
  }

  // Autonomous Agentic Loop Modal Actions
  if (btnOpenAgentLoop) btnOpenAgentLoop.addEventListener("click", window.openAgentLoopModal);
  if (btnCloseAgentLoopModal) btnCloseAgentLoopModal.addEventListener("click", () => agentLoopModal.style.display = "none");
  if (btnCancelAgentLoop) btnCancelAgentLoop.addEventListener("click", () => agentLoopModal.style.display = "none");
  if (btnRunAgentLoop) {
    btnRunAgentLoop.addEventListener("click", () => {
      const task = inputAgentLoopTask.value.trim();
      const testCommand = inputAgentLoopTestCmd.value.trim();
      const maxSteps = parseInt(selectAgentLoopMaxSteps.value, 10) || 8;
      runAutonomousLoop(task, testCommand, maxSteps);
    });
  }
  if (agentLoopModal) {
    agentLoopModal.addEventListener("click", (e) => {
      if (e.target === agentLoopModal) agentLoopModal.style.display = "none";
    });
  }

  // CMUX Process Multiplexer Actions
  if (btnCmuxNewProcess) {
    btnCmuxNewProcess.addEventListener("click", () => {
      if (inputCmuxName) inputCmuxName.value = "";
      if (inputCmuxCmd) inputCmuxCmd.value = "";
      if (cmuxModal) cmuxModal.style.display = "flex";
    });
  }
  if (btnCloseCmuxModal) btnCloseCmuxModal.addEventListener("click", () => cmuxModal.style.display = "none");
  if (btnCancelCmux) btnCancelCmux.addEventListener("click", () => cmuxModal.style.display = "none");
  if (btnCmuxRefreshList) btnCmuxRefreshList.addEventListener("click", fetchCmuxProcesses);
  if (btnCmuxRestart) btnCmuxRestart.addEventListener("click", () => activeCmuxProcessId && restartCmuxProcess(activeCmuxProcessId));
  if (btnCmuxStop) btnCmuxStop.addEventListener("click", () => activeCmuxProcessId && stopCmuxProcess(activeCmuxProcessId));
  if (btnCmuxClear) btnCmuxClear.addEventListener("click", () => activeCmuxProcessId && clearCmuxLogs(activeCmuxProcessId));
  if (btnCmuxDelete) btnCmuxDelete.addEventListener("click", () => activeCmuxProcessId && deleteCmuxProcess(activeCmuxProcessId));
  if (btnSubmitCmuxProcess) {
    btnSubmitCmuxProcess.addEventListener("click", () => {
      const name = inputCmuxName.value.trim() || "Processo Dev";
      const cmd = inputCmuxCmd.value.trim();
      const inputCmuxCwd = document.getElementById("input-cmux-cwd");
      const cwd = inputCmuxCwd ? inputCmuxCwd.value.trim() : "";
      if (!cmd) {
        alert("Inserisci il comando da eseguire!");
        return;
      }
      startCmuxProcess(name, cmd, cwd);
    });
  }
  if (cmuxModal) {
    cmuxModal.addEventListener("click", (e) => {
      if (e.target === cmuxModal) cmuxModal.style.display = "none";
    });
  }

  // Modal Close
  btnCloseModal.addEventListener("click", () => {
    fileModal.style.display = "none";
  });
  fileModal.addEventListener("click", (e) => {
    if (e.target === fileModal) fileModal.style.display = "none";
  });
}

// Quick Prompt Helper
window.sendQuickPrompt = function(prompt) {
  agentPromptInput.value = prompt;
  agentPromptInput.focus();
};

// ========================================================
// 🔌 MCP (MODEL CONTEXT PROTOCOL) CLIENT
// ========================================================
let cachedMcpServers = [];

window.fetchMcpServers = async function() {
  const grid = document.getElementById("mcp-servers-grid");
  if (!grid) return;
  
  try {
    const res = await fetch("/api/mcp/servers");
    const data = await res.json();
    if (data.servers) {
      cachedMcpServers = data.servers;
      renderMcpServers(data.servers);
    }
  } catch (e) {
    console.error("Error fetching MCP servers:", e);
  }
};

function renderMcpServers(servers) {
  const grid = document.getElementById("mcp-servers-grid");
  if (!grid) return;
  grid.innerHTML = "";

  servers.forEach((s) => {
    const card = document.createElement("div");
    card.className = "model-card";
    card.style.position = "relative";
    if (s.enabled) card.style.borderColor = "var(--primary-color)";

    card.innerHTML = `
      <div class="model-header" style="align-items: flex-start;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">${s.icon || '🔌'}</span>
          <div>
            <div class="model-name">${s.name}</div>
            <div class="model-author">${s.category || 'MCP Server'}</div>
          </div>
        </div>
        <label class="tag" style="cursor: pointer; display: flex; align-items: center; gap: 6px; background: ${s.enabled ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)'};">
          <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="window.toggleMcpServer('${s.id}')">
          <span style="font-weight: 600; color: ${s.enabled ? 'var(--primary-color)' : 'var(--text-muted)'};">${s.enabled ? 'ATTIVO' : 'DISATTIVO'}</span>
        </label>
      </div>

      <p class="model-desc" style="margin: 10px 0 14px 0;">${s.desc}</p>

      <div style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; word-break: break-all;">
        <span style="color: #6ee7b7;">${s.command}</span> ${s.args ? s.args.join(' ') : ''}
      </div>

      ${s.envKey ? `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; color: var(--text-muted);">${s.envKey}:</label>
          <input type="password" class="api-key-input" id="mcp-env-${s.id}" placeholder="${s.envPlaceholder || 'Inserisci Token/Chiave...'}" style="width: 100%; font-size: 12px;">
        </div>
      ` : ''}
    `;
    grid.appendChild(card);
  });
}

window.toggleMcpServer = async function(id) {
  try {
    const res = await fetch("/api/mcp/servers/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      window.fetchMcpServers();
    }
  } catch (e) {
    alert("Errore modifica MCP server: " + e.message);
  }
};

window.exportMcpConfig = async function(target = "claude") {
  try {
    const envValues = {};
    cachedMcpServers.forEach((s) => {
      if (s.envKey) {
        const inp = document.getElementById(`mcp-env-${s.id}`);
        if (inp && inp.value.trim()) envValues[s.envKey] = inp.value.trim();
      }
    });

    const res = await fetch("/api/mcp/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, envValues })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Configurazione MCP esportata con successo per ${target === 'cursor' ? 'Cursor IDE' : 'Claude Code CLI'} in:\n${data.exportPath}\n(${data.activeCount} server attivi)`);
    } else {
      alert("Errore esportazione: " + data.error);
    }
  } catch (e) {
    alert("Errore esportazione MCP: " + e.message);
  }
};

// ========================================================
// ⚡ SMART GIT COMMIT & SECURITY SCAN (RUFLO SUPERPOWERS)
// ========================================================
window.runSmartGitCommit = async function() {
  try {
    const statusRes = await fetch("/api/workspace/git/status");
    const status = await statusRes.json();
    if (!status.isGit) {
      alert("La cartella attiva non è un repository Git inizializzato.");
      return;
    }
    if (!status.hasChanges) {
      alert("Nessuna modifica Git rilevata nel workspace attivo.");
      return;
    }

    const defaultMsg = `feat: update project modules (${status.files.length} files modified)`;
    const msg = prompt(`⚡ Smart Git Commit (${status.files.length} file modificati):\n\n${status.diffSummary || status.rawStatus}\n\nInserisci messaggio di commit:`, defaultMsg);
    if (!msg) return;

    const commitRes = await fetch("/api/workspace/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    const commitData = await commitRes.json();
    if (commitData.success) {
      appendAgentOutput(`\n[Git Smart Commit] ✅ Commit effettuato con successo: "${msg}"\n${commitData.output}\n`, false);
    } else {
      alert("Errore durante il commit: " + commitData.output);
    }
  } catch (e) {
    alert("Errore Git: " + e.message);
  }
};

window.runSecurityScan = async function() {
  try {
    appendAgentOutput(`\n[Security Audit] 🛡️ Scansione segreti e leak di token API in corso...\n`, false);
    const res = await fetch("/api/workspace/security/scan");
    const data = await res.json();
    if (data.isSafe) {
      appendAgentOutput(`\n[Security Audit] ✅ Nessun token o chiave API privata esposta nel workspace. Il codice è sicuro per il commit!\n`, false);
    } else {
      appendAgentOutput(`\n[Security Audit] ⚠️ ATTENZIONE: Rilevati ${data.totalFindings} potenziali segreti esposti:\n` + 
        data.findings.map(f => `  • ${f.file}:${f.line} -> [${f.type}] snippet: "${f.snippet}"`).join("\n") + "\n", false);
    }
  } catch (e) {
    alert("Errore scansione sicurezza: " + e.message);
  }
};

// ========================================================
// 🗺️ AST REPO MAP MODAL & FILE EXPLORER ACTIONS
// ========================================================
window.openAstModal = async function() {
  const modal = document.getElementById("ast-modal");
  const content = document.getElementById("ast-modal-content");
  const stats = document.getElementById("ast-modal-stats");
  if (!modal || !content) return;
  modal.style.display = "flex";
  content.textContent = "Caricamento mappa simboli AST in corso...";
  try {
    const res = await fetch("/api/workspace/repo-map");
    const data = await res.json();
    content.textContent = data.mapString || "Nessun simbolo esportato rilevato nel progetto.";
    if (stats) stats.textContent = `${data.totalSymbols || 0} simboli (funzioni, classi, interfacce) estratti`;
  } catch (e) {
    content.textContent = "Errore caricamento mappa AST: " + e.message;
  }
};

window.explorerGenerateTest = function() {
  if (!activeExplorerFilePath) {
    alert("Seleziona prima un file dall'albero!");
    return;
  }
  switchTab("workspace");
  sendQuickPrompt(`Genera una suite di unit test completa, isolata e pronta all'uso per il file @file:${activeExplorerFilePath}`);
};

window.explorerGenerateDoc = function() {
  if (!activeExplorerFilePath) {
    alert("Seleziona prima un file dall'albero!");
    return;
  }
  switchTab("workspace");
  sendQuickPrompt(`Genera la documentazione JSDoc / Docstring e un riepilogo architetturale per il file @file:${activeExplorerFilePath}`);
};

window.explorerRefactor = function() {
  if (!activeExplorerFilePath) {
    alert("Seleziona prima un file dall'albero!");
    return;
  }
  switchTab("workspace");
  sendQuickPrompt(`/refactor Ottimizza le performance, la modularità e pulisci il codice del file @file:${activeExplorerFilePath}`);
};

window.setCmuxPreset = function(name, cmd, cwd) {
  const inputName = document.getElementById("input-cmux-name");
  const inputCmd = document.getElementById("input-cmux-cmd");
  const inputCwd = document.getElementById("input-cmux-cwd");
  if (inputName) inputName.value = name;
  if (inputCmd) inputCmd.value = cmd;
  if (inputCwd) inputCwd.value = cwd;
};

// ========================================================
// 🎙️ VOICE-TO-CODE HANDS-FREE DICTATION (WHISPER / SPEECH)
// ========================================================
let speechRecognitionInstance = null;
let isRecordingVoice = false;

window.toggleVoiceDictation = function() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Il tuo browser o ambiente non supporta l'API Web SpeechRecognition. Usa Chrome o Edge su macOS/Windows/Linux.");
    return;
  }

  const voiceTag = document.getElementById("voice-status-tag");
  const voiceIcon = document.getElementById("voice-icon");
  const promptInput = document.getElementById("agent-prompt-input");

  if (isRecordingVoice) {
    if (speechRecognitionInstance) {
      try { speechRecognitionInstance.stop(); } catch {}
    }
    isRecordingVoice = false;
    if (voiceTag) voiceTag.style.display = "none";
    if (voiceIcon) voiceIcon.textContent = "🎙️";
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = true;
  speechRecognitionInstance.interimResults = true;
  speechRecognitionInstance.lang = "it-IT";

  speechRecognitionInstance.onstart = function() {
    isRecordingVoice = true;
    if (voiceTag) voiceTag.style.display = "inline-flex";
    if (voiceIcon) voiceIcon.textContent = "🔴";
  };

  speechRecognitionInstance.onresult = function(event) {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    if (promptInput) {
      promptInput.value = (promptInput.value ? promptInput.value.trim() + " " : "") + transcript;
      promptInput.focus();
    }
  };

  speechRecognitionInstance.onerror = function(err) {
    console.warn("Speech recognition error:", err);
    if (voiceTag) voiceTag.style.display = "none";
    if (voiceIcon) voiceIcon.textContent = "🎙️";
    isRecordingVoice = false;
  };

  speechRecognitionInstance.onend = function() {
    isRecordingVoice = false;
    if (voiceTag) voiceTag.style.display = "none";
    if (voiceIcon) voiceIcon.textContent = "🎙️";
  };

  try {
    speechRecognitionInstance.start();
  } catch (e) {
    console.error("Could not start speech recognition:", e);
  }
};

// ========================================================
// 🎙️🧠 REAL LOCAL WHISPER DICTATION (whisper.cpp, non browser)
// Alternativa reale alla SpeechRecognition sopra: registra audio col
// MediaRecorder del browser e lo invia a /api/voice/transcribe, dove il
// server esegue una trascrizione Whisper REALE in locale (whisper.cpp).
// ========================================================
let whisperMediaRecorder = null;
let whisperAudioChunks = [];
let isRecordingWhisper = false;

window.toggleWhisperDictation = async function() {
  const whisperTag = document.getElementById("whisper-status-tag");
  const whisperIcon = document.getElementById("whisper-icon");
  const promptInput = document.getElementById("agent-prompt-input");

  if (isRecordingWhisper) {
    if (whisperMediaRecorder && whisperMediaRecorder.state !== "inactive") {
      whisperMediaRecorder.stop();
    }
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Il tuo browser non supporta la registrazione audio (getUserMedia).");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    whisperAudioChunks = [];
    whisperMediaRecorder = new MediaRecorder(stream);

    whisperMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) whisperAudioChunks.push(e.data);
    };

    whisperMediaRecorder.onstart = () => {
      isRecordingWhisper = true;
      if (whisperTag) { whisperTag.style.display = "inline-flex"; whisperTag.textContent = "🔴 Registrazione Whisper..."; }
      if (whisperIcon) whisperIcon.textContent = "🔴";
    };

    whisperMediaRecorder.onstop = async () => {
      isRecordingWhisper = false;
      stream.getTracks().forEach(t => t.stop());
      if (whisperIcon) whisperIcon.textContent = "🧠";

      const blob = new Blob(whisperAudioChunks, { type: whisperMediaRecorder.mimeType || "audio/webm" });
      if (whisperTag) whisperTag.textContent = "⏳ Trascrizione Whisper reale in corso...";

      try {
        const res = await fetch("/api/voice/transcribe?lang=it", {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore trascrizione");

        if (promptInput && data.text) {
          promptInput.value = (promptInput.value ? promptInput.value.trim() + " " : "") + data.text.trim();
          promptInput.focus();
        }
      } catch (e) {
        console.error("Whisper transcription error:", e);
        alert(`Trascrizione Whisper fallita: ${e.message}`);
      } finally {
        if (whisperTag) whisperTag.style.display = "none";
      }
    };

    whisperMediaRecorder.start();
  } catch (e) {
    console.error("Could not start whisper recording:", e);
    alert(`Impossibile accedere al microfono: ${e.message}`);
  }
};

// ========================================================
// 🧠 MEMGPT / LETTA 3-TIER HIERARCHICAL MEMORY UI
// ========================================================
window.openMemoryModal = async function() {
  const modal = document.getElementById("memory-modal");
  const scratchpad = document.getElementById("memory-scratchpad-input");
  const list = document.getElementById("memory-items-list");
  if (!modal) return;
  modal.style.display = "flex";

  try {
    const res = await fetch("/api/memory/tiers");
    const data = await res.json();
    if (scratchpad) scratchpad.value = data.workingScratchpad || "";
    renderMemoryList(data);
  } catch (e) {
    if (list) list.innerHTML = `<div style="color: #f87171;">Errore caricamento memoria: ${e.message}</div>`;
  }
};

function renderMemoryList(data) {
  const list = document.getElementById("memory-items-list");
  if (!list) return;
  list.innerHTML = "";

  const allItems = [
    ...(data.archival || []).map(m => ({ ...m, tierName: "🏛️ Archival", tierColor: "#38bdf8" })),
    ...(data.episodic || []).map(m => ({ ...m, tierName: "⚡ Episodic", tierColor: "#a78bfa" }))
  ];

  if (allItems.length === 0) {
    list.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 8px;">Nessun ricordo salvato in AgentDB. Clicca su "+ Aggiungi Ricordo" per crearne uno.</div>`;
    return;
  }

  allItems.forEach(item => {
    const card = document.createElement("div");
    card.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 4px;";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 10.5px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: ${item.tierColor}; font-weight: 600;">${item.tierName}</span>
          <strong style="font-size: 12.5px; color: #fff;">${item.topic || 'Appunto'}</strong>
        </div>
        <button class="btn-icon" style="color: #f87171; font-size: 12px; cursor: pointer;" onclick="window.deleteMemoryItem('${item.id}')" title="Elimina ricordo">🗑️</button>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${item.insight}</div>
      <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${new Date(item.timestamp).toLocaleString()}</div>
    `;
    list.appendChild(card);
  });
}

window.saveWorkingScratchpad = async function() {
  const input = document.getElementById("memory-scratchpad-input");
  const val = input ? input.value : "";
  try {
    await fetch("/api/memory/tiers/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "working", workingScratchpad: val })
    });
    alert("✓ Working Scratchpad salvato con successo!");
  } catch (e) {
    alert("Errore salvataggio: " + e.message);
  }
};

window.showAddMemoryForm = function() {
  const form = document.getElementById("memory-add-form");
  if (form) form.style.display = form.style.display === "none" ? "block" : "none";
};

window.submitNewMemoryItem = async function() {
  const topic = document.getElementById("input-new-mem-topic")?.value.trim();
  const tier = document.getElementById("select-new-mem-tier")?.value || "archival";
  const insight = document.getElementById("input-new-mem-insight")?.value.trim();
  if (!insight) {
    alert("Inserisci il testo dell'insight!");
    return;
  }
  try {
    const res = await fetch("/api/memory/tiers/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, topic, insight })
    });
    const data = await res.json();
    document.getElementById("memory-add-form").style.display = "none";
    if (document.getElementById("input-new-mem-topic")) document.getElementById("input-new-mem-topic").value = "";
    if (document.getElementById("input-new-mem-insight")) document.getElementById("input-new-mem-insight").value = "";
    renderMemoryList(data.memory);
  } catch (e) {
    alert("Errore salvataggio: " + e.message);
  }
};

window.deleteMemoryItem = async function(id) {
  if (!confirm("Sei sicuro di voler eliminare questo ricordo da AgentDB?")) return;
  try {
    const res = await fetch("/api/memory/tiers/item", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    renderMemoryList(data.memory);
  } catch (e) {
    alert("Errore eliminazione: " + e.message);
  }
};
