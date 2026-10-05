// M4 v2 "Stop passing the phone": beat grid, cast and layout shared by M4.tsx and its m4-* helpers.
import {Player, PLAYERS} from '../brand';
import {b} from '../time';
import {SAFE_CX} from './common';

export const BODY_BEATS = 32.9;

/** Beats (ad beat 0 = the song's drop). One new idea per beat, ≤ 1 SFX per beat. */
export const T = {
  // hook: one grey phone goes round the table
  pass: [0.75, 1.5, 2.25], // Maya -> Karim -> Lea -> Joe
  read: 2.75, // Joe's screen shows his word
  peek: 3.1, // Sami leans in
  slam: 4.0, // Joe flips it face-down
  slide: [4.6, 5.25], // ...and shoves it into the middle of the table
  flood: 6, // magenta bursts out of it (the ad's one full-frame colour beat)
  pop: 6.4, // five phones of their own fly out of it
  hole: 6.97, // the stage opens back up under the phones
  // the fix: everyone's own phone
  flips: [7.9, 7.9, 8.9, 8.9, 11.25], // cast order: Maya, Karim (+4 f), Lea, Joe (+4 f), Sami (PASTA)
  shrink: 15.9,
  line: 16.25,
  open: 16.6,
  tvOn: 17.05,
  clues: [17.65, 18.55, 19.45], // Maya, Lea, Sami
  glance: 19.95,
  vote: 20.8, // phones switch to the vote screen
  votes: [21.8, 21.8, 22.8, 22.8], // landings (pairs, 5 f apart)
  stamp: 24.75,
  role: 25.35,
  back: 25.9, // phones show their words again
  push: 24.75,
};

/** Captions = VO lines, word for word. [start, end] in beats (see M4.tsx for the hold check). */
export const CAP = {
  hook: [-1.2, 3.75], // "Still passing one phone?"
  peeks: [4.2, 7.1], // "Someone always peeks."
  own: [7.35, 10.9], // "Your phone. Your word."
  pasta: [11.25, 16.2], // "Sami's is PASTA."
  know: [11.75, 16.2], // "He doesn't know."
  tv: [16.6, 20.75], // "The TV runs the game."
  vote: [21.15, 24.66], // "Vote on your phones."
  pay: [26.7, BODY_BEATS], // "Every player. Their own phone."
};

export const BODY_FRAMES = Math.round(b(BODY_BEATS));
export const END = BODY_FRAMES - 22;
export const FL = b(T.flood);
export const FLOOD = 21; // frames for the flood to clear the farthest corner (0.35 s)

// ---------------------------------------------------------------- cast
// Hook seats clockwise from the top: Maya, Karim, Lea, Joe, Sami (Sami sits next to Joe and peeks).
export const CAST: Player[] = [0, 1, 2, 3, 5].map((i) => PLAYERS[i]);
export const MOLE = 4;
/** Phone-row / TV-tile slot of each cast member: Sami in the middle so the OUT stamp sits centred and never clips. */
export const SLOT = [0, 1, 4, 3, 2];
export const CLUE_BY = [0, 2, 4]; // Maya "Cheese", Lea "Oven", Sami "Boiled?"
export const CLUE_TEXT = ['Cheese', 'Oven', 'Boiled?'];
export const VOTERS = [0, 1, 3, 2]; // cast indices, in landing order (Maya, Karim, Joe, Lea)
export const voteLand = (k: number) => b(T.votes[k]) + (k % 2) * 5;

export type Rect = {x: number; y: number; w: number; h: number};

// the fan of five big phones (3 + 2): Sami bottom-left, Joe bottom-right, so nobody crosses on the way to the row
export const PH = 520, PW = 250;
const FAN_SLOT = [0, 1, 2, 4, 3];
const FAN_POS: Rect[] = [
  {x: SAFE_CX - 280, y: 800, w: PW, h: PH}, {x: SAFE_CX, y: 785, w: PW, h: PH}, {x: SAFE_CX + 280, y: 800, w: PW, h: PH},
  {x: SAFE_CX - 150, y: 1335, w: PW, h: PH}, {x: SAFE_CX + 150, y: 1335, w: PW, h: PH},
];
export const FAN: Rect[] = FAN_SLOT.map((k) => FAN_POS[k]);
// the bottom row under the TV
export const RW = 166, RH = 346;
export const ROW: Rect[] = CAST.map((_, i) => ({x: SAFE_CX + (SLOT[i] - 2) * 178, y: 1398, w: RW, h: RH}));

// the TV, drawn 1:1 (never scaled): every word on it is real size
export const TV = {x: SAFE_CX, y: 735, w: 872, h: 540};
export const TILE_Y = 290; // local
export const TW = 160, TH = 200;
export const tileLX = (slot: number) => TV.w / 2 + (slot - 2) * 172;
export const tvWorld = (lx: number, ly: number) => ({x: TV.x - TV.w / 2 + lx, y: TV.y - TV.h / 2 + ly});
export const tileWorld = (i: number) => tvWorld(tileLX(SLOT[i]), TILE_Y);
