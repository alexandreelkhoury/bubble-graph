export const GAME_IDS: string[];
export const PASS_PRODUCT_ID: string;
export const HEADER: string;
export function packProductId(family: string): string;
export function listedPackFiles(contentRoot: string, game: string): string[];
export function productRows(packs: { gameId: string; pack: Record<string, unknown> }[]): string[];
