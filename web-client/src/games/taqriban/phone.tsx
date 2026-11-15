// GAME-TAQRIBAN §8.4 phone screens (TQ-PH-01..05), lazy-loaded as the `game-taqriban` chunk. The platform shell adds
// the top bar, ⓘ, coach marks, the world flood, the benched view and the results cup + VIP buttons.
// The keypad is our own (never the OS keyboard), so the "Lock it in" button is always on screen. Numbers are LTR in
// every locale (§8.2); this phone shows the public projection plus its own guess only.
import "./phone.css";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { MAGNITUDES } from "@jamaa/shared/games/taqriban/meta";
import { fmtNum, isolate } from "../../i18n/t";
import { act } from "../../state/session";
import { announce } from "../../state/store";
import { HAPTIC, haptic } from "../../lib/haptics";
import { Character } from "../../components/Character";
import { Confetti } from "../../components/UI";
import { TimerBar, useDeadlineSelect } from "../../components/Timer";
import { EMPTY, entryState, groupDigits, playersOf, press, shortNum, taqOfPhone, tk, valueOf, withMag, withUnit } from "./model";
import type { Entry, Player, Taq, TaqPub } from "./model";

// The TV chunk reaches this game's view model through this chunk (fewer game-shared chunks, fewer preload entries).
export { groupDigits, layoutLine, playersOf, ranked, shortNum, taqOfTv, tk, withUnit } from "./model";

const deadlineOf = (pub: TaqPub) => (pub.deadline === null || pub.durationMs === null ? null : { kind: "VOTE" as const, at: pub.deadline, durationMs: pub.durationMs });

function Eyebrow({ pub, timer = true }: { pub: TaqPub; timer?: boolean }) {
  return (
    <div class="eyebrow-row tqb-eyebrow">
      <p class="eyebrow"><span class="tnum">{tk("show.question", { n: fmtNum(pub.index + 1), total: fmtNum(pub.total) })}</span>{pub.isFinal && <b class="tqb-x2">×2</b>}</p>
      {timer && <TimerBar deadline={deadlineOf(pub)} class="timerbar--inline" />}
    </div>
  );
}

