/**
 * Repo Map — estrattore di simboli/firme via AST reale.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 6) — nessun cambio di
 * comportamento. Solo `buildAstRepoMap` è consumato da server.ts; il resto
 * (parser TypeScript Compiler API, tree-sitter multi-linguaggio, fallback
 * regex) è dettaglio implementativo interno al modulo.
 */
import { join, relative } from "path";
import { readFileSync, readdirSync } from "fs";
import * as ts from "typescript";
import TSParser from "web-tree-sitter";


// ========================================================
// 🗺️ REPO MAP (SYMBOL & SIGNATURE EXTRACTOR)
// ------------------------------------------------------
// Inspired by Aider's repo-map concept (github.com/Aider-AI/aider), which
// parses source files with tree-sitter to extract real function/class
// definitions instead of guessing from raw text.
//
// This implementation is HONEST about what it does per language:
//  - .ts/.tsx/.js/.jsx/.mjs/.cjs  -> parsed with the REAL TypeScript
//    Compiler API (`typescript` npm package, ts.createSourceFile +
//    AST traversal via ts.forEachChild). This is a genuine Abstract
//    Syntax Tree, not a text/regex scan: it correctly ignores strings,
//    comments, and symbol-shaped text inside template literals, and it
//    extracts real parameter/return type signatures from the parsed
//    nodes (FunctionDeclaration, ClassDeclaration + its members,
//    InterfaceDeclaration, TypeAliasDeclaration, exported const
//    arrow-functions, EnumDeclaration).
//  - every other language (Python, Rust, Dart, Go, Java, C/C++, ...)
//    -> there is no bundled parser for these here, so it falls back to
//    a line-based regex scan. Each such file is explicitly tagged
//    "[regex]" in the output so callers/LLMs know it is a heuristic,
//    not a verified AST, extraction.
// ========================================================

const AST_PARSEABLE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

