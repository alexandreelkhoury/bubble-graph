// GAME-BLUFF §8 phone screens (BL-PH-01..05, DESIGN-JAMAA §7.7), lazy-loaded as the `game-bluff` chunk. The platform
// shell adds the top bar, ⓘ, coach marks, the world flood, the benched view and the results cup + VIP buttons.
// Secrecy (§8.1): only the public projection plus this phone's own `me`. The vote list never recolours a pick (a subtle
// outline + small check), so a neighbour on the couch cannot read it from 2 m; nothing echoes the truth before REVEAL.
import "./phone.css";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { effect } from "@preact/signals";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { isolate, listOf, t, tSplit } from "../../i18n/t";
import type { MessageKey, Params } from "../../i18n/t";
import { act } from "../../state/session";
import { announce, clockOffset, lastError, pushToast, toasts } from "../../state/store";
import { HAPTIC, haptic } from "../../lib/haptics";
import { reduced } from "../../lib/motion";
import { Character } from "../../components/Character";
import { Icon } from "../../components/Icon";
import { Button, ConfirmSheet, Sheet } from "../../components/UI";
import { TimerBar, now } from "../../components/Timer";
import { ReactionsBar } from "../../platform/Reactions";
import { Envelope, Heart, HouseChar, Lifebuoy, Moustache, Odo, Stamp } from "./art";
import {
  BLUFF_ERRORS, LIE_MAX, activeSeats, awardAt, awardBodyKey, awardTitleKey, beatAt, bluffModel, deadlineOf, errorKey, graphemes, hintKey,
  isFinal, isHost, k, letterOf, promptLines, lieReady, myReveal, needsAction, placeOf, ranked, revealPlan, roundIntroKey, roundNameKey, typeKey,
} from "./model";
import type { BluffModel, Prompt, RevealStep, Seat } from "./model";

const tk = (s: string, p?: Params): string => t(k(s) as MessageKey, p);
const send = (i: Record<string, unknown>): boolean => act({ type: "GAME", gameId: "bluff", i } as Parameters<typeof act>[0]);
const serverNow = (): number => now.value + clockOffset.value;
const LONG_PRESS_MS = 550;
/** DESIGN-JAMAA §5.2 phone haptics: you fooled someone / you fell for it. */
export const HAPTIC_FOOLED = [20, 40, 20] as const;
export const HAPTIC_FELL = 40;

// ---------------------------------------------------------------- shared pieces

function Eyebrow({ m }: { m: BluffModel }) {
  const p = m.pub;
  const dl = deadlineOf(p, serverNow());
  return (
    <div class="eyebrow-row bf-eyebrow">
      <p class="eyebrow">
        <span class="bf-eyebrow__round">{isFinal(p) ? tk("round.final") : tk("round.number", { round: p.round })}</span>
        <span class="bf-eyebrow__sep" aria-hidden="true">·</span>
        <span class="tnum bf-eyebrow__count">{tk("prompt.counter", { index: Math.min(p.promptIndex + 1, p.promptCount), count: p.promptCount })}</span>
        {p.multiplier === 2 && <span class="bf-x2" dir="ltr">×2</span>}
      </p>
      {dl && <TimerBar deadline={dl} class="timerbar--inline" tone={p.phase === "WRITING" || p.phase === "VOTING" ? undefined : "neutral"} />}
    </div>
  );
}

/** The prompt as the phone shows it: type chip, the text (AR original + translit + translation when given), hint. */
function PromptCard({ prompt, final, hint = true }: { prompt: Prompt; final: boolean; hint?: boolean }) {
  const lines = promptLines(prompt);
  return (
    <section class="bf-pcard" key={prompt.id}>
      <div class="bf-pcard__chips">
        <span class="bf-chip bf-chip--type">{t(typeKey(prompt.type) as MessageKey)}</span>
        {final && <span class="bf-chip bf-chip--signal">{tk("noTruth.chip")}</span>}
        {prompt.rerun && <span class="bf-chip">{tk("prompt.rerun")}</span>}
      </div>
      <p class="bf-pcard__text" dir="auto">{lines.main}</p>
      {lines.translit && <p class="bf-pcard__translit" dir="ltr">{lines.translit}</p>}
      {lines.sub && <p class="bf-pcard__display" dir="auto">{lines.sub}</p>}
      {hint && <p class="bf-pcard__hint"><Icon name="info" size={16} />{t(hintKey(prompt.lengthHint) as MessageKey)}</p>}
    </section>
  );
}

