export type Mode = 'wide' | 'tall' | 'square';
export type Rect = {x: number; y: number; w: number; h: number}; // x,y = centre

export type Layout = {
  mode: Mode;
  W: number;
  H: number;
  tv: Rect;
  phone: Rect; // act 1 phone (Maya joining)
  cap: {x: number; y: number; size: number; maxW: number};
  hero: Rect; // act 2 single phone right after the flood
  phones: Rect[]; // act 2 six phones
  tiles: Rect[]; // act 3-4 player tiles
  big: number; // slogan type size
  logo: number; // mark size in the outro
};

const PHONE_RATIO = 0.48; // screen w / h

const phoneRect = (x: number, y: number, h: number): Rect => ({x, y, w: h * PHONE_RATIO, h});

/** 6 items centred on (cx, cy): one row of 6, or 3 x 2. */
const grid6 = (cx: number, cy: number, cols: number, w: number, h: number, gx: number, gy: number): Rect[] => {
  const rows = Math.ceil(6 / cols);
  const out: Rect[] = [];
  for (let i = 0; i < 6; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    out.push({x: cx + (c - (cols - 1) / 2) * (w + gx), y: cy + (r - (rows - 1) / 2) * (h + gy), w, h});
  }
  return out;
};

export const layoutFor = (W: number, H: number): Layout => {
  const mode: Mode = W > H * 1.2 ? 'wide' : H > W * 1.2 ? 'tall' : 'square';
  if (mode === 'wide') {
    const tvW = 1080;
    return {
      mode, W, H,
      tv: {x: 760, y: 455, w: tvW, h: tvW * 9 / 16},
      phone: phoneRect(1590, 470, 640),
      cap: {x: W / 2, y: 930, size: 64, maxW: 1700},
      hero: phoneRect(W / 2, 470, 760),
      phones: grid6(W / 2, 460, 6, 0.48 * 520, 520, 34, 0).map((r) => phoneRect(r.x, r.y, 520)),
      tiles: grid6(W / 2, 470, 6, 230, 250, 36, 0),
      big: 150,
      logo: 220,
    };
  }
  if (mode === 'tall') {
    const tvW = 1000;
    return {
      mode, W, H,
      tv: {x: W / 2, y: 720, w: tvW, h: tvW * 9 / 16},
      phone: phoneRect(W / 2, 1450, 760),
      cap: {x: W / 2, y: 260, size: 76, maxW: 960},
      hero: phoneRect(W / 2, 1000, 1180),
      phones: grid6(W / 2, 1040, 3, 0.48 * 600, 600, 40, 50).map((r) => phoneRect(r.x, r.y, 600)),
      tiles: grid6(W / 2, 1040, 3, 270, 290, 40, 70),
      big: 140,
      logo: 300,
    };
  }
  const tvW = 800;
  return {
    mode, W, H,
    tv: {x: 455, y: 450, w: tvW, h: tvW * 9 / 16},
    phone: phoneRect(915, 470, 500),
    cap: {x: W / 2, y: 930, size: 56, maxW: 980},
    hero: phoneRect(W / 2, 470, 720),
    phones: grid6(W / 2, 460, 3, 0.48 * 360, 360, 34, 30).map((r) => phoneRect(r.x, r.y, 360)),
    tiles: grid6(W / 2, 470, 3, 230, 250, 34, 50),
    big: 120,
    logo: 190,
  };
};
