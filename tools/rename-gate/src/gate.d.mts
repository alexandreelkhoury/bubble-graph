export interface AllowList { globs: RegExp[]; lines: RegExp[] }
export interface GateHit { path: string; line: number; text: string }
export const GATE_PATTERN: RegExp;
export function globToRegExp(glob: string): RegExp;
export function parseAllowlist(text: string): AllowList;
export function isExcluded(path: string): boolean;
export function pathAllowed(path: string, allow: AllowList): boolean;
export function scanText(path: string, text: string, allow: AllowList): GateHit[];
export function isBinary(buf: Uint8Array): boolean;
export function listFiles(root: string): string[];
export function runGate(root: string, allowlistText: string): GateHit[];
