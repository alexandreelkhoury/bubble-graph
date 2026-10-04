export const USAGE: string;
export function normalizeId(raw: string): string;
export function parseExpires(raw: string, nowMs: number): number;
export function buildRequest(
  argv: string[],
  env: Record<string, string | undefined>,
  nowMs?: number,
): { kind: "grant" | "list" | "revoke"; url: string; init: { method: string; headers: Record<string, string>; body?: string } };
