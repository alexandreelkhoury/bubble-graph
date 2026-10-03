/** 16 random bytes as lowercase hex. Never crypto.randomUUID (unavailable on insecure http LAN origins). */
export function randomId(bytes = 16): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

let counter = 0;
/** Action ids echoed back as `ref` on errors (§6.2: /^[A-Za-z0-9-]{1,36}$/). */
export function nextActionId(): string {
  counter = (counter + 1) % 1_000_000_000;
  return String(counter);
}
