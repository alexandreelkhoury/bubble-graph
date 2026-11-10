// Fake local round (no server): one Bluff! prompt, 6 players, 3 picked options. Shapes follow GAME-BLUFF §12.2
// (reveal order: fewest votes first, the truth last; unpicked lies go to the "Nobody bought it" montage).

export interface Player { id: string; name: string; color: string; hex: number; score: number }
export interface Option { id: string; text: string; authorId: string | null; truth: boolean; voterIds: string[] }

export const PROMPT = "An octopus has three ________.";
export const NOTE = "True: two pump blood to the gills, one to the body.";
export const MULT = 1;
export const FOOL_POINTS = 60 * MULT;
export const TRUTH_POINTS = 100 * MULT;

export const PLAYERS: Player[] = [
  { id: "karim", name: "Karim", color: "coral", hex: 0xf0183a, score: 320 },
  { id: "maya", name: "Maya", color: "azure", hex: 0x478cff, score: 240 },
  { id: "ziad", name: "Ziad", color: "lemon", hex: 0xfff04d, score: 410 },
  { id: "nour", name: "Nour", color: "jade", hex: 0x1fa88a, score: 180 },
  { id: "rami", name: "Rami", color: "grape", hex: 0x7a43ff, score: 290 },
  { id: "lea", name: "Lea", color: "rose", hex: 0xff96c5, score: 350 },
];

/** Board order (as the cards were dealt during VOTING). */
export const OPTIONS: Option[] = [
  { id: "o1", text: "middle names", authorId: "maya", truth: false, voterIds: ["nour"] },
  { id: "o2", text: "phone chargers", authorId: "karim", truth: false, voterIds: [] },
  { id: "o3", text: "hearts", authorId: null, truth: true, voterIds: ["maya", "ziad", "rami"] },
  { id: "o4", text: "best friends", authorId: "ziad", truth: false, voterIds: ["karim", "lea"] },
  { id: "o5", text: "left feet", authorId: "nour", truth: false, voterIds: [] },
  { id: "o6", text: "secret recipes", authorId: "rami", truth: false, voterIds: [] },
  { id: "o7", text: "favourite colours", authorId: "lea", truth: false, voterIds: [] },
];

/** Reveal script: lies with votes, fewest first, then the truth. */
export function revealOrder(): Option[] {
  const lies = OPTIONS.filter((o) => !o.truth && o.voterIds.length > 0).sort((a, b) => a.voterIds.length - b.voterIds.length);
  const truth = OPTIONS.filter((o) => o.truth);
  return [...lies, ...truth];
}
export const unpicked = (): Option[] => OPTIONS.filter((o) => !o.truth && o.voterIds.length === 0);
