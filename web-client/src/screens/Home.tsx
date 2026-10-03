// PH-01 Enter code: one input drawn as 4 boxes; upper-cases, accepts only the room-code alphabet.
import { useEffect, useRef, useState } from "preact/hooks";
import { ROOM_CODE_LENGTH } from "@mishana/shared/constants";
import { t } from "../i18n/t";
import { cleanCodeInput, navigate } from "../router";
import { Icon } from "../components/Icon";
import { Button, Heading } from "../components/UI";
import { HAPTIC, haptic } from "../lib/haptics";

export function Home({ prefill, onLang }: { prefill: string; onLang(): void }) {
  const [code, setCode] = useState(prefill);
  const [bad, setBad] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const go = (c: string): void => { if (c.length === ROOM_CODE_LENGTH) navigate(`/${c}`); };
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const onInput = (raw: string): void => {
    const { code: c, rejected } = cleanCodeInput(raw);
    setCode(c);
    if (input.current) input.current.value = c;
    if (rejected) {
      setBad(true);
      setShakeKey((k) => k + 1);
      haptic(HAPTIC.error);
    } else if (c.length > 0) {
      setBad(false);
    }
    if (c.length === ROOM_CODE_LENGTH && !rejected) go(c);
  };
  return (
    <div class="page">
      <header class="topbar topbar--brand">
        <div class="topbar__start"><img class="topbar__wordmark" src="/brand/wordmark-latin.svg" alt="Mish Ana!" width={140} height={42} /></div>
        <div class="topbar__center" />
        <div class="topbar__end">
          <button type="button" class="chipbtn" onClick={onLang} aria-label={t("common.language")}>
            <Icon name="globe" size={20} /><span class="chipbtn__label">{t("common.language")}</span>
          </button>
        </div>
      </header>
      <main class="screen screen--home">
        <div class="home-hero" aria-hidden="true">
          <img src="/brand/mark.svg" alt="" width={88} height={88} class="home-hero__mark" />
        </div>
        <Heading title={t("join.title")} sub={t("brand.tagline")} />
        <label class="field-label" for="code">{t("join.enterCode")}</label>
        <div class={`codeboxes${bad ? " is-bad" : ""}`} key={shakeKey} data-shake={shakeKey > 0 ? "1" : undefined}>
          <input
            id="code" ref={input} class="codeboxes__input code" value={code} dir="ltr"
            inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellcheck={false}
            maxLength={ROOM_CODE_LENGTH} enterKeyHint="go" aria-describedby="code-hint" aria-invalid={bad}
            onInput={(e) => onInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(code); }}
          />
          <div class="codeboxes__boxes" aria-hidden="true">
            {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
              <span class={`codebox${i < code.length ? " is-filled" : ""}${i === code.length ? " is-caret" : ""}`}>{code[i] ?? ""}</span>
            ))}
          </div>
        </div>
        <p id="code-hint" class={`hint${bad ? " hint--error" : ""}`} role={bad ? "alert" : undefined}>{bad ? t("join.codeInvalid") : " "}</p>
      </main>
      <footer class="actionbar">
        <Button disabled={code.length !== ROOM_CODE_LENGTH} onClick={() => go(code)}>
          <span>{t("join.next")}</span><Icon name="arrow-forward" />
        </Button>
      </footer>
    </div>
  );
}
