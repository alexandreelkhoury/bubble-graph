// Shared phone UI pieces (DESIGN §9): Button, Sheet, Toasts, live regions, top bar, confetti.
import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import { COLORS } from "@mishana/shared/constants";
import type { ColorId } from "@mishana/shared/constants";
import { assertiveMsg, menuOpen, politeMsg, toasts } from "../state/store";
import { BRAND } from "@mishana/shared/brand";
import { locale, t, tSplit } from "../i18n/t";
import { reduced } from "../lib/motion";
import type { MessageKey, Params } from "../i18n/t";
import { Icon } from "./Icon";
import { Avatar } from "./PlayerChip";
import type { AvatarState } from "./PlayerChip";

type BtnKind = "primary" | "secondary" | "danger" | "ghost";

export function Button({ kind = "primary", class: cls, children, ...rest }: { kind?: BtnKind; class?: string; children: ComponentChildren } & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class">) {
  return (
    <button type="button" class={`btn btn--${kind}${cls ? ` ${cls}` : ""}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * Bottom sheet (`radius.xl` top corners, drag handle, `elev.3`). Escape or the scrim closes it; `closable` adds a sticky
 * header with a 48 px close button, and `footer` a sticky bottom action (full-height sheets must never trap a phone).
 */
export function Sheet({ open, onClose, title, children, labelledBy, closable = false, footer }: { open: boolean; onClose(): void; title?: string; children: ComponentChildren; labelledBy?: string; closable?: boolean; footer?: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => panel.current?.querySelector<HTMLElement>("button, [href], input, [tabindex]")?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-root">
      <div class="scrim" onClick={onClose} />
      <div class={`sheet${closable ? " sheet--full" : ""}`} role="dialog" aria-modal="true" aria-label={title} aria-labelledby={labelledBy} ref={panel}>
        {closable ? (
          <header class="sheet__head">
            <span class="sheet__handle" aria-hidden="true" />
            <h2 class="sheet__title">{title}</h2>
            <button type="button" class="iconbtn sheet__close" aria-label={t("common.close")} onClick={onClose}><Icon name="x" /></button>
          </header>
        ) : (
          <>
            <span class="sheet__handle" aria-hidden="true" />
            {title && <h2 class="sheet__title">{title}</h2>}
          </>
        )}
        {children}
        {footer && <div class="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirm sheet with the safe option first. */
export function ConfirmSheet({ open, title, body, confirm, danger = true, onConfirm, onClose }: { open: boolean; title: string; body?: string; confirm: string; danger?: boolean; onConfirm(): void; onClose(): void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p class="sheet__body">{body}</p>}
      <div class="sheet__actions">
        <Button kind="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button kind={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirm}</Button>
      </div>
    </Sheet>
  );
}

export function Toasts() {
  const list = toasts.value;
  return (
    <div class="toasts" aria-live="polite">
      {list.map((x) => (
        <div key={x.id} class={`toast toast--${x.tone}`} role={x.tone === "error" ? "alert" : "status"}>
          {x.tone === "success" && <Icon name="check" size={20} />}
          {x.tone === "error" && <Icon name="info" size={20} />}
          <span>{x.text}</span>
        </div>
      ))}
    </div>
  );
}

export function LiveRegions() {
  return (
    <>
      <div class="sr-only" aria-live="polite">{politeMsg.value}</div>
      <div class="sr-only" aria-live="assertive">{assertiveMsg.value}</div>
    </>
  );
}

/** The room code is always LTR and isolated, one run ("EJJE", as on the TV and in the join heading). */
export function CodeChip({ code }: { code: string }) {
  return (
    <span class="codechip code" dir="ltr" aria-label={`${t("lobby.roomCode")} ${code.split("").join(" ")}`}>
      <span class="codechip__text">{code}</span>
    </span>
  );
}

/** The wordmark: the Arabic one on Arabic surfaces (DESIGN §1.3), else the Latin one. */
export function Wordmark({ class: cls }: { class?: string }) {
  const ar = locale.value === "ar";
  return <img class={cls} src={ar ? "/brand/wordmark-ar.svg" : "/brand/wordmark-latin.svg"} alt={ar ? BRAND.nameAr : BRAND.name} height={42} />;
}

export function TopBar({ code, name, color, host = false, state = "normal", showLang = false, onLang }: { code: string | null; name?: string; color?: ColorId; host?: boolean; state?: AvatarState; showLang?: boolean; onLang?(): void }) {
  return (
    <header class="topbar">
      <div class="topbar__start">{code ? <CodeChip code={code} /> : <Wordmark class="topbar__wordmark" />}</div>
      <div class="topbar__center">
        {name && color && (
          <span class="topbar__me">
            <Avatar color={color} size={28} state={state} host={host} />
            <bdi>{name}</bdi>
          </span>
        )}
      </div>
      <div class="topbar__end">
        {showLang ? (
          <button type="button" class="chipbtn" onClick={onLang} aria-label={t("common.language")}>
            <Icon name="globe" size={20} />
            <span class="chipbtn__label">{t("common.language")}</span>
          </button>
        ) : (
          <button type="button" class="iconbtn" onClick={() => { menuOpen.value = true; }} aria-label={t("phone.menu")} aria-haspopup="dialog">
            <Icon name="more" />
          </button>
        )}
      </div>
    </header>
  );
}

/** Token hexes for the few places that need a colour in JS (confetti, the QR modules); keep in sync with tokens.css. */
export const PALETTE = { text: "#FFF7EC", ink: "#120A1F", accent: "#FFC94D", primary: "#FF4F9A", blank: "#ECE6F5" } as const;

/** A one-shot confetti burst (none with reduced motion). */
export function Confetti({ colors, count = 36 }: { colors?: string[]; count?: number }) {
  if (reduced()) return null;
  const palette = colors ?? [PALETTE.text, PALETTE.accent, PALETTE.primary, ...COLORS.slice(0, 4).map((c) => c.hex)];
  const bits = Array.from({ length: count }, (_, i) => {
    const x = (i * 37) % 100;
    const delay = (i % 9) * 60;
    const dur = 1400 + ((i * 53) % 700);
    const rot = (i * 71) % 360;
    const drift = ((i * 29) % 60) - 30;
    return (
      <i key={i} style={{
        "--x": `${x}%`, "--d": `${delay}ms`, "--t": `${dur}ms`, "--r": `${rot}deg`, "--dx": `${drift}px`,
        background: palette[i % palette.length],
      }} />
    );
  });
  return <div class="confetti" aria-hidden="true">{bits}</div>;
}

/** The screen's heading block; the h1 takes focus on every phase change (DESIGN §8). */
export function Heading({ eyebrow, title, sub, display = false }: { eyebrow?: ComponentChildren; title: ComponentChildren; sub?: ComponentChildren; display?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div class="heading">
      {eyebrow && <p class="eyebrow">{eyebrow}</p>}
      <h1 ref={ref} tabIndex={-1} class={display ? "display" : "h1"}>{title}</h1>
      {sub && <p class="sub">{sub}</p>}
    </div>
  );
}

/** Renders a translation with JSX in place of one placeholder (e.g. a role chip or an avatar). */
export function Slot({ k, slot, params, children }: { k: MessageKey; slot: string; params?: Params; children: ComponentChildren }) {
  const [a, b] = tSplit(k, slot, params);
  return <>{a}{children}{b}</>;
}
