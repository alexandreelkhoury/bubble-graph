// Bluff's small original drawings (DESIGN-JAMAA §4.5 props, §5.2): the pencil, the envelope, the ballot, the
// fake-moustache-on-a-stick, the moustached house character, the lifebuoy and the heart; the rubber stamp; and the
// odometer (each digit column rolls, Western digits in every locale, DESIGN-JAMAA §5.1). Shared by phone and /tv.
import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

const INK = "#120A1F";
const CREAM = "#FFF7EC";

export function Pencil({ size = 22 }: { size?: number }) {
  return (
    <svg class="bf-prop bf-prop--pencil" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 20l1.2-4.6L16.4 4.2a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="#FFC94D" stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
      <path d="M14.6 6l3.4 3.4" stroke={INK} stroke-width="1.4" />
      <path d="M4 20l1.2-4.6 3.4 3.4z" fill="#F4D9B0" stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
      <path d="M16.4 4.2l3.4 3.4.6-.6a2 2 0 0 0 0-2.8l-.6-.6a2 2 0 0 0-2.8 0z" fill="#FF6B8A" />
    </svg>
  );
}

export function Envelope({ size = 22, sealed = true }: { size?: number; sealed?: boolean }) {
  return (
    <svg class="bf-prop bf-prop--envelope" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="#F7EBD3" stroke={INK} stroke-width="1.3" />
      <path d="M2.8 6.4l9.2 7 9.2-7" fill="none" stroke={INK} stroke-width="1.3" stroke-linejoin="round" />
      {sealed && <circle cx="12" cy="13.2" r="2.1" fill="#C8362F" />}
    </svg>
  );
}

export function Ballot({ size = 22 }: { size?: number }) {
  return (
    <svg class="bf-prop bf-prop--ballot" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" fill={CREAM} stroke={INK} stroke-width="1.3" />
      <path d="M8 12.5l2.6 2.6L16.5 9" fill="none" stroke="#1FA88A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** The fake moustache on a stick: a disguise, the face of a fibber (DESIGN-JAMAA §4.5). */
export function Moustache({ size = 40 }: { size?: number }) {
  return (
    <svg class="bf-prop bf-prop--moustache" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M21 18l9 20" stroke="#8B5A2B" stroke-width="2.6" stroke-linecap="round" />
      <path d="M20 16c-3.5-4.8-9.8-5.2-13.6-1.2-1.6 1.7-3.6 2-5 1 .6 4.4 5.4 7.6 10.6 6.4 3.4-.8 6-2.6 8-6.2 2 3.6 4.6 5.4 8 6.2 5.2 1.2 10-2 10.6-6.4-1.4 1-3.4.7-5-1C29.8 10.8 23.5 11.2 20 16z" fill="#2A1A10" />
    </svg>
  );
}

/** The house: a cream circle with a permanent moustache, no player colour (DESIGN-JAMAA §5.2). */
export function HouseChar({ size = 72, laugh = false }: { size?: number; laugh?: boolean }) {
  return (
    <svg class={`bf-house${laugh ? " is-laugh" : ""}`} viewBox="0 0 48 48" width={size} height={size} role="img" aria-hidden="true">
      <ellipse cx="24" cy="46" rx="14" ry="2.2" fill="rgba(0,0,0,.3)" />
      <circle cx="24" cy="24" r="20" fill="#F2E6D0" stroke="rgba(18,10,31,.25)" stroke-width="1" />
      <path d="M10 13c4-6 24-6 28 0-2-1.5-6-2.5-14-2.5S12 11.5 10 13z" fill="#5B3A1E" />
      {laugh
        ? <><path d="M15 20l3.5 2-3.5 2M33 20l-3.5 2 3.5 2" fill="none" stroke={INK} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M17 31.5c2 4.5 12 4.5 14 0z" fill={INK} /></>
        : <><circle cx="17.5" cy="21" r="2" fill={INK} /><circle cx="30.5" cy="21" r="2" fill={INK} />
          <path d="M19 33c3 1.6 7 1.6 10 0" fill="none" stroke={INK} stroke-width="1.6" stroke-linecap="round" /></>}
      <path d="M24 27c-2.6-3.4-7.2-3.7-10-.9-1.2 1.2-2.6 1.4-3.6.7.4 3.2 3.9 5.5 7.7 4.6 2.5-.6 4.4-1.9 5.9-4.4 1.5 2.5 3.4 3.8 5.9 4.4 3.8.9 7.3-1.4 7.7-4.6-1 .7-2.4.5-3.6-.7-2.8-2.8-7.4-2.5-10 .9z" fill="#2A1A10" />
    </svg>
  );
}

export function Lifebuoy({ size = 18 }: { size?: number }) {
  return (
    <svg class="bf-buoy" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke={CREAM} stroke-width="5" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="#FF5A5F" stroke-width="5" stroke-dasharray="6.7 6.7" />
    </svg>
  );
}

export function Heart({ size = 20, on = false }: { size?: number; on?: boolean }) {
  return (
    <svg class={`bf-heart${on ? " is-on" : ""}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 20.5S3.5 15.3 3.5 9.4A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 8.5 2.3c0 5.9-8.5 11.1-8.5 11.1z" fill={on ? "#FF6B8A" : "none"} stroke={on ? "#FF6B8A" : "currentColor"} stroke-width="2" stroke-linejoin="round" />
    </svg>
  );
}

/** A rubber stamp (LIE! red, HOUSE LIE violet, TRUTH green, MOST CONVINCING gold), rotated −8°. */
export function Stamp({ tone, children, class: cls }: { tone: "lie" | "house" | "truth" | "gold"; children: ComponentChildren; class?: string }) {
  return <span class={`bf-stamp bf-stamp--${tone}${cls ? ` ${cls}` : ""}`} role="status"><span class="bf-stamp__ink">{children}</span></span>;
}

const DIGITS = "0123456789";
/** Writes `value` into an odometer element (frame-driven: no re-render). Leading columns fade when unused. */
export function setOdo(el: HTMLElement, value: number): void {
  const v = Math.max(0, Math.round(value));
  if (el.dataset.v === String(v)) return;
  el.dataset.v = String(v);
  const cols = el.querySelectorAll<HTMLElement>(".odo__col");
  const s = String(v).padStart(cols.length, "0");
  const lead = cols.length - String(v).length;
  cols.forEach((c, i) => {
    c.style.setProperty("--d", s[i] ?? "0");
    c.classList.toggle("is-lead", i < lead);
  });
  el.setAttribute("aria-label", String(v));
}

/** An odometer showing `value` (columns for `max` digits). Re-renders roll to the new value (CSS transition). */
export function Odo({ value, max, class: cls, odoKey }: { value: number; max?: number; class?: string; odoKey?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const width = Math.max(1, String(Math.max(0, Math.round(max ?? value))).length, String(Math.max(0, Math.round(value))).length);
  useLayoutEffect(() => { if (ref.current) setOdo(ref.current, value); }, [value, width]);
  return (
    <span class={`odo tnum${cls ? ` ${cls}` : ""}`} ref={ref} data-odo={odoKey} role="img" dir="ltr">
      {Array.from({ length: width }, (_, i) => (
        <span key={i} class="odo__col"><span class="odo__strip">{DIGITS.split("").map((d) => <span key={d}>{d}</span>)}</span></span>
      ))}
    </span>
  );
}
