/**
 * 🎙️ REAL WHISPER VOICE TRANSCRIPTION (whisper.cpp, locale, non browser)
 * ------------------------------------------------------
 * Il README dichiarava onestamente che la dettatura vocale usa solo la
 * SpeechRecognition del browser e che "nessun modello Whisper è integrato".
 * Questo aggiunge una trascrizione Whisper REALE e locale via whisper.cpp
 * (binario 'whisper-cli' installato con `brew install whisper-cpp`) + un
 * modello GGML reale scaricato a parte (non incluso nel repo per dimensione,
 * vedi README). Se il binario o il modello non sono presenti, l'endpoint
 * dichiara onestamente l'errore invece di ricadere silenziosamente sul
 * motore del browser o fingere un risultato.
 *
 * Estratto da server.ts (ROADMAP.md, Fase 1, step 1) — nessun cambio di
 * comportamento, solo spostamento di codice isolato in un proprio modulo.
 */
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { homedir, tmpdir } from "os";
import { spawn } from "bun";
import { WHISPER_MODELS_DIR } from "../config/paths";

let whisperCliPathCache: string | null | undefined = undefined;
export function findWhisperCliPath(): string | null {
  if (whisperCliPathCache !== undefined) return whisperCliPathCache;
  const candidates = ["/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli", "/usr/bin/whisper-cli"];
  for (const c of candidates) {
    if (existsSync(c)) { whisperCliPathCache = c; return c; }
  }
  try {
    const proc = Bun.spawnSync(["which", "whisper-cli"]);
    const out = new TextDecoder().decode(proc.stdout).trim();
    if (out && existsSync(out)) { whisperCliPathCache = out; return out; }
  } catch {}
  whisperCliPathCache = null;
  return null;
}

let whisperModelPathCache: string | null | undefined = undefined;
export function findWhisperModelPath(): string | null {
  if (whisperModelPathCache !== undefined) return whisperModelPathCache;
  const candidates = [
    process.env.WHISPER_MODEL_PATH,
    join(WHISPER_MODELS_DIR, "ggml-base.bin"),
    join(homedir(), ".cache", "whisper.cpp", "ggml-base.bin")
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(c)) { whisperModelPathCache = c; return c; }
  }
  whisperModelPathCache = null;
  return null;
}

let ffmpegPathCache: string | null | undefined = undefined;
export function findFfmpegPath(): string | null {
  if (ffmpegPathCache !== undefined) return ffmpegPathCache;
  try {
    const proc = Bun.spawnSync(["which", "ffmpeg"]);
    const out = new TextDecoder().decode(proc.stdout).trim();
    ffmpegPathCache = out && existsSync(out) ? out : null;
  } catch { ffmpegPathCache = null; }
  return ffmpegPathCache;
}

export async function transcribeAudioWithWhisper(audioBytes: Uint8Array, sourceExt: string, language: string): Promise<{ text: string }> {
  const whisperCli = findWhisperCliPath();
  const modelPath = findWhisperModelPath();
  const ffmpegPath = findFfmpegPath();
  if (!whisperCli) throw new Error("whisper-cli non trovato. Installa con: brew install whisper-cpp");
  if (!modelPath) throw new Error(`Modello Whisper (ggml-base.bin) non trovato. Scaricalo con: curl -L -o "${join(WHISPER_MODELS_DIR, "ggml-base.bin")}" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin`);
  if (!ffmpegPath) throw new Error("ffmpeg non trovato (richiesto per convertire l'audio del browser in WAV 16kHz mono). Installa con: brew install ffmpeg");

  const tmpId = crypto.randomUUID();
  const rawPath = join(tmpdir(), `whisper-in-${tmpId}.${sourceExt}`);
  const wavPath = join(tmpdir(), `whisper-in-${tmpId}.wav`);
  const jsonOutPrefix = join(tmpdir(), `whisper-out-${tmpId}`);

  try {
    writeFileSync(rawPath, audioBytes);

    const ffmpegProc = spawn({
      cmd: [ffmpegPath, "-y", "-i", rawPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath],
      stdout: "pipe",
      stderr: "pipe"
    });
    const ffmpegExit = await ffmpegProc.exited;
    if (ffmpegExit !== 0 || !existsSync(wavPath)) {
      const err = await new Response(ffmpegProc.stderr).text();
      throw new Error(`Conversione audio ffmpeg fallita: ${err.slice(0, 300)}`);
    }

    const whisperArgs = [whisperCli, "-m", modelPath, "-f", wavPath, "-np", "-oj", "-of", jsonOutPrefix];
    if (language && language !== "auto") whisperArgs.push("-l", language);
    const whisperProc = spawn({ cmd: whisperArgs, stdout: "pipe", stderr: "pipe" });
    const whisperExit = await whisperProc.exited;
    const jsonPath = `${jsonOutPrefix}.json`;
    if (whisperExit !== 0 || !existsSync(jsonPath)) {
      const err = await new Response(whisperProc.stderr).text();
      throw new Error(`Trascrizione whisper.cpp fallita: ${err.slice(0, 300)}`);
    }

    const result = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const text = (result.transcription || []).map((seg: any) => seg.text || "").join(" ").trim();
    return { text };
  } finally {
    for (const p of [rawPath, wavPath, `${jsonOutPrefix}.json`]) {
      try { if (existsSync(p)) unlinkSync(p); } catch {}
    }
  }
}
