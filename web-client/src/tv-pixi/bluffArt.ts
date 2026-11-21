// Bluff's drawings on the Pixi TV: the Liars' Café wall (the DOM's <Cafe> SVG, rasterised once at 2×), the corkboard,
// one lamp cone, and an atlas of the small props (games/bluff/art.tsx: pencil, envelope, ballot, moustache, the house,
// lifebuoy, heart; the crown, a few icons, the reaction bursts and one coin per player colour). Few textures, all cached
// for the session: a sprite asks for its key and gets the real frame as soon as the SVGs have decoded.
import { Rectangle, Sprite, Texture } from "pixi.js";
import { BODY_PATHS } from "@jamaa/shared/characters";
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";

const INK = "#120A1F";
const CREAM = "#FFF7EC";

// ---------------------------------------------------------------- the café (decorative, the DOM's Cafe minus what moves)

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const LAMPS = [180, 480, 780] as const;
export const LAMP_X = LAMPS;
/** The window's lit squares (they blink in the DOM): drawn by the scene so they can blink here too. */
export const WINDOW_LIGHTS: readonly (readonly [number, number])[] = [[22, 112], [40, 104], [72, 108], [96, 122], [58, 128]];
export const WINDOW_AT = { x: 40, y: 96 } as const;

function cafeSvg(): string {
  const stripes = range(24).map((i) => `<rect x="${i * 40 + 18}" y="0" width="2" height="360" fill="#3A2614" opacity=".35"/>`).join("");
  const cups = [8, 34, 60, 86].map((x, i) => `<g transform="translate(${x} ${i % 2 ? 20 : 16})"><rect width="18" height="${i % 2 ? 20 : 24}" rx="3" fill="${["#E9A23B", "#F2E6D0", "#C8362F", "#2F7A6A"][i]}"/></g>`).join("");
  const lamps = LAMPS.map((x) => `<path d="M${x} 0V40" stroke="${INK}" stroke-width="2"/><path d="M${x - 26} 62Q${x} 30 ${x + 26} 62z" fill="#B07A2A"/><ellipse cx="${x}" cy="62" rx="26" ry="5" fill="#FFE3A3"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="1920" height="1080" preserveAspectRatio="none">
<defs>
<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E1D0E"/><stop offset=".62" stop-color="#1C1209"/><stop offset="1" stop-color="#140C06"/></linearGradient>
<linearGradient id="wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2E14"/><stop offset="1" stop-color="#2A190B"/></linearGradient>
<pattern id="t" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#22150A"/><path d="M16 2l14 14-14 14L2 16z" fill="#2B1B0D"/><circle cx="16" cy="16" r="3" fill="#3A2512"/></pattern>
</defs>
<rect width="960" height="540" fill="url(#w)"/>${stripes}
<g transform="translate(40 96)"><path d="M0 150V60A60 60 0 0 1 120 60V150z" fill="#0B1424" stroke="#5B3A1E" stroke-width="6"/>
<path d="M6 150V118h14v-20h12v26h16v-40h10v40h14V96h18v32h12v-18h12v40z" fill="#16233A"/>
<path d="M60 0V150M0 84H120" stroke="#5B3A1E" stroke-width="4"/><circle cx="92" cy="40" r="9" fill="#FFF1C9" opacity=".8"/></g>
<g transform="translate(818 150)"><rect x="0" y="40" width="112" height="8" rx="2" fill="#5B3A1E"/>${cups}
<rect x="0" y="100" width="112" height="8" rx="2" fill="#5B3A1E"/><path d="M20 100v-22h18v22M58 100V70h10v30M80 100V82h16v18" fill="#3A2512"/></g>
<rect x="0" y="360" width="960" height="40" fill="url(#wd)"/><rect x="0" y="360" width="960" height="4" fill="#6B4420"/>
<rect x="0" y="400" width="960" height="140" fill="url(#t)"/><rect x="0" y="400" width="960" height="140" fill="#000" opacity=".25"/>${lamps}</svg>`;
}

function boardSvg(): string {
  const dots = range(40).map((i) => `<circle cx="${14 + ((i * 137) % 540)}" cy="${14 + ((i * 71) % 240)}" r="1.6" fill="#4A321A" opacity=".6"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 576 276" width="1152" height="552"><defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5530"/><stop offset="1" stop-color="#5E3F22"/></linearGradient></defs>
<rect x="0" y="0" width="568" height="268" rx="10" fill="url(#c)" stroke="#3A2512" stroke-width="8"/>${dots}</svg>`;
}

/** One warm cone (lamp at the top centre of a 340 × 356 box). */
function coneSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 356" width="340" height="356"><defs><radialGradient id="l" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#FFE3A3" stop-opacity=".34"/><stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/></radialGradient></defs>
<path d="M146 0L0 356H340L194 0z" fill="url(#l)"/></svg>`;
}

/** A soft round glow (cream-gold, transparent edge): spotlights, the trophy pool. */
function glowSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFE3A3" stop-opacity="1"/><stop offset=".55" stop-color="#FFE3A3" stop-opacity=".45"/><stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#g)"/></svg>`;
}

// ---------------------------------------------------------------- the props atlas

const ICON = (d: string, color: string, w = 2): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BURST: Record<string, string> = {
  laugh: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM7.5 9l2 1.2-2 1.2M16.5 9l-2 1.2 2 1.2M7.5 14h9a4.5 4.5 0 0 1-9 0zM4.5 13.5c-.8 1.2-1 2.2-.4 2.8M19.5 13.5c.8 1.2 1 2.2.4 2.8",
  shock: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM9 9.5h.01M15 9.5h.01M12 13.2a1.8 2.3 0 1 0 0 4.6 1.8 2.3 0 1 0 0-4.6z",
  facepalm: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM9.5 16h5M6.5 10.5c2-2.5 9-2.5 11 0v1.5c-2 1.5-9 1.5-11 0zM19 4.5v2.5",
  happy: "M12 20.5S3.5 15.3 3.5 9.4A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 8.5 2.3c0 5.9-8.5 11.1-8.5 11.1z",
  sad: "M7 13.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.4 3.3 3.3 0 0 1 .3 6.6zM8 17l-1 2.5M12 17l-1 2.5M16 17l-1 2.5",
  cheer: "M4 20l4.5-11.5 7 7zM13 4.5l.8 2M18 6l-2 1.5M19.5 11h-2.2M10.5 3.5v.01M20.5 3.5v.01M15.5 10.5l1-1",
};

function coinSvg(color: ColorId): string {
  const c = COLORS.find((x) => x.id === color) ?? COLORS[0];
  const ink = c.glyph === "ink" ? INK : CREAM;
  // 12 dp disc, 1.5 dp cream rim, the shape glyph at 60 % (DESIGN-JAMAA §5.1), a soft gold halo around it.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20" width="80" height="80"><defs><radialGradient id="h"><stop offset=".5" stop-color="#FFE3A3" stop-opacity=".8"/><stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/></radialGradient></defs>
<circle r="10" fill="url(#h)"/><circle r="6.75" fill="${CREAM}"/><circle r="6" fill="${c.hex}"/><g transform="translate(-3.6 -3.6) scale(.3)"><path d="${BODY_PATHS[c.shape]}" fill="${ink}"/></g></svg>`;
}

/** Atlas entries: key → [svg, design width, design height] (rasterised at 2× of the box they are drawn in). */
function atlasEntries(): [string, string, number, number][] {
  const e: [string, string, number, number][] = [
    ["pencil", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path d="M4 20l1.2-4.6L16.4 4.2a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="#FFC94D" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M14.6 6l3.4 3.4" stroke="${INK}" stroke-width="1.4"/><path d="M4 20l1.2-4.6 3.4 3.4z" fill="#F4D9B0" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M16.4 4.2l3.4 3.4.6-.6a2 2 0 0 0 0-2.8l-.6-.6a2 2 0 0 0-2.8 0z" fill="#FF6B8A"/></svg>`, 24, 24],
    ["envelope", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="#F7EBD3" stroke="${INK}" stroke-width="1.3"/><path d="M2.8 6.4l9.2 7 9.2-7" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="2.1" fill="#C8362F"/></svg>`, 32, 32],
    ["envelopeOpen", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="#F7EBD3" stroke="${INK}" stroke-width="1.3"/><path d="M2.8 6.4l9.2 7 9.2-7" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/></svg>`, 32, 32],
    ["ballot", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><rect x="4" y="3" width="16" height="18" rx="2" fill="${CREAM}" stroke="${INK}" stroke-width="1.3"/><path d="M8 12.5l2.6 2.6L16.5 9" fill="none" stroke="#1FA88A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 24, 24],
    ["moustache", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="96" height="96"><path d="M21 18l9 20" stroke="#8B5A2B" stroke-width="2.6" stroke-linecap="round"/><path d="M20 16c-3.5-4.8-9.8-5.2-13.6-1.2-1.6 1.7-3.6 2-5 1 .6 4.4 5.4 7.6 10.6 6.4 3.4-.8 6-2.6 8-6.2 2 3.6 4.6 5.4 8 6.2 5.2 1.2 10-2 10.6-6.4-1.4 1-3.4.7-5-1C29.8 10.8 23.5 11.2 20 16z" fill="#2A1A10"/></svg>`, 48, 48],
    ["house", houseSvg(false), 80, 80],
    ["houseLaugh", houseSvg(true), 80, 80],
    ["buoy", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40"><circle cx="12" cy="12" r="8.5" fill="none" stroke="${CREAM}" stroke-width="5"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#FF5A5F" stroke-width="5" stroke-dasharray="6.7 6.7"/></svg>`, 20, 20],
    ["heart", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="56" height="56"><path d="M12 20.5S3.5 15.3 3.5 9.4A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 8.5 2.3c0 5.9-8.5 11.1-8.5 11.1z" fill="#FF6B8A" stroke="#FF6B8A" stroke-width="2" stroke-linejoin="round"/></svg>`, 28, 28],
    ["crown", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="80" height="54"><path d="M2 14L4 3l5 5 3-7 3 7 5-5 2 11z" fill="#FFC94D" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/></svg>`, 40, 27],
    ["trophy", ICON("M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3.1 4.1M16 6h2.8a3 3 0 0 1-3.1 4.1M12 13.5V17M8.5 20h7M10 17h4", "#FFE3A3").replace('width="48" height="48"', 'width="96" height="96"'), 48, 48],
    ["info", ICON("M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 11v5.5M12 7.8h.01", "#7A4A00"), 24, 24],
    ["timer", ICON("M12 5.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15zM12 9.5V13l2.3 2.3M10 2.5h4M18.4 6.6l1.3-1.3", "#FFE3A3"), 24, 24],
    ["arrowFwd", ICON("M5 12h14M13 6l6 6-6 6", CREAM), 24, 24],
    ["arrowBack", ICON("M19 12H5M11 6l-6 6 6 6", "#B8A8D6"), 24, 24],
    ["wifiOff", ICON("M3 3l18 18M8.6 16.2a4.8 4.8 0 0 1 6.8 0M5.2 12.8a9.6 9.6 0 0 1 4.3-2.4M18.8 12.8a9.6 9.6 0 0 0-1.6-1.2M2 9.3a14 14 0 0 1 3.4-2.4M22 9.3A14 14 0 0 0 11.1 5.5M12 19.8h.01", INK), 24, 24],
    ["glow", glowSvg(), 64, 64],
  ];
  for (const [k, d] of Object.entries(BURST)) e.push([`r-${k}`, ICON(d, CREAM), 24, 24]);
  for (const c of COLORS) e.push([`coin-${c.id}`, coinSvg(c.id), 20, 20]);
  return e;
}

