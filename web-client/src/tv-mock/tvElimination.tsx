// TV-07 vote reveal + TV-09 elimination: one local sequence inside the 8 s ELIMINATION hold. The animations are
// local; OK on the pill jumps to the end state.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import type { Role } from "@mishana/shared/engine";
import { fmtNum, isolate, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { ROLE_KEY } from "../lib/keys";
import { ms, reduced } from "../lib/motion";
import { afterElimination, byId, topVoted, TV_VOTE_REVEAL_MS } from "../lib/view";
import { Avatar, avatarState, COLOR_BY_ID, Glyph, colorVars } from "../components/PlayerChip";
import { RoleEmblem } from "../components/Role";
import { Icon } from "../components/Icon";
import { useDeadline } from "../components/Timer";
import { ActionPill, Stamp, TimerChip, TvTopBar, VOTE_NAME_MAX } from "./tvParts";
import { ellipsizeName } from "../lib/names";
import { useInitialFocus } from "./dpad";
import { chipRate, ROLE_STING } from "./sound/cues";
import type { TimelineMark } from "./sound/cues";
import { useTimelineSounds } from "./sound/controller";

/** Elapsed ms since mount (rAF), frozen once `until` is reached. */
function useElapsed(until: number, startAt = 0): [number, (v: number) => void] {
  const [el, setEl] = useState(startAt);
  const t0 = useRef(performance.now() - startAt);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      const e = performance.now() - t0.current;
      setEl(Math.min(e, until));
      if (e < until) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [until]);
  return [el, (v: number) => { t0.current = performance.now() - v; setEl(v); }];
}

const REACTION: Record<Role, MessageKey> = { CIVILIAN: "elim.reactionCivilian", UNDERCOVER: "elim.reactionUndercover", BLANK: "elim.reactionBlank" };

/**
 * TV-09 card size from the stage (Kotlin): stage − the name line (displayS) − the reaction line (headline) − gaps,
 * clamped to 150–250 dp, at DESIGN's 192:250 ratio.
 */
export function cardSize(rtl: boolean): { w: number; h: number } {
  const STAGE = 360;
  const h = Math.max(150, Math.min(250, STAGE - (rtl ? 64 : 52) - (rtl ? 52 : 42) - 24));
  return { w: Math.round((h * 192) / 250), h };
}

function RoleCard({ p, role, flipped, size }: { p: TvView["players"][number]; role: Role; flipped: boolean; size: { w: number; h: number } }) {
  const label = t(ROLE_KEY[role]);
  return (
    <div class={`rolecard${flipped ? " is-flipped" : ""}`} style={{ ...colorVars(p.color), width: `${size.w}px`, height: `${size.h}px` }}>
      <div class="rolecard__inner">
        <div class="rolecard__back"><Glyph color={p.color} /></div>
        <div class={`rolecard__face rolecard__face--${role.toLowerCase()}`}>
          <RoleEmblem role={role} size={Math.round(size.h * 0.38)} />
          {/* The label always fits the card: the font steps down with its length (container query units). */}
          <span class="rolecard__label" style={{ "--chars": [...label].length }}>{label}</span>
        </div>
      </div>
    </div>
  );
}

