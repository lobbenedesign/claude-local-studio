/**
 * Project context analyzer + Continue.dev-style context mentions resolver
 * (@file, @git, @diff, @codebase).
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 6) — nessun cambio di
 * comportamento.
 */
import { join, basename, resolve } from "path";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { getProjectMemory } from "./memory";
import { getGitStatus } from "./git";
import { semanticCodebaseSearch } from "./codebase-index";


// Recursive file tree reader
function getDirectoryTree(dirPath: string, maxDepth = 3, currentDepth = 0): any[] {
  if (currentDepth > maxDepth || !existsSync(dirPath)) return [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const result: any[] = [];

    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === ".git" ||
        entry.name === ".snapshots"
      ) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);
      try {
        const isDir = entry.isDirectory();
        const stat = statSync(fullPath);

        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: isDir,
          size: isDir ? 0 : stat.size,
          children: isDir ? getDirectoryTree(fullPath, maxDepth, currentDepth + 1) : undefined
        });
      } catch {}
    }

    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// Project context analyzer
export function analyzeProjectContext(dirPath: string) {
  if (!existsSync(dirPath)) return { error: "Directory not found" };

  const tree = getDirectoryTree(dirPath, 2);
  let totalFiles = 0;
  let detectedFrameworks: string[] = [];
  let readmeSnippet = "";

  const checkFile = (name: string) => existsSync(join(dirPath, name));

  if (checkFile("package.json")) detectedFrameworks.push("Node.js / JavaScript");
  if (checkFile("requirements.txt") || checkFile("pyproject.toml")) detectedFrameworks.push("Python");
  if (checkFile("pubspec.yaml")) detectedFrameworks.push("Flutter / Dart");
  if (checkFile("Cargo.toml")) detectedFrameworks.push("Rust");
  if (checkFile("go.mod")) detectedFrameworks.push("Go");
  if (checkFile("tsconfig.json")) detectedFrameworks.push("TypeScript");

  const countFiles = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.isDirectory && n.children) countFiles(n.children);
      else totalFiles++;
    }
  };
  countFiles(tree);

  const readmeFiles = ["README.md", "readme.md", "README"];
  for (const rf of readmeFiles) {
    const p = join(dirPath, rf);
    if (existsSync(p)) {
      try {
        readmeSnippet = readFileSync(p, "utf-8").slice(0, 1500);
        break;
      } catch {}
    }
  }

  let rulesFileName = "";
  let rulesSnippet = "";
  const possibleRules = [".cursorrules", ".cursor/rules", "CLAUDE.md", "claude.md", "AGENTS.md", "GEMINI.md", ".windsurfrules"];
  for (const rf of possibleRules) {
    const p = join(dirPath, rf);
    if (existsSync(p)) {
      try {
        rulesFileName = rf;
        rulesSnippet = readFileSync(p, "utf-8");
        break;
      } catch {}
    }
  }

  // Load AgentDB / Ruflo Vector Memory
  const memories = getProjectMemory(dirPath);
  const memorySnippet = memories.slice(0, 5).map((m: any) => `• [${m.topic}]: ${m.insight}`).join("\n");

  return {
    folderName: basename(dirPath),
    fullPath: dirPath,
    totalFiles,
    frameworks: detectedFrameworks.length ? detectedFrameworks : ["Generic Project"],
    readmeSnippet,
    rulesFileName,
    rulesSnippet,
    hasRulesFile: !!rulesFileName,
    memoriesCount: memories.length,
    memorySnippet,
    memories,
    tree
  };
}

// ========================================================
// 🎯 CONTINUE.DEV-STYLE CONTEXT MENTIONS RESOLVER (@file, @git, @diff)
// ========================================================
export async function resolveContextMentions(prompt: string, workspace: string): Promise<{ cleanPrompt: string; injectedContext: string }> {
  let cleanPrompt = prompt;
  const injectedParts: string[] = [];

  // 1. Resolve @file:<path> or @file <path>
  const fileMatches = [...prompt.matchAll(/@file:?([a-zA-Z0-9_\-./]+)/g)];
  for (const m of fileMatches) {
    const filePath = m[1];
    const absPath = resolve(workspace, filePath);
    if (existsSync(absPath)) {
      try {
        const content = readFileSync(absPath, "utf-8").slice(0, 5000);
        injectedParts.push(`\n--- 📄 CONTENUTO ALLEGATO DA @file (${filePath}) ---\n${content}\n-----------------------------------------------\n`);
        cleanPrompt = cleanPrompt.replace(m[0], `[File: ${filePath}]`);
      } catch {}
    }
  }

  // 2. Resolve @git or @diff
  if (/@(git|diff)\b/i.test(prompt)) {
    const git = getGitStatus(workspace);
    if (git.isGit && git.diffSummary) {
      injectedParts.push(`\n--- 🌿 STATO E DIFF GIT ALLEGATI DA @git ---\nBranch: ${git.branch}\nModifiche:\n${git.diffSummary}\n------------------------------------------\n`);
      cleanPrompt = cleanPrompt.replace(/@(git|diff)\b/gi, "[Git Diff allegato]");
    }
  }

  // 3. Resolve @codebase(<query>) — real semantic search (embedding + cosine)
  // across the real files on disk, not just filename matching like @file.
  const codebaseMatches = [...prompt.matchAll(/@codebase\(([^)]+)\)/gi)];
  for (const m of codebaseMatches) {
    const query = m[1].trim();
    if (!query) continue;
    try {
      const results = await semanticCodebaseSearch(workspace, query, 5);
      if (results.length > 0) {
        const body = results.map(r => `📄 ${r.file}:${r.startLine} (similarità coseno reale: ${r.score.toFixed(3)})\n${r.text}`).join("\n\n");
        injectedParts.push(`\n--- 🔎 RICERCA SEMANTICA REALE @codebase("${query}") ---\n${body}\n------------------------------------------------------\n`);
      } else {
        injectedParts.push(`\n--- 🔎 @codebase("${query}"): nessun file indicizzabile trovato nel workspace ---\n`);
      }
      cleanPrompt = cleanPrompt.replace(m[0], `[Ricerca semantica codebase: "${query}"]`);
    } catch (e: any) {
      injectedParts.push(`\n--- 🔎 @codebase("${query}") fallita: ${e.message} ---\n`);
    }
  }

  return {
    cleanPrompt,
    injectedContext: injectedParts.join("\n")
  };
}