function Me({ m, size = 72, expression = "idle" }: { m: BluffModel; size?: number; expression?: Parameters<typeof Character>[0]["expression"] }) {
  const s = m.myId ? m.byId.get(m.myId) : undefined;
  return s ? <Character color={s.color} size={size} expression={expression} /> : null;
}

function nameOf(m: BluffModel, id: string): string {
  return isolate(m.byId.get(id)?.name ?? "?");
}

// ---------------------------------------------------------------- BL-PH round intro / hold / waiting

function PhRoundIntro({ m }: { m: BluffModel }) {
  const fin = isFinal(m.pub);
  return (
    <main class={`screen bf-ph bf-ph--intro${fin ? " is-final" : ""}`}>
      <Eyebrow m={m} />
      <div class="bf-introcard">
        <p class="bf-introcard__num">{fin ? tk("round.final") : tk("round.number", { round: m.pub.round })}</p>
        <h1 class="bf-introcard__name" tabIndex={-1}>{t(roundNameKey(m.pub) as MessageKey)}</h1>
        <p class="bf-introcard__rule">{t(roundIntroKey(m.pub) as MessageKey)}</p>
        {m.pub.multiplier === 2 && <span class="bf-x2 bf-x2--big" dir="ltr">×2</span>}
      </div>
      <div class="bf-introme"><Me m={m} size={96} expression={fin ? "smug" : "happy"} /></div>
    </main>
  );
}

function PhHold({ m }: { m: BluffModel }) {
  const n = activeSeats(m).filter((s) => s.connected).length;
  return (
    <main class="screen bf-ph bf-ph--center">
      <Me m={m} size={96} expression="think" />
      <h1 class="h1" tabIndex={-1}>{tk("hold.waiting", { count: Math.min(n, 3) })}</h1>
    </main>
  );
}

function PhWaitingNext({ m }: { m: BluffModel }) {
  return (
    <main class="screen bf-ph bf-ph--center">
      <Me m={m} size={96} expression="happy" />
      <h1 class="h1" tabIndex={-1}>{tk("write.waitingForNext")}</h1>
      {m.pub.prompt && <PromptCard prompt={m.pub.prompt} final={isFinal(m.pub)} hint={false} />}
    </main>
  );
}

// ---------------------------------------------------------------- BL-PH-01 write

const draftKey = (promptId: string): string => `jamaa.bluff.draft.${promptId}`;
function readDraft(id: string): string {
  try { return sessionStorage.getItem(draftKey(id)) ?? ""; } catch { return ""; }
}
function writeDraft(id: string, s: string): void {
  try { sessionStorage.setItem(draftKey(id), s); } catch { /* private mode */ }
}

/** The inline error of the last refused SUBMIT_LIE / REQUEST_HELP (the server's code, this game's copy). */
function useBluffError(promptId: string | null, contentLocale: string): string | null {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setErr(null), [promptId]);
  useEffect(() => {
    const stale = lastError.peek();
    return effect(() => {
    const e = lastError.value;
    if (!e || e === stale || !(BLUFF_ERRORS as readonly string[]).includes(e.code)) return;
    const key = e.code === "LIE_WRONG_SCRIPT" ? k(contentLocale === "ar" ? "error.lieWrongScriptAr" : "error.lieWrongScriptLatn") : errorKey(e.code);
    setErr(e.code === "STALE_PROMPT" ? null : t(key as MessageKey));
    });
  }, [contentLocale, promptId]);
  return err;
}

