// Mish Ana! content rules: the word-pack lint of SPEC §12.5 lives in ../lint.ts (it predates the per-game layout and
// still runs on its own entries, with per-issue schema messages); nothing extra runs here.
import type { GameLint } from "./types";

export const lint: GameLint = () => ({ errors: [], warnings: [] });
