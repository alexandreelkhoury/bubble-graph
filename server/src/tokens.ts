// §7.7. Tokens are never logged and never stored in plain text.

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** `bytes` random bytes (from `source`, the platform CSPRNG by default) as lowercase hex (length 2 × bytes). */
export function randomHex(bytes: number, source: (n: number) => Uint8Array = randomBytes): string {
  return bytesToHex(source(bytes));
}

/** Lowercase hex SHA-256 of the UTF-8 encoding of `s`. */
export async function sha256hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return bytesToHex(new Uint8Array(digest));
}

/** Constant-time comparison for equal-length strings: XOR-accumulates over all chars. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