function houseSvg(laugh: boolean): string {
  const face = laugh
    ? `<path d="M15 20l3.5 2-3.5 2M33 20l-3.5 2 3.5 2" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 31.5c2 4.5 12 4.5 14 0z" fill="${INK}"/>`
    : `<circle cx="17.5" cy="21" r="2" fill="${INK}"/><circle cx="30.5" cy="21" r="2" fill="${INK}"/><path d="M19 33c3 1.6 7 1.6 10 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="160" height="160"><ellipse cx="24" cy="46" rx="14" ry="2.2" fill="rgba(0,0,0,.3)"/><circle cx="24" cy="24" r="20" fill="#F2E6D0" stroke="rgba(18,10,31,.25)" stroke-width="1"/><path d="M10 13c4-6 24-6 28 0-2-1.5-6-2.5-14-2.5S12 11.5 10 13z" fill="#5B3A1E"/>${face}<path d="M24 27c-2.6-3.4-7.2-3.7-10-.9-1.2 1.2-2.6 1.4-3.6.7.4 3.2 3.9 5.5 7.7 4.6 2.5-.6 4.4-1.9 5.9-4.4 1.5 2.5 3.4 3.8 5.9 4.4 3.8.9 7.3-1.4 7.7-4.6-1 .7-2.4.5-3.6-.7-2.8-2.8-7.4-2.5-10 .9z" fill="#2A1A10"/></svg>`;
}

