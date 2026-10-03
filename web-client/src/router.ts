// §8.3 tiny location.pathname router (no library).
import { signal } from "@preact/signals";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_CODE_REGEX } from "@mishana/shared/constants";

export type Route =
  | { kind: "home"; prefill: string }
  | { kind: "room"; code: string; canonical: boolean }
  | { kind: "tv" };

/** Upper-cases and keeps only room-code alphabet characters (max 4). */
export function cleanCodeInput(raw: string): { code: string; rejected: boolean } {
  let code = "";
  let rejected = false;
  for (const ch of raw.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(ch)) {
      if (code.length < ROOM_CODE_LENGTH) code += ch;
    } else if (ch.trim() !== "") {
      rejected = true;
    }
  }
  return { code, rejected };
}

export function parseRoute(pathname: string): Route {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname; // malformed percent-encoding (e.g. /%E0) must never blank the app
  }
  const seg = decoded.replace(/^\/+|\/+$/g, "");
  if (seg === "") return { kind: "home", prefill: "" };
  const lower = seg.toLowerCase();
  if (lower === "tv" || lower === "tv-mock") return { kind: "tv" };
  if (!seg.includes("/")) {
    const upper = seg.toUpperCase();
    if (ROOM_CODE_REGEX.test(upper)) return { kind: "room", code: upper, canonical: upper === seg };
  }
  return { kind: "home", prefill: cleanCodeInput(seg).code };
}

export const route = signal<Route>(typeof location === "undefined" ? { kind: "home", prefill: "" } : parseRoute(location.pathname));

/** Replaces a non-canonical code path with its canonical upper case. */
export function canonicalize(): void {
  const r = route.value;
  if (r.kind === "room" && !r.canonical) {
    history.replaceState(null, "", `/${r.code}${location.search}`);
    route.value = { ...r, canonical: true };
  }
}

export function navigate(path: string, replace = false): void {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  route.value = parseRoute(location.pathname);
}

export function startRouter(): void {
  window.addEventListener("popstate", () => { route.value = parseRoute(location.pathname); });
  canonicalize();
}

/** Back to PH-01, optionally with the code box prefilled. */
export function goHome(prefill = ""): void {
  history.pushState(null, "", "/");
  route.value = { kind: "home", prefill };
}
