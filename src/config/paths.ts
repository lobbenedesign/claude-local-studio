/**
 * Risoluzione centralizzata della root del progetto e delle cartelle
 * dati/asset, valida sia in modalità sviluppo (`bun server.ts`) sia in un
 * eseguibile compilato con `bun build --compile` (Fase 4, packaging).
 * ------------------------------------------------------
 * In un binario compilato, `import.meta.dir` risolve a un path virtuale
 * dentro `/$bunfs/...` — i file reali (public/, .config/, whisper-models/)
 * non ci vivono dentro e vanno cercati accanto all'eseguibile reale
 * (`process.execPath`), oppure nella cartella indicata da
 * `STUDIO_RESOURCES_DIR` se l'app li tiene altrove (es. il bundle .app
 * macOS, dove le risorse stanno in Contents/Resources mentre
 * l'eseguibile sta in Contents/MacOS).
 */
import { dirname, join } from "path";

export const IS_COMPILED = import.meta.dir.includes("$bunfs");

export const PROJECT_ROOT = IS_COMPILED
  ? process.env.STUDIO_RESOURCES_DIR || dirname(process.execPath)
  : join(import.meta.dir, "..", "..");

export const PUBLIC_DIR = join(PROJECT_ROOT, "public");
export const CONFIG_DIR = join(PROJECT_ROOT, ".config");
export const WHISPER_MODELS_DIR = join(PROJECT_ROOT, "whisper-models");
