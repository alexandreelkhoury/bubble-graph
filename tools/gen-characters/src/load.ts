// Reads lane A's shared modules into the generator model (model.ts). This file is the only place that knows their
// export names; everything else reads the model.
//
// SPEC-GAP: JAMAA-PLATFORM §3.7 / §3.8 / §3.4 name the files (characters/{geometry,expressions,reactions}.ts,
// motion/choreo.ts, worlds/palettes.ts) and their contents but not their export names. Lane A had not written them
// when this generator was built, so it expects the names below; if lane A picks others, only this file changes:
//   shared/src/characters/index.ts  CHARACTER_VIEWBOX (24), FACE_SPACE ({ w: 12, h: 9 }),
//                                   BODY_PATHS: Record<shape, string>, FACE_BOXES: Record<shape, {x,y,w,h}>,
//                                   EXPRESSIONS: readonly Expression[],
//                                   EXPRESSION_FEATURES: Record<Expression, readonly {part, d, style, strokeWidth?, alpha?}[]>,
//                                   REACTION_EXPRESSION / REACTION_BURST: Record<ReactionKind, string>
//   shared/src/worlds/index.ts      WORLD_PALETTES: Record<WorldId, Record<token, string | null | { web, native }>>
//   shared/src/motion/index.ts      EASINGS: Record<id, {kind:"cubic",x1,y1,x2,y2} | {kind:"spring",dampingRatio,stiffness,mass}>,
//                                   CHOREO: Record<momentId, readonly Step[]>, sample(step, tMs, index?) → number
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { WORLD_TOKENS, type CharacterModel, type ChoreoModel, type EasingDef, type FaceBox, type Feature, type GenModel, type StepDef, type WorldModel, type WorldToken } from "./model";

export const SOURCES = {
  characters: "shared/src/characters/index.ts",
  worlds: "shared/src/worlds/index.ts",
  motion: "shared/src/motion/index.ts",
} as const;

type Mod = Record<string, unknown>;

export class SourceError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;

function need<T>(mod: Mod, src: string, name: string, check: (v: unknown) => v is T, what: string): T {
  const v = mod[name];
  if (!check(v)) throw new SourceError(`${src}: export ${name} must be ${what}`);
  return v;
}

function num(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new SourceError(`${where} must be a finite number`);
  return v;
}

export function charactersFrom(mod: Mod, shapes: readonly string[], reactions: readonly string[]): CharacterModel {
  const src = SOURCES.characters;
  const viewBox = num(mod.CHARACTER_VIEWBOX, `${src}: CHARACTER_VIEWBOX`);
  const fs = need(mod, src, "FACE_SPACE", isRecord, "{ w, h }");
  const bodies = need(mod, src, "BODY_PATHS", isRecord, "a shape → path record");
  const boxes = need(mod, src, "FACE_BOXES", isRecord, "a shape → face box record");
  const exprs = need(mod, src, "EXPRESSIONS", (v): v is unknown[] => Array.isArray(v), "an array of expression ids");
  const feats = need(mod, src, "EXPRESSION_FEATURES", isRecord, "an expression → features record");
  const rExpr = need(mod, src, "REACTION_EXPRESSION", isRecord, "a reaction → expression record");
  const rBurst = need(mod, src, "REACTION_BURST", isRecord, "a reaction → burst record");
  const outShapes = shapes.map((shape) => {
    const body = bodies[shape];
    const b = boxes[shape];
    if (typeof body !== "string" || body.length === 0) throw new SourceError(`${src}: BODY_PATHS.${shape} is missing`);
    if (!isRecord(b)) throw new SourceError(`${src}: FACE_BOXES.${shape} is missing`);
    const faceBox: FaceBox = { x: num(b.x, `FACE_BOXES.${shape}.x`), y: num(b.y, `FACE_BOXES.${shape}.y`), w: num(b.w, `FACE_BOXES.${shape}.w`), h: num(b.h, `FACE_BOXES.${shape}.h`) };
    return { shape, body, faceBox };
  });
  const expressions = exprs.map((id) => {
    if (typeof id !== "string") throw new SourceError(`${src}: EXPRESSIONS must hold strings`);
    const list = feats[id];
    if (!Array.isArray(list)) throw new SourceError(`${src}: EXPRESSION_FEATURES.${id} is missing`);
    const features: Feature[] = list.map((f, i) => {
      const where = `${src}: EXPRESSION_FEATURES.${id}[${i}]`;
      if (!isRecord(f) || typeof f.part !== "string" || typeof f.d !== "string" || (f.style !== "fill" && f.style !== "stroke")) throw new SourceError(`${where} must be { part, d, style: "fill" | "stroke" }`);
      return {
        part: f.part, d: f.d, style: f.style,
        ...(f.strokeWidth !== undefined ? { strokeWidth: num(f.strokeWidth, `${where}.strokeWidth`) } : {}),
        ...(f.alpha !== undefined ? { alpha: num(f.alpha, `${where}.alpha`) } : {}),
      };
    });
    return { id, features };
  });
  const outReactions = reactions.map((reaction) => {
    const expression = rExpr[reaction], burst = rBurst[reaction];
    if (typeof expression !== "string" || !expressions.some((e) => e.id === expression)) throw new SourceError(`${src}: REACTION_EXPRESSION.${reaction} must be an expression`);
    if (typeof burst !== "string") throw new SourceError(`${src}: REACTION_BURST.${reaction} is missing`);
    return { reaction, expression, burst };
  });
  return { viewBox, faceSpace: { w: num(fs.w, "FACE_SPACE.w"), h: num(fs.h, "FACE_SPACE.h") }, shapes: outShapes, expressions, reactions: outReactions };
}

