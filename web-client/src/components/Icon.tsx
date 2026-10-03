// DESIGN §5.1: 24 × 24, 2 px stroke, round caps/joins, currentColor. Directional icons mirror in RTL.
import type { JSX } from "preact";

const P: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  crown: "M3.5 8.5l4.5 3.8L12 5.5l4 6.8 4.5-3.8L18.8 18H5.2z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3.5 12h17M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9s1.2-6.3 3.8-9z",
  "arrow-forward": "M5 12h14M13 6l6 6-6 6",
  "chevron-forward": "M9.5 6l6 6-6 6",
  "chevron-back": "M14.5 6l-6 6 6 6",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 1 0 0-5.6z",
  "eye-off": "M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.3M9.9 9.9a2.8 2.8 0 0 0 4 4",
  "hand-press": "M12 8.2h.01M7.3 8.5a4.7 4.7 0 0 1 9.4 0M4.4 8.5a7.6 7.6 0 0 1 15.2 0M10 21.5v-7a2 2 0 0 1 4 0v3.5h1.8a2.2 2.2 0 0 1 2.2 2.2v1.3",
  lock: "M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  "door-out": "M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5",
  "wifi-off": "M3 3l18 18M8.6 16.2a4.8 4.8 0 0 1 6.8 0M5.2 12.8a9.6 9.6 0 0 1 4.3-2.4M18.8 12.8a9.6 9.6 0 0 0-1.6-1.2M2 9.3a14 14 0 0 1 3.4-2.4M22 9.3A14 14 0 0 0 11.1 5.5M12 19.8h.01",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.6h-4.6",
  vibrate: "M9.5 4h5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 18.5v-13A1.5 1.5 0 0 1 9.5 4zM4.5 9v6M19.5 9v6",
  trophy: "M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3.1 4.1M16 6h2.8a3 3 0 0 1-3.1 4.1M12 13.5V17M8.5 20h7M10 17h4",
  timer: "M12 5.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15zM12 9.5V13l2.3 2.3M10 2.5h4M18.4 6.6l1.3-1.3",
  users: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-2.2-4.9",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM10.3 3h3.4l.5 2.4 1.7 1 2.3-.8 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.8-1.7 1-.5 2.4h-3.4l-.5-2.4-1.7-1-2.3.8-1.7-2.9 1.8-1.6v-2L4.1 8.5l1.7-2.9 2.3.8 1.7-1z",
  dice: "M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  "user-x": "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M17 8.5l4 4M21 8.5l-4 4",
  speech: "M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4h.5A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4z",
  vote: "M4 12.5h7.5M8.5 9.5l3 3-3 3M15.5 9.5a3 3 0 1 0 0 6 3 3 0 1 0 0-6z",
  play: "M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z",
  pause: "M8 5v14M16 5v14",
  tv: "M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 21h8",
  phone: "M8.5 2.5h7A2 2 0 0 1 17.5 4.5v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18.5h2",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 11v5.5M12 7.8h.01",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z",
};

const MIRROR = new Set(["arrow-forward", "chevron-forward", "chevron-back", "door-out", "speech", "vote"]);

export type IconName = keyof typeof P | string;

export function Icon({ name, size = 24, class: cls, ...rest }: { name: IconName; size?: number; class?: string } & JSX.SVGAttributes<SVGSVGElement>) {
  const fat = name === "more" || name === "dice";
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" stroke-width={fat ? 3.2 : 2} stroke-linecap="round" stroke-linejoin="round"
      class={`icon${MIRROR.has(name) ? " icon--mirror" : ""}${cls ? ` ${cls}` : ""}`} {...rest}
    >
      <path d={P[name] ?? ""} />
    </svg>
  );
}
