export const JS_BUDGET: number;
export const CONTENT_BUDGET: number;
export const UPLOAD_GZ_BUDGET: number;
export function checkSizes(files: { name: string; bytes: Uint8Array }[]): { ok: boolean; lines: string[] };
