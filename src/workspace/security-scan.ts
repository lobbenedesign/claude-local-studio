/**
 * Security Secret Scanner (Ruflo Guardrails)
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 5) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 */
import { join, relative } from "path";
import { readFileSync, readdirSync } from "fs";

export function scanSecuritySecrets(workspace: string) {
  const secretPatterns = [
    { name: "Anthropic / OpenAI API Key", regex: /sk-[a-zA-Z0-9_\-]{20,}/g },
    { name: "GitHub Personal Access Token", regex: /ghp_[a-zA-Z0-9]{30,}/g },
    { name: "Slack Bot Token", regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{20,}/g },
    { name: "Private RSA / SSH Key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
    { name: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/g }
  ];

  const findings: Array<{ file: string; line: number; type: string; snippet: string }> = [];

  const scanFile = (filePath: string) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        for (const pat of secretPatterns) {
          if (pat.regex.test(line)) {
            findings.push({
              file: relative(workspace, filePath),
              line: idx + 1,
              type: pat.name,
              snippet: line.trim().slice(0, 80)
            });
          }
        }
      });
    } catch {}
  };

  const walkScan = (dir: string, depth = 0) => {
    if (depth > 4) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".git") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkScan(full, depth + 1);
        else if (entry.isFile() && (entry.name.endsWith(".env") || entry.name.endsWith(".json") || entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".py") || entry.name.endsWith(".rs"))) {
          scanFile(full);
        }
      }
    } catch {}
  };

  walkScan(workspace);
  return {
    scannedAt: new Date().toISOString(),
    totalFindings: findings.length,
    findings,
    isSafe: findings.length === 0
  };
}