export function worldsFrom(mod: Mod, worldIds: readonly string[]): WorldModel[] {
  const src = SOURCES.worlds;
  const pal = need(mod, src, "WORLD_PALETTES", isRecord, "a world id → palette record");
  return worldIds.map((id) => {
    const p = pal[id];
    if (!isRecord(p)) throw new SourceError(`${src}: WORLD_PALETTES["${id}"] is missing`);
    const web = {} as Record<WorldToken, string | null>, native = {} as Record<WorldToken, string | null>;
    for (const t of WORLD_TOKENS) {
      const v = p[t];
      const pick = (x: unknown, side: string): string | null => {
        if (x === null || x === undefined) {
          if (t === "signal") return null;
          throw new SourceError(`${src}: WORLD_PALETTES["${id}"].${t}${side} is required`);
        }
        if (typeof x !== "string" || !HEX.test(x)) throw new SourceError(`${src}: WORLD_PALETTES["${id}"].${t}${side} must be #RRGGBB`);
        return x.toUpperCase();
      };
      if (isRecord(v)) {
        web[t] = pick(v.web, ".web");
        native[t] = pick(v.native, ".native");
      } else web[t] = native[t] = pick(v, "");
    }
    return { id, web, native };
  });
}

export function choreoFrom(mod: Mod): ChoreoModel {
  const src = SOURCES.motion;
  const easingsRaw = need(mod, src, "EASINGS", isRecord, "an easing id → definition record");
  const choreoRaw = need(mod, src, "CHOREO", isRecord, "a moment id → step list record");
  const easings: Record<string, EasingDef> = {};
  for (const [id, e] of Object.entries(easingsRaw)) {
    const where = `${src}: EASINGS["${id}"]`;
    if (!isRecord(e)) throw new SourceError(`${where} must be an object`);
    if (e.kind === "cubic") easings[id] = { kind: "cubic", x1: num(e.x1, `${where}.x1`), y1: num(e.y1, `${where}.y1`), x2: num(e.x2, `${where}.x2`), y2: num(e.y2, `${where}.y2`) };
    else if (e.kind === "spring") easings[id] = { kind: "spring", dampingRatio: num(e.dampingRatio, `${where}.dampingRatio`), stiffness: num(e.stiffness, `${where}.stiffness`), mass: num(e.mass, `${where}.mass`) };
    else throw new SourceError(`${where}.kind must be "cubic" or "spring"`);
  }
  const moments: Record<string, StepDef[]> = {};
  for (const [id, steps] of Object.entries(choreoRaw)) {
    if (!Array.isArray(steps)) throw new SourceError(`${src}: CHOREO["${id}"] must be a step list`);
    moments[id] = steps.map((s, i) => {
      const where = `${src}: CHOREO["${id}"][${i}]`;
      if (!isRecord(s) || typeof s.id !== "string" || typeof s.easing !== "string") throw new SourceError(`${where} must be a step`);
      if (!(s.easing in easings)) throw new SourceError(`${where}: unknown easing ${s.easing}`);
      if (s.reduced !== "fade" && s.reduced !== "skip" && s.reduced !== "keep") throw new SourceError(`${where}.reduced must be fade | skip | keep`);
      if (s.lite !== "keep" && s.lite !== "drop") throw new SourceError(`${where}.lite must be keep | drop`);
      return {
        id: s.id, startMs: num(s.startMs, `${where}.startMs`), durationMs: num(s.durationMs, `${where}.durationMs`), easing: s.easing,
        ...(s.staggerMs !== undefined ? { staggerMs: num(s.staggerMs, `${where}.staggerMs`) } : {}), reduced: s.reduced, lite: s.lite,
      };
    });
  }
  return { easings, moments };
}

async function importIfPresent(root: string, rel: string): Promise<Mod | null> {
  const file = join(root, rel);
  if (!existsSync(file)) return null;
  return (await import(pathToFileURL(file).href)) as Mod;
}

export interface Loaded { model: GenModel | null; missing: string[]; motion: Mod | null }

/** Loads every source; `missing` lists the modules lane A has not written yet (then `model` is null). */
export async function loadModel(root: string): Promise<Loaded> {
  const constants = (await import(pathToFileURL(join(root, "shared/src/constants.ts")).href)) as { COLORS: readonly { shape: string }[] };
  const room = (await import(pathToFileURL(join(root, "shared/src/room/types.ts")).href)) as { REACTIONS: readonly string[] };
  const worldIds = (await import(pathToFileURL(join(root, "shared/src/worlds/ids.ts")).href)) as { WORLD_IDS: readonly string[] };
  const [characters, worlds, motion] = await Promise.all([importIfPresent(root, SOURCES.characters), importIfPresent(root, SOURCES.worlds), importIfPresent(root, SOURCES.motion)]);
  const missing: string[] = [];
  if (!characters) missing.push(SOURCES.characters);
  if (!worlds || !("WORLD_PALETTES" in worlds)) missing.push(`${SOURCES.worlds} (WORLD_PALETTES from worlds/palettes.ts)`);
  if (!motion) missing.push(SOURCES.motion);
  if (!characters || !worlds || !("WORLD_PALETTES" in worlds) || !motion) return { model: null, missing, motion };
  return {
    model: {
      characters: charactersFrom(characters, constants.COLORS.map((c) => c.shape), room.REACTIONS),
      worlds: worldsFrom(worlds, worldIds.WORLD_IDS),
      choreo: choreoFrom(motion),
    },
    missing,
    motion,
  };
}