/** TV-07 + TV-09. */
export function TvElimination({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const lv = view.lastVote;
  const out = byId(view, view.eliminated?.playerId);
  const role = view.eliminated?.role ?? null;
  const random = lv?.outcome === "RANDOM";
  const none = !view.eliminated;
  const T = useMemo(() => {
    const votesEnd = ms(TV_VOTE_REVEAL_MS);
    const wheel = random ? ms(2000) : 0;
    const k = random ? 0.6 : 1;
    const grow = ms(400 * k), hold = ms(600 * k), flip = ms(800 * k);
    const cardStart = votesEnd + wheel;
    return { arrows: ms(300), arrowsEnd: ms(1800), suspense: ms(1800), verdict: ms(2400), votesEnd, wheel, cardStart, holdAt: cardStart + grow, flipAt: cardStart + grow + hold, flipEnd: cardStart + grow + hold + flip, reaction: cardStart + grow + hold + flip + ms(200), total: cardStart + grow + hold + flip + ms(800) };
  }, [random]);
  // Late mount (reconnect mid-phase) → end state.
  const dl = view.deadline;
  const lateStart = dl ? Math.max(0, dl.durationMs - (dl.at - Date.now())) > 1500 : true;
  const [el, setEl] = useElapsed(T.total, lateStart ? T.total : 0);
  const skip = (): void => setEl(T.total);
  // DESIGN §6.4: drumroll from the lock, the verdict stamp, the wheel's ratchet, a heartbeat on the hold, the card
  // swish, then the role's sting as the face lands. The chips' marimba ticks play from the VoteBoard.
  const marks = useMemo(() => {
    const m: TimelineMark[] = [];
    if (lv) m.push({ at: 0, cue: "sfx.drumroll" }, { at: T.verdict, cue: "sfx.stamp" });
    if (lv && random) m.push({ at: T.votesEnd, cue: "sfx.wheel" });
    if (view.eliminated) {
      m.push({ at: T.holdAt, cue: "sfx.heartbeat" }, { at: T.flipAt, cue: "sfx.flip" }, { at: T.flipEnd, cue: ROLE_STING[view.eliminated.role] });
    }
    return m;
  }, [T, lv, view.eliminated?.playerId]);
  useTimelineSounds(marks, el, lateStart ? T.total : 0, T.total);
  const animating = el < T.total;
  const stage = el < T.votesEnd ? "votes" : el < T.cardStart ? "wheel" : "card";
  const d = useDeadline(view.deadline);
  const flipped = el >= T.flipAt;
  const rtl = document.documentElement.dir === "rtl";
  // What comes next (Kotlin afterElimination): "Next round in…" only when a round really follows.
  const next = afterElimination(view);

  return (
    <div class={`tvscreen tvelim${stage === "card" && role ? ` wash--${role.toLowerCase()}` : ""}`}>
      {/* Until the card flips, the bar keeps "Votes are in" and still counts the voted-out player as alive. */}
      <TvTopBar view={view} stillAlive={flipped ? null : out?.id ?? null}
        title={flipped ? undefined : `${t("round.label", { count: view.round })} · ${t("vote.votesIn")}`} />
      {stage === "votes" && lv && <VoteBoard view={view} el={el} T={T} />}
      {stage === "wheel" && lv && <Wheel view={view} el={el - T.votesEnd} dur={T.wheel} />}
      {stage === "card" && (
        none ? (
          <div class="tvstage tvelim__none">
            <Stamp text={t(lv && lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination")} tone="muted" />
          </div>
        ) : out && role ? (
          // §6.2-C: the card, the name beneath it ("Rami is out!"), then the one-line reaction.
          <div class="tvstage tvelim__card">
            <div class={`tvelim__cardwrap${el - T.cardStart < ms(400) ? " is-growing" : ""}`}>
              <RoleCard p={out} role={role} flipped={flipped} size={cardSize(rtl)} />
              {random && <span class="tvbadge tvbadge--accent tvelim__random"><Icon name="dice" size={18} />{t("elim.randomPick")}</span>}
            </div>
            <h1 class="tvt-displayS tvelim__name">{t("elim.eliminated", { name: isolate(out.name) })}</h1>
            {(() => {
              const line = t(role === "BLANK" && !view.settings.blankGuess ? "elim.reactionBlankNoGuess" : REACTION[role]);
              // One line inside the stage, above the bottom bar: long lines step down to tv-title.
              return <p class={`${line.length > 30 ? "tvt-title" : "tvt-headline"} tvelim__reaction${el >= T.reaction ? " is-on" : ""}`}>{line}</p>;
            })()}
          </div>
        ) : null
      )}
      <div class="tvbottom">
        {stage === "votes" && animating && <span class="tvbottom__center tvt-caption tv-muted">{t("tv.skipHint")}</span>}
        {stage === "card" && (next === "NEXT_ROUND"
          ? d && <span class={`${none ? "tvbottom__center" : "tvbottom__start"} tvt-body tv-secondary tnum`}>{t("elim.nextRound", { count: d.secs })}</span>
          : <>
            {next === "LAST_CHANCE" && <span class="tvbottom__start tvt-body tv-blank">{t("elim.lastChance")}</span>}
            <TimerChip deadline={view.deadline} />
          </>)}
        <ActionPill label={t("common.continue")} pillRef={pill} animating={animating} onSkipAnimation={skip} />
      </div>
    </div>
  );
}

interface Timeline { arrows: number; arrowsEnd: number; suspense: number; verdict: number; votesEnd: number }

/** TV-07: chips fly voter → target on quadratic Béziers; tallies roll; suspense dims; the stamp lands. */
function VoteBoard({ view, el, T }: { view: TvView; el: number; T: Timeline }) {
  const lv = view.lastVote!;
  const ids = new Set<string>([...lv.abstainIds, ...lv.tally.flatMap((x) => [x.targetId, ...x.voterIds])]);
  const shown = view.players.filter((p) => ids.has(p.id));
  const big = shown.length > 8;
  const board = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Record<string, { x: number; y: number; w: number; h: number }> | null>(null);
  useLayoutEffect(() => {
    const root = board.current;
    if (!root) return;
    const rr = root.getBoundingClientRect();
    const scale = rr.width / root.offsetWidth || 1;
    const g: Record<string, { x: number; y: number; w: number; h: number }> = {};
    root.querySelectorAll<HTMLElement>("[data-pid]").forEach((n) => {
      const r = n.getBoundingClientRect();
      g[n.dataset.pid!] = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
    });
    const bin = root.querySelector<HTMLElement>(".novote");
    if (bin) {
      const r = bin.getBoundingClientRect();
      g.__bin = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
    }
    setGeo(g);
  }, []);
  // Flights in voter seat order: each voter → their target (or the "No vote" bin).
  const flights = useMemo(() => {
    const target = new Map<string, string>();
    for (const x of lv.tally) for (const v of x.voterIds) target.set(v, x.targetId);
    for (const a of lv.abstainIds) target.set(a, "__bin");
    const voters = view.players.filter((p) => target.has(p.id));
    const per = voters.length ? (T.arrowsEnd - T.arrows) / voters.length : 0;
    const stack = new Map<string, number>();
    return voters.map((p, i) => {
      const to = target.get(p.id)!;
      const k = stack.get(to) ?? 0;
      stack.set(to, k + 1);
      return { p, to, k, delay: T.arrows + i * per, dur: Math.max(ms(420), per * 1.6) };
    });
  }, [lv]);
  const top = lv.eliminatedId ?? null;
  const maxN = Math.max(0, ...lv.tally.map((x) => x.voterIds.length));
  const topIds = new Set(lv.outcome === "ELIMINATED" || lv.outcome === "RANDOM" ? lv.tally.filter((x) => x.voterIds.length === maxN).map((x) => x.targetId) : []);
  // One marimba tick per landing chip, rising with the target's tally (reduced motion: they land at once, one tick).
  const chipMarks = useMemo<TimelineMark[]>(() => {
    const m = flights.map((f) => ({ at: f.delay + (reduced() ? 0 : f.dur), cue: "sfx.chipLand" as const, rate: chipRate(f.k + 1) }));
    return reduced() ? m.slice(0, 1) : m;
  }, [flights]);
  useTimelineSounds(chipMarks, el, 0, T.votesEnd);
  const landed = (f: { delay: number; dur: number }): boolean => el >= f.delay + (reduced() ? 0 : f.dur);
  const count = (id: string): number => flights.filter((f) => f.to === id && landed(f)).length;
  const suspense = el >= T.suspense;
  const verdict = el >= T.verdict;
  return (
    <div class="tvstage tvvoteboard" ref={board}>
      <div class={`tvvgrid${big ? " tvvgrid--12" : ""}${suspense ? " is-suspense" : ""}`}>
        {shown.map((p) => {
          const n = count(p.id);
          const isTop = lv.outcome === "RANDOM" ? topIds.has(p.id) : p.id === top;
          return (
            <div key={p.id} data-pid={p.id} class={`tile tile--vote${big ? " tile--vote-s" : ""}${isTop ? " is-top" : ""}${verdict && isTop ? " is-verdict" : ""}`}>
              <Avatar color={p.color} size={big ? 48 : 64} state={p.id === top ? "normal" : avatarState(p)} />
              <bdi class="tile__name">{ellipsizeName(p.name, VOTE_NAME_MAX)}</bdi>
              {n > 0 && <span class="tvtally num" key={n}>{fmtNum(n)}</span>}
              {verdict && isTop && lv.outcome === "ELIMINATED" && <span class="tile__stamp"><Stamp text={t("stamp.out")} /></span>}
            </div>
          );
        })}
      </div>
      {lv.abstainIds.length > 0 && (
        <div class="novote" aria-label={t("vote.noVote")}>
          <span class="tvt-caption">{t("vote.noVote")}</span>
          <span class="num tv-muted">{fmtNum(flights.filter((f) => f.to === "__bin" && landed(f)).length)}</span>
        </div>
      )}
      {geo && (
        <svg class="flights" aria-hidden="true">
          {flights.map((f) => {
            const a = geo[f.p.id];
            const b = geo[f.to];
            if (!a || !b) return null;
            const x0 = a.x + a.w / 2, y0 = a.y + a.h / 2;
            const x1 = b.x + b.w / 2 + (f.k % 2 ? 1 : -1) * Math.ceil(f.k / 2) * 10, y1 = b.y - 6 - f.k * 4;
            const below = a.y > 200 && b.y > 200;
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + (below ? 90 : -90);
            const p = Math.min(1, Math.max(0, (el - f.delay) / f.dur));
            if (el < f.delay) return null;
            const e = reduced() ? 1 : 1 - Math.pow(1 - p, 2.2);
            const qx = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
            const qy = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
            const fade = reduced() ? 0 : Math.max(0, 1 - (el - f.delay - f.dur) / ms(600));
            const len = 600;
            return (
              <g key={f.p.id}>
                {!reduced() && fade > 0 && (
                  <path d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`} fill="none" stroke={COLOR_BY_ID[f.p.color].hex} stroke-width={3} stroke-linecap="round"
                    stroke-dasharray={len} stroke-dashoffset={len * (1 - e)} opacity={0.85 * Math.min(1, fade)} pathLength={len} />
                )}
                <foreignObject x={qx - 16} y={qy - 16} width={32} height={32} class={reduced() ? "chip-fade" : undefined}>
                  <Avatar color={f.p.color} size={32} />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      )}
      {verdict && lv.outcome === "NO_ELIMINATION" && <div class="tvcenterstamp"><Stamp text={t(lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination")} tone="muted" /></div>}
      {verdict && lv.outcome === "RANDOM" && <div class="tvcenterstamp"><Stamp text={t("stamp.tie")} tone="accent" /></div>}
    </div>
  );
}

/** TV-09 random-pick variant: a highlight runs around the tied avatars, decelerating, landing on the server's pick. */
function Wheel({ view, el, dur }: { view: TvView; el: number; dur: number }) {
  const tied = topVoted(view);
  const target = Math.max(0, tied.findIndex((p) => p.id === view.eliminated?.playerId));
  const n = Math.max(1, tied.length);
  const steps = n * 3 + target; // three laps, then land
  const p = Math.min(1, el / Math.max(1, dur));
  const idx = Math.floor((1 - Math.pow(1 - p, 3)) * steps) % n;
  return (
    <div class="tvstage tvwheel">
      <p class="tvt-headline tv-accent"><Icon name="dice" size={28} />{t("elim.randomPick")}</p>
      <div class="tvwheel__ring">
        {tied.map((pl, i) => {
          const a = (i / n) * 2 * Math.PI - Math.PI / 2; // clockwise from 12 o'clock everywhere
          return (
            <span key={pl.id} class={`tvwheel__seat${i === idx ? " is-lit" : ""}`} style={{ left: `${150 + Math.cos(a) * 150 - 48}px`, top: `${150 + Math.sin(a) * 150 - 48}px` }} dir="ltr">
              <Avatar color={pl.color} size={96} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