function PhWrite({ m }: { m: BluffModel }) {
  const me = m.me!;
  const p = m.pub.prompt!;
  const fin = isFinal(m.pub);
  const [draft, setDraft] = useState(() => readDraft(p.id) || me.myLie || "");
  const [editing, setEditing] = useState(me.myLieStatus === "none");
  const [askSkip, setAskSkip] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const serverErr = useBluffError(p.id, m.contentLocale);
  const sentText = useRef<string | null>(null);
  // GAME-BLUFF §5.2 anti-oracle: a "too close" probe is accepted and recorded (lane A JAMAA-GAP: an error cannot carry a
  // state change), so the phone learns it from `me.tooCloseCount` going up: the field stays open with the warning.
  const closeSeen = useRef(me.tooCloseCount);
  const [closeErr, setCloseErr] = useState(false);
  useEffect(() => {
    if (me.tooCloseCount > closeSeen.current) { setCloseErr(true); setEditing(true); haptic(HAPTIC.error); announce(tk("error.lieTooClose"), true); }
    closeSeen.current = me.tooCloseCount;
  }, [me.tooCloseCount]);
  useEffect(() => { setCloseErr(false); }, [p.id]);
  const err = closeErr ? tk("error.lieTooClose") : serverErr;
  // A new prompt (skip, "Too famous!") resets the field; a help suggestion fills an empty one.
  useEffect(() => { setDraft(readDraft(p.id) || me.myLie || ""); setEditing(me.myLieStatus === "none"); }, [p.id]);
  useEffect(() => { if (me.help && !draft.trim()) { setDraft(me.help); writeDraft(p.id, me.help); } }, [me.help]);
  // The server accepted the lie: leave edit mode (an error keeps it).
  useEffect(() => { if (me.myLie !== null && me.myLie === sentText.current) setEditing(false); }, [me.myLie, me.editsLeft]);
  useEffect(() => { if (err) setEditing(true); }, [err]);
  const count = graphemes(draft);
  const ready = lieReady(draft) && me.editsLeft > 0;
  const submit = (): void => {
    const text = draft.trim();
    if (!lieReady(text)) return;
    sentText.current = text;
    if (send({ type: "SUBMIT_LIE", text, promptId: p.id })) haptic(HAPTIC.voteLocked);
  };
  if (me.myLieStatus === "spotOn") {
    return (
      <main class="screen bf-ph bf-ph--write">
        <Eyebrow m={m} />
        <PromptCard prompt={p} final={fin} hint={false} />
        <div class="bf-spoton" role="status">
          <Me m={m} size={80} expression="cheer" />
          <p class="bf-spoton__title" tabIndex={-1}>{tk("write.spotOn")}</p>
        </div>
      </main>
    );
  }
  const locked = me.myLieStatus === "locked" && !editing;
  return (
    <main class="screen bf-ph bf-ph--write">
      <Eyebrow m={m} />
      <PromptCard prompt={p} final={fin} />
      {m.pub.notice === "tooFamous" && <p class="bf-banner" role="status">{tk("prompt.tooFamous")}</p>}
      <p class="bf-tip">{fin ? tk("write.noTruthHint") : m.pub.roundKind === "saying" ? tk("write.sayingHint") : tk("coach.writing")}</p>
      {me.foundWhileWriting && <p class="bf-warnline"><Icon name="info" size={16} />{tk("write.foundEarly")}</p>}
      {locked ? (
        <div class="bf-locked" role="status">
          <span class="bf-locked__env"><Envelope size={34} /></span>
          <p class="bf-locked__lie" dir="auto">{me.myLie}</p>
          <p class="bf-locked__msg">{tk("write.locked")}</p>
          {me.editsLeft > 0 && (
            <button type="button" class="linkbtn bf-edit" onClick={() => { setEditing(true); queueMicrotask(() => input.current?.focus()); }}>
              <Icon name="refresh" size={16} />{tk("write.edit")} · <span class="tnum">{tk("write.editsLeft", { count: me.editsLeft })}</span>
            </button>
          )}
        </div>
      ) : (
        <div class="bf-field">
          <textarea ref={input} class="input bf-input" dir="auto" rows={2} maxLength={240} value={draft} enterkeyhint="send"
            placeholder={fin ? tk("write.placeholderNoTruth") : tk("write.placeholder")} aria-label={fin ? tk("write.placeholderNoTruth") : tk("write.placeholder")}
            aria-invalid={err ? true : undefined}
            onInput={(e) => { const v = (e.currentTarget as HTMLTextAreaElement).value.replace(/\n/g, " "); setDraft(v); writeDraft(p.id, v); setCloseErr(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <span class={`bf-count tnum${count > LIE_MAX ? " is-over" : ""}`} aria-hidden="true">{tk("write.charCount", { count })}</span>
          {err && <p class="hint hint--error bf-err" role="alert">{err}</p>}
          {me.help && <p class="bf-helped"><Lifebuoy size={16} />{tk("write.helpGiven")}</p>}
          {me.myLieStatus === "none" && !me.help && (
            me.helpNone
              ? <p class="bf-helped is-none">{tk("help.none")}</p>
              : <button type="button" class="linkbtn bf-help" onClick={() => send({ type: "REQUEST_HELP", promptId: p.id })}><Lifebuoy size={18} />{tk("write.help")}</button>
          )}
        </div>
      )}
      <div class="bf-gang" aria-hidden="true">
        {activeSeats(m).map((s) => (
          <span key={s.id} class={`bf-gang__s${m.pub.submittedIds.includes(s.id) ? " is-in" : ""}`}><Character color={s.color} size={40} expression={m.pub.submittedIds.includes(s.id) ? "done" : "think"} /></span>
        ))}
      </div>
      {isHost(m) && m.pub.skipsLeft > 0 && (
        <button type="button" class="linkbtn bf-hostlink" onClick={() => setAskSkip(true)}>
          <Icon name="arrow-forward" size={16} class="flip-rtl" />{tk("pause.skipPrompt")} · {tk("pause.skipsLeft", { count: m.pub.skipsLeft })}
        </button>
      )}
      {!locked && (
        <footer class="actionbar">
          <Button onClick={submit} disabled={!ready} data-bf-lock>{fin ? tk("write.ctaNoTruth") : tk("write.cta")}</Button>
        </footer>
      )}
      <ConfirmSheet open={askSkip} title={tk("pause.skipPrompt")} confirm={tk("pause.skipPrompt")} danger={false}
        onConfirm={() => { send({ type: "SKIP_PROMPT", promptId: p.id }); setAskSkip(false); }} onClose={() => setAskSkip(false)} />
    </main>
  );
}

// ---------------------------------------------------------------- BL-PH-02 vote

function PhVote({ m }: { m: BluffModel }) {
  const me = m.me!;
  const fin = isFinal(m.pub);
  const [hideFor, setHideFor] = useState<string | null>(null);
  const press = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const longFired = useRef(false);
  const host = isHost(m);
  const likesLeft = 2 - me.myLikes.length;
  const watch = me.spotOn;
  const err = useBluffError(m.pub.prompt?.id ?? null, m.contentLocale);
  const vote = (id: string): void => {
    if (watch || me.myOptionIds.includes(id) || me.myVote === id) return;
    if (send({ type: "VOTE", optionId: id })) haptic(HAPTIC.voteLocked);
  };
  const like = (id: string): void => {
    const on = !me.myLikes.includes(id);
    if (on && likesLeft <= 0) return;
    if (send({ type: "LIKE", optionId: id, on })) haptic(HAPTIC.tick);
  };
  const down = (id: string): void => {
    longFired.current = false;
    if (!host) return;
    const timer = setTimeout(() => { longFired.current = true; haptic(HAPTIC.tick); setHideFor(id); }, LONG_PRESS_MS);
    press.current = { id, timer };
  };
  const up = (): void => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  return (
    <main class="screen bf-ph bf-ph--vote">
      <Eyebrow m={m} />
      {m.pub.prompt && <p class="bf-vprompt" dir="auto">{m.pub.prompt.display ?? m.pub.prompt.original}</p>}
      <h1 class="h1 bf-vtitle" tabIndex={-1}>{watch ? tk("vote.spotOnWatch") : fin ? tk("vote.titleNoTruth") : tk("vote.title")}</h1>
      <p class={`bf-voteline${me.myVote ? " is-in" : ""}`} aria-live="polite">
        {watch ? <><Me m={m} size={40} expression="happy" />{tk("reveal.knewItPin")}</>
          : me.myVote ? <><Icon name="check" size={18} />{tk("vote.in")} · {tk("vote.change")}</> : m.pub.options.length === 2 ? tk("vote.easyOne") : null}
      </p>
      <ul class="bf-opts" role="list">
        {m.pub.options.map((o, i) => {
          const mine = me.myOptionIds.includes(o.id);
          const picked = me.myVote === o.id;
          const liked = me.myLikes.includes(o.id);
          return (
            <li key={o.id} class={`bf-opt${mine ? " is-mine" : ""}${picked ? " is-picked" : ""}`} style={{ "--i": i }}>
              <button type="button" class="bf-opt__main" aria-pressed={picked} aria-disabled={mine || watch} data-option={o.id}
                onClick={() => { if (!longFired.current) vote(o.id); }}
                onPointerDown={() => down(o.id)} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
                onContextMenu={(e) => { if (host) e.preventDefault(); }}>
                <span class="bf-opt__letter" aria-hidden="true">{letterOf(i)}</span>
                <span class="bf-opt__text" dir="auto">{o.text}</span>
                {mine ? <span class="bf-opt__yours">{tk("vote.yours")}</span> : picked && <span class="bf-opt__check" aria-hidden="true"><Icon name="check" size={16} /></span>}
              </button>
              {!mine && (
                <button type="button" class={`bf-opt__like${liked ? " is-on" : ""}`} aria-pressed={liked} aria-label={tk("vote.like")}
                  disabled={!liked && likesLeft <= 0} onClick={() => like(o.id)} data-like={o.id}>
                  <Heart size={22} on={liked} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {err && <p class="hint hint--error" role="alert">{err}</p>}
      <p class="bf-likesleft tnum"><Heart size={16} on={likesLeft < 2} />{tk("vote.likesLeft", { count: likesLeft })}</p>
      <Sheet open={hideFor !== null} onClose={() => setHideFor(null)} title={tk("vote.hideThis")}>
        <p class="bf-hidequote" dir="auto">{m.pub.options.find((o) => o.id === hideFor)?.text}</p>
        <p class="sub">{tk("pause.hidesLeft", { count: m.pub.hidesLeft })}</p>
        <div class="bf-sheetbtns">
          <Button kind="danger" disabled={m.pub.hidesLeft <= 0} onClick={() => { if (hideFor) send({ type: "HIDE_OPTION", optionId: hideFor }); setHideFor(null); }} data-bf-hide>
            <Icon name="eye" size={18} />{tk("vote.hideThis")}
          </Button>
          <Button kind="secondary" onClick={() => setHideFor(null)}>{t("common.cancel")}</Button>
        </div>
      </Sheet>
    </main>
  );
}

// ---------------------------------------------------------------- BL-PH-04 reveal (compact mirror)

function stampOf(s: RevealStep, final: boolean): { tone: "lie" | "house" | "truth" | "gold"; key: string } {
  if (final) return s.top ? { tone: "gold", key: "reveal.mostConvincing" } : { tone: "lie", key: "reveal.noTruthStamp" };
  return s.kind === "truth" ? { tone: "truth", key: "reveal.truth" } : s.kind === "house" ? { tone: "house", key: "reveal.house" } : { tone: "lie", key: "reveal.lie" };
}

function PhReveal({ m }: { m: BluffModel }) {
  const r = m.pub.reveal!;
  const plan = useMemo(() => revealPlan(r, reduced()), [r]);
  const start = (m.pub.deadline ?? serverNow()) - r.durationMs;
  const elapsed = Math.max(0, serverNow() - start);
  const bi = beatAt(plan, elapsed);
  const beat = plan.beats[bi]!;
  const done = elapsed >= plan.total;
  const into = elapsed - beat.start;
  const stamped = into > beat.dur * 0.45;
  const mine = myReveal(m)!;
  const step = r.steps[beat.steps[0] ?? -1];
  const ownEvent = step && m.myId ? (step.authorIds.includes(m.myId) ? "author" : !r.final && step.voterIds.includes(m.myId) && step.kind !== "truth" ? "fell" : null) : null;
  const lastBeat = useRef(-1);
  useEffect(() => {
    if (lastBeat.current === bi) return;
    lastBeat.current = bi;
    if (ownEvent === "author" && step && step.voteCount > 0) haptic(HAPTIC_FOOLED);
    if (ownEvent === "fell") haptic(HAPTIC_FELL);
  }, [bi]);
  if (done || beat.kind === "montage" || beat.kind === "likes") {
    return (
      <main class="screen bf-ph bf-ph--reveal">
        <Eyebrow m={m} />
        {r.truth && <div class="bf-rcard is-truth"><p class="bf-rcard__text" dir="auto">{r.truth.text}</p><Stamp tone="truth">{tk("reveal.truth")}</Stamp>
          {r.truth.note && <p class="bf-rcard__note" dir="auto">{tk("reveal.itMeans", { note: r.truth.note })}</p>}</div>}
        {r.final && <p class="bf-twistline">{tk("reveal.noTruthStamp")}</p>}
        <div class="bf-total" role="status">
          <Me m={m} size={72} expression={mine.total > 0 ? "cheer" : "sad"} />
          <p class="bf-total__pts"><span class="tnum">+</span><Odo value={mine.total} /></p>
          <p class="bf-total__label">{tk("reveal.thisPrompt", { points: `+${mine.total}` })}</p>
          {r.final && mine.believed > 0 && <p class="bf-total__sub">{tk("reveal.believed", { count: mine.believed })}</p>}
          {!r.final && mine.fooled > 0 && <p class="bf-total__sub">{tk("reveal.youFooled", { count: mine.fooled })}</p>}
        </div>
        <div class="bf-reactbar"><ReactionsBar /></div>
      </main>
    );
  }
  return (
    <main class="screen bf-ph bf-ph--reveal">
      <Eyebrow m={m} />
      {beat.kind === "intro" ? (
        <div class="bf-rintro"><p class="h1">{r.final ? tk("reveal.finalIntro") : t(roundNameKey(m.pub) as MessageKey)}</p></div>
      ) : beat.kind === "crown" ? (
        <div class="bf-rcard is-gold" key={`b${bi}`}>
          {beat.steps.length === 0 ? <p class="bf-rcard__text">{tk("reveal.noCrown")}</p>
            : beat.steps.map((i) => <p key={i} class="bf-rcard__text" dir="auto">{r.steps[i]!.text}</p>)}
          {beat.steps.length > 0 && stamped && <Stamp tone="gold">{tk("reveal.mostConvincing")}</Stamp>}
          {beat.steps.some((i) => m.myId && r.steps[i]!.authorIds.includes(m.myId)) && <p class="bf-own bf-own--good"><b class="tnum">+400</b></p>}
        </div>
      ) : beat.kind === "twist" ? (
        <div class="bf-rcard is-twist" key={`b${bi}`}><Stamp tone="lie">{tk("reveal.noTruthStamp")}</Stamp></div>
      ) : step ? (
        <div class={`bf-rcard${step.kind === "truth" && stamped ? " is-truth" : ""}`} key={`b${bi}`}>
          {r.final ? <p class="bf-rcard__text" dir="auto">{step.text}</p> : <IsIt text={step.text} />}
          {stamped && <Stamp tone={stampOf(step, r.final).tone}>{r.final ? `×${step.voteCount}` : tk(stampOf(step, r.final).key)}</Stamp>}
          {stamped && <OwnEvent m={m} step={step} final={r.final} kind={ownEvent} />}
        </div>
      ) : null}
    </main>
  );
}

/** "Is it… «text»?" with the answer set big (the locale's own quotes and question mark stay around it). */
function IsIt({ text }: { text: string }) {
  const [a, b] = tSplit(k("reveal.isIt") as MessageKey, "text");
  // The locale's own quotes hug the answer; the lead ("Is it…") stays small above it.
  const open = /["«“„]\s*$/.exec(a)?.[0].trim() ?? "";
  const close = /^\s*["»”]/.exec(b)?.[0].trim() ?? "";
  return (
    <>
      <p class="bf-rcard__ask">{a.slice(0, a.length - (/["«“„]\s*$/.exec(a)?.[0].length ?? 0)).trim()}</p>
      <p class="bf-rcard__text" dir="auto">{open}{text}{close}{b.slice(/^\s*["»”]/.exec(b)?.[0].length ?? 0).trim()}</p>
    </>
  );
}

function OwnEvent({ m, step, final, kind }: { m: BluffModel; step: RevealStep; final: boolean; kind: "author" | "fell" | null }) {
  const id = m.myId!;
  if (step.kind === "truth") {
    if (step.spotOnIds.includes(id)) return <p class="bf-own bf-own--good">{tk("reveal.knewItPin")}</p>;
    if (step.foundEarlyIds.includes(id)) return <p class="bf-own">{tk("reveal.foundEarly")}</p>;
    const d = step.deltas.find((x) => x.playerId === id && x.reason === "truth");
    return d ? <p class="bf-own bf-own--good"><Me m={m} size={48} expression="cheer" /><b class="tnum">+{d.points}</b></p> : null;
  }
  if (kind === "author") {
    const pts = step.deltas.filter((d) => d.playerId === id && d.reason === "fooled").reduce((a, d) => a + d.points, 0);
    return (
      <div class="bf-own bf-own--good">
        <span class="bf-own__liar"><Me m={m} size={56} expression="smug" /><Moustache size={34} /></span>
        <span>{final ? tk("reveal.believed", { count: step.voteCount }) : tk("reveal.youFooled", { count: step.voterIds.length })}</span>
        {pts > 0 && <span class="bf-coins" aria-hidden="true">{Array.from({ length: Math.min(6, final ? step.voteCount : step.voterIds.length) }, (_, i) => <i key={i} style={{ "--i": i }} />)}</span>}
        {pts > 0 && <b class="tnum">+{pts}</b>}
        {step.helped && <span class="bf-own__help"><Lifebuoy size={14} />{tk("reveal.helped")}</span>}
      </div>
    );
  }
  if (kind === "fell") {
    if (step.kind === "house") return <p class="bf-own bf-own--bad"><HouseChar size={48} laugh />{tk("reveal.fellForHouse")}</p>;
    const a = step.authorIds[0];
    const s = a ? m.byId.get(a) : undefined;
    return (
      <p class="bf-own bf-own--bad">{s && <Character color={s.color} size={48} expression="smug" />}
        {tk("reveal.fellFor", { name: listOf(step.authorIds.map((x) => nameOf(m, x))) })}</p>
    );
  }
  return null;
}

// ---------------------------------------------------------------- BL-PH-05 scores, awards, results

function Board({ m, max = 5 }: { m: BluffModel; max?: number }) {
  const list = ranked(m.seats);
  const mineAt = list.findIndex((s) => s.id === m.myId);
  const shown = list.slice(0, max);
  if (mineAt >= max) shown.push(list[mineAt]!);
  return (
    <ol class="bf-board">
      {shown.map((s) => (
        <li key={s.id} class={`bf-board__row${s.id === m.myId ? " is-me" : ""}${s.left ? " is-left" : ""}`}>
          <span class="bf-board__place tnum">{placeOf(list, s.id)}</span>
          <Character color={s.color} size={40} expression={s.score > s.scoreBefore ? "happy" : "idle"} crown={placeOf(list, s.id) === 1 && s.score > 0} />
          <bdi class="bf-board__name">{s.name}</bdi>
          {s.isNew && <span class="bf-chip">{tk("scores.new")}</span>}
          <span class="bf-board__score tnum"><Odo value={s.score} /></span>
        </li>
      ))}
    </ol>
  );
}

function PhScores({ m }: { m: BluffModel }) {
  const list = ranked(m.seats);
  const me = m.myId ? m.byId.get(m.myId) : undefined;
  const dl = deadlineOf(m.pub, serverNow());
  const secs = dl ? Math.ceil(Math.max(0, dl.at - serverNow()) / 1000) : 0;
  const [shown, setShown] = useState(me?.scoreBefore ?? 0);
  useEffect(() => { const id = setTimeout(() => setShown(me?.score ?? 0), reduced() ? 0 : 250); return () => clearTimeout(id); }, [me?.score]);
  return (
    <main class="screen bf-ph bf-ph--scores">
      <Eyebrow m={m} />
      {m.pub.voided && <p class="bf-banner" role="status">{tk("prompt.voided")}</p>}
      {me && (
        <div class="bf-mine">
          <span class="bf-mine__place">#<span class="tnum">{placeOf(list, me.id)}</span></span>
          <span class="bf-mine__score"><Odo value={shown} max={me.score} /></span>
          {me.score > me.scoreBefore && <span class="bf-mine__delta tnum">+{me.score - me.scoreBefore}</span>}
        </div>
      )}
      <Board m={m} />
      {m.pub.promptIndex + 1 < m.pub.promptCount && <p class="bf-next tnum">{tk("scores.nextIn", { seconds: secs })}</p>}
      {m.pub.promptIndex + 2 === m.pub.promptCount && <p class="bf-tip">{tk("scores.finalTease")}</p>}
      <div class="bf-reactbar"><ReactionsBar /></div>
    </main>
  );
}

function PhAwards({ m }: { m: BluffModel }) {
  const awards = m.pub.awards;
  const dl = m.pub.deadline;
  const total = 2500 + 3500 * awards.length;
  const elapsed = dl ? total - Math.max(0, dl - serverNow()) : total;
  const shown = awards.filter((_, i) => elapsed >= awardAt(i));
  const cur = shown[shown.length - 1];
  const mineAll = awards.filter((a) => m.myId && a.playerIds.includes(m.myId));
  return (
    <main class="screen bf-ph bf-ph--awards">
      <h1 class="h1" tabIndex={-1}>{tk("awards.title")}</h1>
      {cur ? <AwardCard m={m} a={cur} key={cur.id} /> : <div class="bf-drum" aria-hidden="true"><Icon name="trophy" size={64} /></div>}
      {mineAll.length > 0 && !mineAll.includes(cur!) && <p class="bf-tip">{mineAll.map((a) => t(awardTitleKey(a) as MessageKey)).join(" · ")}</p>}
      <div class="bf-reactbar"><ReactionsBar /></div>
    </main>
  );
}

function AwardCard({ m, a }: { m: BluffModel; a: Award }) {
  const mine = !!m.myId && a.playerIds.includes(m.myId);
  return (
    <div class={`bf-award${mine ? " is-mine" : ""}`} role="status">
      <span class="bf-award__trophy"><Icon name="trophy" size={34} /></span>
      <p class="bf-award__title">{t(awardTitleKey(a) as MessageKey)}</p>
      <div class="bf-award__who">
        {a.playerIds.map((id) => { const s = m.byId.get(id); return s ? <span key={id} class="bf-award__p"><Character color={s.color} size={64} expression="cheer" /><bdi>{s.name}</bdi></span> : null; })}
      </div>
      {a.text && <p class="bf-award__quote" dir="auto">{a.text}</p>}
      <p class="bf-award__body">{t(awardBodyKey(a) as MessageKey, { count: a.value })}</p>
    </div>
  );
}
type Award = BluffModel["pub"]["awards"][number];

function PhResults({ m }: { m: BluffModel }) {
  const list = ranked(m.seats);
  const me = m.myId ? m.byId.get(m.myId) : undefined;
  const place = me ? placeOf(list, me.id) : 0;
  const mine = m.pub.awards.filter((a) => m.myId && a.playerIds.includes(m.myId));
  return (
    <main class="screen bf-ph bf-ph--results">
      {me && (
        <div class="bf-mine bf-mine--final">
          <Character color={me.color} size={96} expression={place === 1 ? "cheer" : place <= 3 ? "happy" : "idle"} crown={place === 1} />
          <span class="bf-mine__place">#<span class="tnum">{place}</span></span>
          <span class="bf-mine__score"><Odo value={me.score} /></span>
        </div>
      )}
      {mine.map((a) => <p key={a.id} class="bf-medal"><Icon name="trophy" size={18} />{t(awardTitleKey(a) as MessageKey)}</p>)}
      <Board m={m} max={12} />
    </main>
  );
}

// ---------------------------------------------------------------- module

/** This phone's Bluff screen, or null (the shell then shows the benched view). */
export function Phone({ view }: { view: PlayerRoomView }) {
  const m = bluffModel(view);
  useToastFix();
  if (!m) return null;
  if (m.pub.phase === "RESULTS" || m.over) return <PhResults m={m} />;
  if (!m.me) return null;
  if (m.me.waitingForNext && m.pub.phase !== "AWARDS") return <PhWaitingNext m={m} />;
  switch (m.pub.phase) {
    case "ROUND_INTRO": return <PhRoundIntro m={m} />;
    case "WRITING": return m.pub.prompt ? <PhWrite m={m} /> : null;
    case "VOTING": return <PhVote m={m} />;
    case "REVEAL": return m.pub.reveal ? <PhReveal m={m} /> : null;
    case "SCORES": return <PhScores m={m} />;
    case "HOLD": return <PhHold m={m} />;
    case "AWARDS": return <PhAwards m={m} />;
    default: return null;
  }
}

/**
 * JAMAA-GAP (platform session.ts): an error toast reads `t(messageKey)`, and Bluff's codes have no root `error.*` key, so
 * the toast would show the raw key. Rewrite such a toast with this game's copy (the screen also shows it inline).
 */
function useToastFix(): void {
  useEffect(() => effect(() => {
    const list = toasts.value;
    let changed = false;
    const next = list.map((x) => {
      const code = BLUFF_ERRORS.find((c) => x.text === `error.${c.toLowerCase().replace(/_([a-z])/g, (_y, ch: string) => ch.toUpperCase())}`);
      if (!code) return x;
      changed = true;
      return { ...x, text: code === "STALE_PROMPT" ? tk("error.stalePrompt") : t(errorKey(code) as MessageKey) };
    });
    if (changed) toasts.value = next;
  }), []);
}

export function screenKey(view: PlayerRoomView): string {
  const m = bluffModel(view);
  if (!m) return "none";
  return `${m.n}:${m.pub.phase}:${m.pub.promptIndex}:${m.pub.prompt?.id ?? ""}`;
}

export function onPhoneView(prevRoom: PlayerRoomView | null, nextRoom: PlayerRoomView): void {
  const next = bluffModel(nextRoom);
  if (!next) return;
  const prev = prevRoom ? bluffModel(prevRoom) : null;
  if (prev && prev.pub.phase !== next.pub.phase) {
    if (next.pub.phase === "WRITING" || next.pub.phase === "VOTING") announce(next.pub.phase === "WRITING" ? tk("write.cta") : isFinal(next.pub) ? tk("vote.titleNoTruth") : tk("vote.title"));
    if (next.pub.phase === "VOTING" && next.me && prev.me?.myLieStatus === "none" && !next.me.waitingForNext) pushToast(tk("write.timeUp"));
  }
  if (next.me?.spotOn && prev?.me && !prev.me.spotOn) { haptic(HAPTIC.win); announce(tk("write.spotOn"), true); }
  // A hidden answer took this phone's vote: "Vote again!" (GAME-BLUFF §5.4).
  if (prev?.pub.phase === "VOTING" && next.pub.phase === "VOTING" && prev.me?.myVote && next.me && next.me.myVote === null
    && !next.pub.options.some((o) => o.id === prev.me!.myVote)) {
    haptic(HAPTIC.error);
    pushToast(tk("vote.again"));
  }
  if (next.pub.phase === "VOTING" && prev?.pub.phase !== "VOTING" && next.pub.spotOnIds.length > 0) {
    announce(tk("vote.knewIt", { names: listOf(next.pub.spotOnIds.map((id) => isolate(next.byId.get(id)?.name ?? ""))) }));
  }
}

export function needsMe(view: PlayerRoomView): boolean {
  const m = bluffModel(view);
  return !!m && needsAction(m);
}

export function firstRound(view: PlayerRoomView): boolean {
  const m = bluffModel(view);
  return !m || m.pub.round <= 1;
}

export type { Seat };
