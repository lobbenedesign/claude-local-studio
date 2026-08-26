/**
 * 🔌 MCP (MODEL CONTEXT PROTOCOL) SERVERS REGISTRY
 * ------------------------------------------------------
 * Solo gestione di configurazione/export JSON — non avvia processi MCP
 * reali né li interroga. Persiste in `<workspace>/.claude/mcp_config.json`.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 2) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 */
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export const DEFAULT_MCP_CATALOG = [
  {
    id: "github",
    name: "GitHub MCP",
    icon: "🐙",
    desc: "Gestione repository, issue, pull request, commit e ricerca codice su GitHub.",
    category: "DevOps & VCS",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    envKey: "GITHUB_PERSONAL_ACCESS_TOKEN",
    envPlaceholder: "ghp_...",
    enabled: false
  },
  {
    id: "postgres",
    name: "PostgreSQL & Supabase MCP",
    icon: "🐘",
    desc: "Ispezione schema database, query SQL in sola lettura, tabelle e relazioni.",
    category: "Databases",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@localhost:5432/mydb"],
    envKey: "POSTGRES_CONNECTION_STRING",
    envPlaceholder: "postgresql://postgres:password@localhost:5432/dbname",
    enabled: false
  },
  {
    id: "sqlite",
    name: "SQLite & DuckDB MCP",
    icon: "🗄️",
    desc: "Query ed esplorazione di database SQLite locali e file analitici DuckDB.",
    category: "Databases",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data.db"],
    envKey: "",
    envPlaceholder: "",
    enabled: false
  },
  {
    id: "puppeteer",
    name: "Playwright & Puppeteer Browser MCP",
    icon: "🌐",
    desc: "Navigazione web autonoma, screenshot di pagine, scraping e test di UI interattive.",
    category: "Browser & Testing",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    envKey: "",
    envPlaceholder: "",
    enabled: false
  },
  {
    id: "brave-search",
    name: "Brave Search & Live Web MCP",
    icon: "🔍",
    desc: "Ricerca web in tempo reale e grounding di documentazione tecnica aggiornata.",
    category: "Web & Search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    envKey: "BRAVE_API_KEY",
    envPlaceholder: "BSA...",
    enabled: false
  },
  {
    id: "notion",
    name: "Notion & Knowledge Base MCP",
    icon: "📝",
    desc: "Accesso, lettura e creazione di pagine, documenti e database Notion.",
    category: "Productivity",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-notion"],
    envKey: "NOTION_API_TOKEN",
    envPlaceholder: "secret_...",
    enabled: false
  },
  {
    id: "linear",
    name: "Linear & Jira Issue Tracker MCP",
    icon: "🎯",
    desc: "Creazione e sincronizzazione di issue, sprint, backlog e ticket di progetto.",
    category: "Project Management",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-linear"],
    envKey: "LINEAR_API_KEY",
    envPlaceholder: "lin_api_...",
    enabled: false
  },
  {
    id: "slack",
    name: "Slack & Discord Team Comms MCP",
    icon: "💬",
    desc: "Invio notifiche sui canali di team, report di build e avvisi di deployment.",
    category: "Team & Comms",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    envKey: "SLACK_BOT_TOKEN",
    envPlaceholder: "xoxb-...",
    enabled: false
  },
  {
    id: "docker",
    name: "Docker & Container Engine MCP",
    icon: "🐳",
    desc: "Ispezione container, docker-compose, log di servizio e build di immagini.",
    category: "DevOps & Cloud",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-docker"],
    envKey: "",
    envPlaceholder: "",
    enabled: false
  },
  {
    id: "figma",
    name: "Figma & Design Tokens MCP",
    icon: "🎨",
    desc: "Estrazione automatica di layout UI, stili CSS, colori e componenti Figma.",
    category: "Design & Frontend",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-figma"],
    envKey: "FIGMA_ACCESS_TOKEN",
    envPlaceholder: "figd_...",
    enabled: false
  },
  {
    id: "agentdb",
    name: "AgentDB Memoria Locale (JSON + embedding vettoriali reali)",
    icon: "🧠",
    desc: "Memoria persistente a 3 livelli (working/episodic/archival) salvata come JSON in .claude/agentdb.json. Ogni insight ha un embedding reale a 384 dimensioni (API di Ollama, nomic-embed-text, con fallback deterministico se il modello non è disponibile) e il recupero usato nei prompt è per similarità coseno reale rispetto alla richiesta corrente, non solo i più recenti.",
    category: "AI & Memory",
    command: "node",
    args: ["../ruflo-main/ruflo-main/bin/cli.js", "mcp"],
    envKey: "",
    envPlaceholder: "",
    // Disabilitato di default: il path sopra presuppone una cartella "ruflo-main" installata
    // in una posizione relativa allo workspace dell'utente che nella pratica quasi mai esiste.
    // Abilitarlo di default causava un export MCP rotto (comando non trovato) verso ~/.claude/mcp.json.
    enabled: false
  }
];

export function loadMcpConfig(workspace: string) {
  try {
    const configFile = join(workspace, ".claude", "mcp_config.json");
    if (existsSync(configFile)) {
      const data = JSON.parse(readFileSync(configFile, "utf-8"));
      return data.servers || DEFAULT_MCP_CATALOG;
    }
  } catch {}
  return DEFAULT_MCP_CATALOG;
}

export function saveMcpConfig(workspace: string, servers: any[]) {
  try {
    const claudeDir = join(workspace, ".claude");
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    const configFile = join(claudeDir, "mcp_config.json");
    writeFileSync(configFile, JSON.stringify({ mcpServers: servers, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}