// ---------------------------------------------------------------- loading

const decode = (svg: string): Promise<HTMLImageElement | null> => new Promise((res) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

function canvasTexture(img: HTMLImageElement | null, w: number, h: number): Texture {
  if (!img) return Texture.EMPTY;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return Texture.from(cv);
}

export type BigArt = "cafe" | "board" | "cone";
const big = new Map<BigArt, Texture>();
const frames = new Map<string, Texture>();
let loading: Promise<void> | null = null;
const waiters = new Set<() => void>();

/** Starts (once) decoding every Bluff drawing; `onReady` runs when they are all available. */
export function loadBluffArt(onReady: () => void): void {
  if (big.size > 0 && frames.size > 0) { onReady(); return; }
  waiters.add(onReady);
  loading ??= (async () => {
    const [cafe, board, cone] = await Promise.all([decode(cafeSvg()), decode(boardSvg()), decode(coneSvg())]);
    big.set("cafe", canvasTexture(cafe, 1920, 1080));
    big.set("board", canvasTexture(board, 1152, 552));
    big.set("cone", canvasTexture(cone, 340, 356));
    // The atlas: every prop at 2× its design box, shelf-packed into one 1024-wide canvas.
    const list = atlasEntries();
    const imgs = await Promise.all(list.map(([, svg]) => decode(svg)));
    const AW = 1024;
    let x = 0, y = 0, row = 0;
    const spots = list.map(([, , w, h]) => {
      const pw = w * 2 + 2, ph = h * 2 + 2;
      if (x + pw > AW) { x = 0; y += row; row = 0; }
      const at = { x, y, w: w * 2, h: h * 2 };
      x += pw; row = Math.max(row, ph);
      return at;
    });
    const cv = document.createElement("canvas");
    cv.width = AW; cv.height = y + row;
    const ctx = cv.getContext("2d")!;
    imgs.forEach((img, i) => { const s = spots[i]!; if (img) ctx.drawImage(img, s.x, s.y, s.w, s.h); });
    const base = Texture.from(cv);
    base.source.autoGenerateMipmaps = true;
    list.forEach(([key], i) => { const s = spots[i]!; frames.set(key, new Texture({ source: base.source, frame: new Rectangle(s.x, s.y, s.w, s.h) })); });
    for (const f of waiters) f();
    waiters.clear();
  })();
}
export function forgetBluffArt(onReady: () => void): void { waiters.delete(onReady); }

export function bigTexture(k: BigArt): Texture { return big.get(k) ?? Texture.EMPTY; }
export function artTexture(key: string): Texture { return frames.get(key) ?? Texture.EMPTY; }

/** A sprite of an atlas prop drawn `w` × `h` dp, anchored (ax, ay); it fills in when the atlas is ready. */
export class ArtSprite extends Sprite {
  constructor(private key: string, private readonly w: number, private readonly h: number, ax = 0.5, ay = 0.5) {
    super(artTexture(key));
    this.anchor.set(ax, ay);
    this.fit();
  }
  refresh(): void { if (!this.destroyed) { this.texture = artTexture(this.key); this.fit(); } }
  setKey(k: string): void { if (k !== this.key) { this.key = k; this.refresh(); } }
  private fit(): void { this.width = this.w; this.height = this.h; }
}
