export const HEADER: string;
export const PREMIUM_PRICE_USD: string;
export const PREMIUM_LAUNCH_SALE_USD: string;
export const BIG_PACK_PAIRS: number;
export function packPriceUsd(pairs: number): string;
export interface PackJson { id: string; locale: string; tier?: string; pairs?: unknown[]; title: { en: string; fr: string; ar: string } }
export function productLines(packs: PackJson[]): string[];
