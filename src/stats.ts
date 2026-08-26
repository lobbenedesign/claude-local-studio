/**
 * Shared token-usage counter.
 * ------------------------------------------------------
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 7) — necessario perché
 * `totalTokensProcessed` era una `let` di modulo mutata da molti punti
 * diversi (proxy provider, transform stream, agent loop); un binding `let`
 * esportato da un modulo ES è di sola lettura per chi lo importa, quindi
 * serve un piccolo incapsulamento con funzioni invece che esportare la
 * variabile stessa.
 */
let totalTokensProcessed = 210000;

export function addTokensProcessed(n: number): void {
  totalTokensProcessed += n;
}

export function getTokensProcessed(): number {
  return totalTokensProcessed;
}
