// Loads the baked atlas pages (public/atlas, made by scripts/bake.mjs from the hand-made SVG drawings), the room plate
// and the two Cairo weights, then turns the fonts into bitmap fonts (one glyph page each: batched text, no per-label
// texture uploads).
import { Assets, BitmapFont, Texture } from "pixi.js";
import type { Spritesheet } from "pixi.js";

export interface CharMeta { cw: number; ch: number; anchorX: number; anchorY: number; unitPx: number }
interface Manifest { pages: string[]; meta: { char: CharMeta; fx: { cell: number } } }

export interface Loaded {
  char: CharMeta;
  room: Texture;
  tex: (name: string) => Texture;
  timings: Record<string, number>;
}

export const FONT_DISPLAY = "JamaaDisplay";
export const FONT_BODY = "JamaaBody";
const GLYPHS = [["a", "z"], ["A", "Z"], ["0", "9"], " .,:;!?+-–—_·'’\"()/%&×…#@"] as (string | string[])[];

export async function loadAll(base: string): Promise<Loaded> {
  const timings: Record<string, number> = {};
  let t = performance.now();
  const fontsP = Promise.all([
    new FontFace("Cairo", `url(${base}fonts/cairo-900-latin.woff2)`, { weight: "900" }).load(),
    new FontFace("Cairo", `url(${base}fonts/cairo-700-latin.woff2)`, { weight: "700" }).load(),
  ]).then((faces) => {
    for (const f of faces) document.fonts.add(f);
    timings.fonts = performance.now() - t;
  });
  const manifest = (await (await fetch(`${base}atlas/manifest.json`)).json()) as Manifest;
  const sheets = (await Promise.all(manifest.pages.map((p) => Assets.load<Spritesheet>(`${base}atlas/${p}`)))) as Spritesheet[];
  const room = await Assets.load<Texture>(`${base}atlas/room.webp`);
  timings.atlas = performance.now() - t;
  await fontsP;
  t = performance.now();
  BitmapFont.install({
    name: FONT_DISPLAY,
    style: { fontFamily: "Cairo", fontWeight: "900", fontSize: 88, fill: "#ffffff" },
    padding: 4,
    chars: GLYPHS,
    resolution: 1,
    textureStyle: { scaleMode: "linear" },
  });
  BitmapFont.install({
    name: FONT_BODY,
    style: { fontFamily: "Cairo", fontWeight: "700", fontSize: 44, fill: "#ffffff" },
    padding: 3,
    chars: GLYPHS,
    resolution: 1,
    textureStyle: { scaleMode: "linear" },
  });
  timings.bitmapFonts = performance.now() - t;

  const all = new Map<string, Texture>();
  for (const s of sheets) for (const [k, v] of Object.entries(s.textures)) all.set(k, v);
  const tex = (name: string): Texture => {
    const x = all.get(name);
    if (!x) throw new Error(`missing frame ${name}`);
    return x;
  };
  return { char: manifest.meta.char, room, tex, timings };
}