/** The big number, LTR, with its words ("8 billion") under it. */
function Big({ v, unit, cls = "" }: { v: number; unit: string; cls?: string }) {
  const words = shortNum(v);
  const digits = groupDigits(v);
  return (
    <div class={`tqb-big ${cls}`}>
      <b class="num" dir="ltr">{digits}</b>
      {(words !== digits || unit) && <span class="tqb-big__words" dir="auto">{withUnit(words !== digits ? isolate(words) : "", unit).trim()}</span>}
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

/** QUESTION (TQ-PH-01): question, display, magnitude chips, keypad, and the always-visible Lock it in. */
function Pad({ tq }: { tq: Taq }) {
  const pub = tq.pub;
  const q = pub.question;
  const [e, setRaw] = useState<Entry>(EMPTY);
  // The latest entry, synchronously: a hardware keyboard can type "3", "0", Enter before the next render.
  const cur = useRef<Entry>(EMPTY);
  cur.current = e;
  const setE = (n: Entry): void => { cur.current = n; setRaw(n); };
  const [nudge, setNudge] = useState(0);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);   // a long press on ⌫ cleared everything: its click is swallowed
  const timeUp = useDeadlineSelect(deadlineOf(pub), (c) => c.ms <= 0, false);
  const st = entryState(e);
  const v = valueOf(e);
  const key = (k: string): void => {
    const n = press(cur.current, k);
    if (n === cur.current) { setNudge((x) => x + 1); return; }
    setE(n);
    haptic(HAPTIC.tick);
  };
  const send = (): void => {
    const v = valueOf(cur.current);
    if (!q || entryState(cur.current) !== "ok" || v === null || timeUp) { setNudge((x) => x + 1); return; }
    if (!act({ type: "GAME", gameId: "taqriban", i: { type: "GUESS", questionId: q.id, value: v } })) { setNudge((x) => x + 1); return; }
    haptic(HAPTIC.voteLocked);
    announce(tk("phone.locked"), true);
  };
  // A hardware keyboard (tablet, desktop) types too.
  useEffect(() => {
    const on = (ev: KeyboardEvent): void => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key === "," ? "." : ev.key === "Backspace" ? "del" : ev.key === "Escape" ? "clr" : ev.key;
      if (k === "Enter") { ev.preventDefault(); send(); return; }
      if (/^[\d.]$/.test(k) || k === "del" || k === "clr") { ev.preventDefault(); setE(press(cur.current, k)); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  const unit = q?.unit ?? "";
  return (
    <main class="tqb-pad" data-final={pub.isFinal || undefined}>
      <Eyebrow pub={pub} />
      <h1 class={`tqb-q${(q?.text.length ?? 0) > 90 ? " is-long" : ""}`} dir="auto" tabIndex={-1}>{q?.text ?? ""}</h1>
      <div key={`n${nudge}`} class={`tqb-display${nudge ? " is-nudged" : ""}${st === "tooBig" ? " is-bad" : ""}`} aria-live="polite">
        <p class="tqb-display__n num" dir="ltr">
          {e.digits ? <span>{e.digits.replace(/^(\d+)/, (m) => groupDigits(Number(m)))}</span> : <span class="tqb-ph">0</span>}
          {e.mag && <em>{tk(`mag.${e.mag}`)}</em>}
          {unit && <small dir="auto">{unit}</small>}
        </p>
        <p class="tqb-display__pre" dir="auto">
          {st === "tooBig" ? tk("phone.tooBig") : v === null ? tk("phone.typeNumber") : e.mag || v >= 10_000 ? <span class="num" dir="ltr">= {groupDigits(v)}</span> : " "}
        </p>
      </div>
      <div class="tqb-mags" role="group" aria-label={tk("phone.yourGuess")}>
        {MAGNITUDES.map((m) => (
          <button key={m.id} type="button" class={`tqb-mag${e.mag === m.id ? " is-on" : ""}`} aria-pressed={e.mag === m.id}
            onClick={() => { setE(withMag(e, m.id)); haptic(HAPTIC.tick); }}>
            <span dir="auto">{tk(`mag.${m.id}`)}</span>
          </button>
        ))}
      </div>
      <div class="tqb-keys" dir="ltr">
        {KEYS.map((k) => (
          <button key={k} type="button" class={`tqb-key${k === "del" ? " tqb-key--del" : ""}`}
            aria-label={k === "del" ? tk("phone.delete") : k}
            onPointerDown={k === "del" ? () => { held.current = false; hold.current = setTimeout(() => { held.current = true; setE(EMPTY); haptic(HAPTIC.guessSent); }, 550); } : undefined}
            onPointerUp={k === "del" ? () => { if (hold.current) clearTimeout(hold.current); } : undefined}
            onClick={() => { if (k === "del" && held.current) { held.current = false; return; } key(k); }}>
            {k === "del" ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z M12 9.5l5 5 M17 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" /></svg> : k}
          </button>
        ))}
      </div>
      <button type="button" class="btn btn--primary tqb-send" disabled={st !== "ok" || timeUp} onClick={send}>
        {timeUp ? tk("phone.timeUp") : tk("phone.send")}
      </button>
    </main>
  );
}

/** QUESTION after locking (TQ-PH-02): your number, and who is still typing. */
function Locked({ tq, guess, me, total, done }: { tq: Taq; guess: number; me: Player | null; total: number; done: number }) {
  return (
    <main class="screen tqb-locked">
      <Eyebrow pub={tq.pub} />
      <div class="tqb-locked__hero">
        {me && <Character color={me.color} size={88} expression="happy" />}
        <h1 class="h1" tabIndex={-1}><span class="tqb-check" aria-hidden="true">✓</span>{tk("phone.locked")}</h1>
      </div>
      <p class="eyebrow tqb-center">{tk("phone.yourGuess")}</p>
      <Big v={guess} unit={tq.pub.question?.unit ?? ""} cls="tqb-big--locked" />
      <p class="sub tqb-center"><span>{tk("phone.waitOthers")}</span> <b class="num tnum" dir="ltr">{fmtNum(done)}/{fmtNum(total)}</b></p>
      <div class="tqb-dots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} class={i < done ? "is-on" : ""} />)}</div>
    </main>
  );
}

function Watch({ title, sub, pub }: { title: string; sub?: string; pub?: TaqPub }) {
  return (
    <main class="screen tqb-watch">
      {pub && <Eyebrow pub={pub} timer={false} />}
      <span class="tqb-tv" aria-hidden="true"><i /></span>
      <h1 class="h1" tabIndex={-1}>{title}</h1>
      {sub && <p class="sub">{sub}</p>}
    </main>
  );
}

/** REVEAL (TQ-PH-03): the answer, what you said, Closest / Bullseye / rank, points. */
function Result({ tq, me }: { tq: Taq; me: Player | null }) {
  const pub = tq.pub;
  const r = pub.reveal!;
  const unit = pub.question?.unit ?? "";
  const mine = me ? r.guesses.find((g) => g.id === me.id) : undefined;
  const won = mine?.closest ?? false;
  return (
    <main class={`screen tqb-result${won ? " is-won" : ""}`}>
      {won && <Confetti colors={["#FFB547", "#FFE7B0", "#FF6B5B", "#FFF7EC"]} count={24} />}
      <Eyebrow pub={pub} timer={false} />
      <p class="eyebrow tqb-center">{tk("phone.answerWas")}</p>
      <Big v={r.answer} unit={unit} cls="tqb-big--answer" />
      <div class="tqb-mine">
        {me && <Character color={me.color} size={72} expression={won ? "cheer" : mine ? (mine.rank <= 2 ? "happy" : "shock") : "sad"} />}
        <div>
          {mine ? (
            <>
              <p class="tqb-mine__said"><span>{tk("phone.youSaid")}</span> <b class="num" dir="ltr">{groupDigits(mine.value)}</b></p>
              <p class="tqb-mine__verdict">
                {mine.closest ? <b class="tqb-stamp">{tk("phone.youClosest")}</b> : <span class="tnum">{tk("phone.youRank", { rank: fmtNum(mine.rank) })}</span>}
                {mine.bullseye && <b class="tqb-stamp tqb-stamp--bull">{tk("phone.youBullseye")}</b>}
              </p>
            </>
          ) : <p class="tqb-mine__said">{tk("phone.timeUp")}</p>}
        </div>
      </div>
      {mine && mine.points > 0 && <p class="tqb-pts num" dir="ltr">+{fmtNum(mine.points)}</p>}
      {me && <p class="sub tqb-center tnum">{tk("phone.yourScore")}: <b class="num" dir="ltr">{fmtNum(me.row.score)}</b></p>}
    </main>
  );
}

function Standing({ me, title }: { me: Player; title: string }) {
  const r = me.row;
  const climb = r.rankBefore !== null && r.rank !== null ? r.rankBefore - r.rank : 0;
  return (
    <main class={`screen tqb-standing${r.rank === 1 ? " is-win" : ""}`}>
      {title === "results" && r.rank === 1 && <Confetti />}
      <p class="eyebrow tqb-center">{tk(title === "results" ? "show.results.title" : "show.standings")}</p>
      <div class="tqb-standing__hero">
        <Character color={me.color} size={112} expression={r.rank === 1 ? "cheer" : climb > 0 ? "happy" : "idle"} crown={r.rank === 1 && r.score > 0} />
        <p class="tqb-place num" dir="ltr">#{fmtNum(r.rank ?? 0)}</p>
      </div>
      <p class="tqb-pts num" dir="ltr">{fmtNum(r.score)}</p>
      <p class="sub tqb-center tnum">{tk("show.won", { n: fmtNum(r.closest) })}{r.bullseyes > 0 ? ` · ${tk("show.bullseye")} ×${fmtNum(r.bullseyes)}` : ""}</p>
    </main>
  );
}

export function Phone({ view }: { view: PlayerRoomView }) {
  const tq = taqOfPhone(view);
  if (!tq) return null;
  const pub = tq.pub;
  const myId = view.me?.id ?? null;
  const ps = playersOf(view.room, pub);
  const me = ps.find((p) => p.id === myId) ?? null;
  if (tq.me?.waitingForNext) return <Watch title={tk("phone.waitingNext")} sub={tk("phone.watchTv")} />;
  switch (pub.phase) {
    case "QUESTION": {
      if (!me) return <Watch title={tk("phone.watchTv")} pub={pub} />;
      const g = tq.me?.myGuess ?? null;
      if (g !== null || pub.answeredIds.includes(me.id)) {
        const playing = ps.filter((p) => !p.row.left && !pub.waitingIds.includes(p.id));
        return <Locked tq={tq} guess={g ?? 0} me={me} total={playing.length} done={pub.answeredIds.length} />;
      }
      return <Pad key={pub.question?.id} tq={tq} />;
    }
    case "REVEAL": return pub.reveal ? <Result tq={tq} me={me} /> : null;
    case "LEADERBOARD": return me ? <Standing me={me} title="board" /> : <Watch title={tk("phone.watchTv")} />;
    case "FINAL_INTRO": return <Watch title={tk("show.finalIntro.title")} sub={tk("show.finalIntro.body")} />;
    case "HOLD": return <Watch title={tk("show.hold")} sub={tk("phone.hold")} />;
    case "RESULTS": return me ? <Standing me={me} title="results" /> : null;
    default: return null;
  }
}

export function screenKey(view: PlayerRoomView): string {
  const tq = taqOfPhone(view);
  return tq ? `${tq.n}:${tq.pub.phase}:${tq.pub.index}:${tq.pub.question?.id ?? ""}` : "none";
}

/** One-shot effects: a buzz when a question opens, and the verdict buzz only with the public REVEAL (no tells). */
export function onPhoneView(prev: PlayerRoomView | null, next: PlayerRoomView): void {
  const n = taqOfPhone(next);
  if (!n) return;
  const p = prev ? taqOfPhone(prev) : null;
  if (p && p.pub.phase === n.pub.phase && p.pub.index === n.pub.index) return;
  const myId = next.me?.id ?? null;
  if (n.pub.phase === "QUESTION" && !n.me?.waitingForNext && n.me?.myGuess === null) haptic(HAPTIC.nextUp);
  if (n.pub.phase === "REVEAL" && n.pub.reveal && myId) {
    if (n.pub.reveal.closestIds.includes(myId)) { haptic([20, 40, 20]); announce(tk("phone.youClosest"), true); }
  }
  if (n.pub.phase === "RESULTS" && myId && n.pub.scores.find((s) => s.playerId === myId)?.rank === 1) haptic(HAPTIC.win);
}

/** The ⓘ sheet's "Your turn!" banner: this phone owes a guess. */
export function needsMe(view: PlayerRoomView): boolean {
  const tq = taqOfPhone(view);
  const myId = view.me?.id;
  return !!tq && !!myId && tq.pub.phase === "QUESTION" && !tq.me?.waitingForNext && tq.me?.myGuess === null && !tq.pub.answeredIds.includes(myId);
}

/** Coach marks: the first question only. */
export function firstRound(view: PlayerRoomView): boolean {
  const tq = taqOfPhone(view);
  return !tq || tq.pub.index === 0;
}