function scriptKindForExt(ext: string): ts.ScriptKind {
  switch (ext) {
    case "tsx": return ts.ScriptKind.TSX;
    case "jsx": return ts.ScriptKind.JSX;
    case "js": case "mjs": case "cjs": return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

// Real AST extraction using the TypeScript Compiler API.
function extractSymbolsViaTypeScriptAst(filePath: string, content: string, ext: string): string[] {
  const symbols: string[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindForExt(ext)
  );

  const signatureOf = (node: ts.Node): string => {
    // Grab the node's own text up to the body/brace, trimmed to one line.
    const full = node.getText(sourceFile);
    const braceIdx = full.indexOf("{");
    const arrowBodyIdx = full.indexOf("=>");
    let cut = full.length;
    if (braceIdx > -1) cut = Math.min(cut, braceIdx);
    if (arrowBodyIdx > -1 && arrowBodyIdx < cut) cut = arrowBodyIdx + 2;
    return full.slice(0, cut).replace(/\s+/g, " ").trim().slice(0, 140);
  };

  const isExported = (node: ts.Node): boolean => {
    const mods = (ts as any).canHaveModifiers?.(node) ? ts.getModifiers(node as any) : undefined;
    return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  };

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push(signatureOf(node).replace(/^(export\s+)?(default\s+)?/, isExported(node) ? "export " : ""));
    } else if (ts.isClassDeclaration(node) && node.name) {
      const heritage = node.heritageClauses?.map(h => h.getText(sourceFile)).join(" ") || "";
      symbols.push(`${isExported(node) ? "export " : ""}class ${node.name.text}${heritage ? " " + heritage : ""}`);
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
          symbols.push(`  .${signatureOf(member)}`);
        } else if (ts.isPropertyDeclaration(member) && member.name) {
          symbols.push(`  .${signatureOf(member)}`);
        }
      }
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push(`${isExported(node) ? "export " : ""}interface ${node.name.text}`);
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push(`${isExported(node) ? "export " : ""}type ${node.name.text} = ${node.type.getText(sourceFile).slice(0, 60)}`);
    } else if (ts.isEnumDeclaration(node)) {
      symbols.push(`${isExported(node) ? "export " : ""}enum ${node.name.text}`);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) && ts.isIdentifier(decl.name)) {
          symbols.push(`${isExported(node) ? "export " : ""}const ${decl.name.text} = ${signatureOf(decl.initializer)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Surface real parser diagnostics so a syntactically broken file is
  // reported honestly rather than silently returning an empty map.
  const syntacticErrors = (sourceFile as any).parseDiagnostics as ts.Diagnostic[] | undefined;
  if (syntacticErrors && syntacticErrors.length > 0 && symbols.length === 0) {
    symbols.push(`[ast-parse-error] ${syntacticErrors.length} syntax error(s) detected by TS parser`);
  }

  return symbols;
}

// Real multi-language AST via tree-sitter (Aider/Continue style, reale non regex).
// Grammatiche WASM precompilate (tree-sitter-wasms) caricate una volta all'avvio.
// Se il caricamento fallisce per un linguaggio (es. build incompatibile, come
// osservato per Dart/ABI 15 con questo runtime), quel linguaggio ricade
// onestamente sul regex fallback esistente invece di rompersi silenziosamente.
interface TreeSitterLangConfig {
  wasmFile: string;
  containerTypes: Set<string>;
  functionTypes: Set<string>;
  nodeFilter?: (node: any) => boolean;
}

const TREE_SITTER_LANG_CONFIG: Record<string, TreeSitterLangConfig> = {
  py: { wasmFile: "tree-sitter-python.wasm", containerTypes: new Set(["class_definition"]), functionTypes: new Set(["function_definition"]) },
  rs: { wasmFile: "tree-sitter-rust.wasm", containerTypes: new Set(["struct_item", "enum_item", "trait_item", "impl_item"]), functionTypes: new Set(["function_item", "function_signature_item"]) },
  go: { wasmFile: "tree-sitter-go.wasm", containerTypes: new Set(), functionTypes: new Set(["type_declaration", "function_declaration", "method_declaration"]) },
  java: { wasmFile: "tree-sitter-java.wasm", containerTypes: new Set(["class_declaration", "interface_declaration", "enum_declaration"]), functionTypes: new Set(["method_declaration", "constructor_declaration"]) },
  c: { wasmFile: "tree-sitter-c.wasm", containerTypes: new Set(["struct_specifier"]), functionTypes: new Set(["function_definition"]) },
  cpp: { wasmFile: "tree-sitter-cpp.wasm", containerTypes: new Set(["class_specifier", "struct_specifier"]), functionTypes: new Set(["function_definition", "field_declaration"]), nodeFilter: (n) => n.type !== "field_declaration" || (n.text as string).includes("(") },
};

const EXT_TO_TREE_SITTER_LANG: Record<string, string> = {
  py: "py", rs: "rs", go: "go", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp"
};

const TREE_SITTER_LANG_CACHE: Record<string, any> = {};

async function initTreeSitterLanguages() {
  try {
    await TSParser.init();
    for (const [key, cfg] of Object.entries(TREE_SITTER_LANG_CONFIG)) {
      try {
        // import.meta.dir qui è src/workspace/, non la root del progetto —
        // node_modules vive due livelli sopra.
        const wasmPath = join(import.meta.dir, "..", "..", "node_modules", "tree-sitter-wasms", "out", cfg.wasmFile);
        TREE_SITTER_LANG_CACHE[key] = await TSParser.Language.load(wasmPath);
      } catch (e: any) {
        console.error(`[tree-sitter] grammatica reale per '${key}' non caricata, questo linguaggio userà il fallback regex: ${e.message}`);
      }
    }
    console.log(`🌳 Tree-sitter AST reale attivo per: ${Object.keys(TREE_SITTER_LANG_CACHE).join(", ") || "nessuno (fallback regex per tutti)"}`);
  } catch (e: any) {
    console.error(`[tree-sitter] init del runtime WASM fallito, repo map multi-linguaggio userà solo il fallback regex: ${e.message}`);
  }
}
await initTreeSitterLanguages();

// Real AST extraction via tree-sitter per Python/Rust/Go/Java/C/C++.
// Ritorna null se la grammatica non è disponibile (il chiamante ricade sul regex fallback).
function extractSymbolsViaTreeSitter(langKey: string, content: string): string[] | null {
  const lang = TREE_SITTER_LANG_CACHE[langKey];
  const cfg = TREE_SITTER_LANG_CONFIG[langKey];
  if (!lang || !cfg) return null;

  const parser = new TSParser();
  parser.setLanguage(lang);
  const tree = parser.parse(content);
  if (!tree) { parser.delete(); return null; }

  const signatureOf = (node: any): string => {
    const full = node.text as string;
    const braceIdx = full.indexOf("{");
    const colonIdx = full.indexOf(":");
    let cut = full.length;
    if (braceIdx > -1) cut = Math.min(cut, braceIdx);
    if (langKey === "py" && colonIdx > -1 && colonIdx < cut) cut = colonIdx + 1;
    return full.slice(0, cut).replace(/\s+/g, " ").trim().slice(0, 140);
  };

  const symbols: string[] = [];
  const visit = (node: any, containerDepth: number) => {
    if (symbols.length >= 25) return;
    const isContainer = cfg.containerTypes.has(node.type);
    const isFunction = cfg.functionTypes.has(node.type);
    if ((isContainer || isFunction) && (!cfg.nodeFilter || cfg.nodeFilter(node))) {
      const sig = signatureOf(node);
      if (sig) symbols.push(containerDepth > 0 && isFunction ? `  .${sig}` : sig);
    }
    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i), containerDepth + (isContainer ? 1 : 0));
    }
  };
  visit(tree.rootNode, 0);
  parser.delete();
  return symbols;
}

// Fallback line-based heuristic for languages without a bundled AST parser.
const REGEX_FALLBACK_PATTERNS = [
  /^(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/,
  /^(?:pub\s+)?(?:struct|enum|trait|impl)\s+([a-zA-Z0-9_<>]+)/,
  /^(?:def|class)\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]*)\))?:/,
  /^func\s+(?:\([^)]*\)\s*)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/,
  /^(?:public|private|protected|static)?\s*(?:class|interface)\s+([a-zA-Z0-9_]+)/,
  /^(?:abstract\s+)?class\s+([a-zA-Z0-9_]+)/,
  /^(?:Future<[^>]*>|void|int|double|String|bool|dynamic|var)?\s*([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:async\s*)?\{/ // dart-ish
];

function extractSymbolsViaRegexFallback(content: string): string[] {
  const symbols: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) continue;
    for (const rgx of REGEX_FALLBACK_PATTERNS) {
      const match = trimmed.match(rgx);
      if (match) {
        symbols.push(`[regex] ${trimmed.slice(0, 100)}`);
        break;
      }
    }
    if (symbols.length >= 12) break;
  }
  return symbols;
}

export function buildAstRepoMap(workspace: string, maxFiles = 40): { mapString: string; totalSymbols: number; astParsedFiles: number; treeSitterParsedFiles: number; regexFallbackFiles: number } {
  const mapLines: string[] = [];
  let totalSymbols = 0;
  let astParsedFiles = 0;
  let treeSitterParsedFiles = 0;
  let regexFallbackFiles = 0;

  const scanFileSymbols = (filePath: string, ext: string) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      let fileSymbols: string[];
      let tag: string;

      const treeSitterLangKey = EXT_TO_TREE_SITTER_LANG[ext];
      const treeSitterSymbols = treeSitterLangKey ? extractSymbolsViaTreeSitter(treeSitterLangKey, content) : null;

      if (AST_PARSEABLE_EXTENSIONS.has(ext)) {
        fileSymbols = extractSymbolsViaTypeScriptAst(filePath, content, ext).slice(0, 25);
        tag = "🌳 AST";
        astParsedFiles++;
      } else if (treeSitterSymbols !== null) {
        // Grammatica reale caricata: usiamo il risultato anche se vuoto (file senza
        // dichiarazioni riconoscibili), non ricadiamo sul regex solo perché è 0.
        fileSymbols = treeSitterSymbols;
        tag = "🌳 tree-sitter AST";
        treeSitterParsedFiles++;
      } else {
        fileSymbols = extractSymbolsViaRegexFallback(content);
        tag = "🔤 regex-fallback";
        regexFallbackFiles++;
      }

      if (fileSymbols.length > 0) {
        const rel = relative(workspace, filePath);
        mapLines.push(`📄 ${rel}  [${tag}]:\n  ` + fileSymbols.map(s => `• ${s}`).join("\n  "));
        totalSymbols += fileSymbols.length;
      }
    } catch {}
  };

  let filesScanned = 0;
  const walk = (dir: string, depth = 0) => {
    if (depth > 4 || filesScanned >= maxFiles) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (filesScanned >= maxFiles) return;
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (entry.isFile()) {
          const ext = entry.name.split(".").pop()?.toLowerCase() || "";
          if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "dart", "go", "java", "cpp", "cc", "cxx", "hpp", "c", "h"].includes(ext)) {
            scanFileSymbols(full, ext);
            filesScanned++;
          }
        }
      }
    } catch {}
  };

  walk(workspace);
  return {
    mapString: mapLines.join("\n\n"),
    totalSymbols,
    astParsedFiles,
    treeSitterParsedFiles,
    regexFallbackFiles
  };
}
