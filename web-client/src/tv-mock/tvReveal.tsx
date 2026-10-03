// TV-07 vote reveal + TV-09 elimination (one local sequence inside the 8 s ELIMINATION hold),
// TV-10 Blank guess, TV-11 results. Animations are local; OK on the pill jumps to the end state.
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { PublicPlayer, TvView } from "@mishana/shared/protocol";
import type { Role } from "@mishana/shared/engine";
import { fmtNum, locale, t } from "../i18n/t";
import { ROLE_KEY } from "../lib/roles";
import { Avatar, avatarState, COLOR_BY_ID, Glyph, colorVars } from "../components/PlayerChip";
import { RoleEmblem } from "../components/Role";
import { Icon } from "../components/Icon";
import { Confetti } from "../components/UI";
import { useDeadline } from "../components/Timer";
import { ActionPill, Stamp, TimerRing, TvTimerBar, TvTopBar, useInitialFocus } from "./tvParts";
import { byIdTv } from "./tvGame";
import { ms, reduced } from "./motion";
import { openDialog } from "./tvDialogs";
import { tvScreen, tvSend, tvCreateRoom } from "./tvStore";

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

const REACTION: Record<Role, string> = { CIVILIAN: "elim.reactionCivilian", UNDERCOVER: "elim.reactionUndercover", BLANK: "elim.reactionBlank" };

function RoleCard({ p, role, flipped, compact = false }: { p: PublicPlayer; role: Role; flipped: boolean; compact?: boolean }) {
  return (
    <div class={`rolecard${flipped ? " is-flipped" : ""}${compact ? " rolecard--compact" : ""}`} style={colorVars(p.color)}>
      <div class="rolecard__inner">
        <div class="rolecard__back"><Glyph color={p.color} /></div>
        <div class={`rolecard__face rolecard__face--${role.toLowerCase()}`}>
          <RoleEmblem role={role} size={120} />
          <span class="rolecard__label">{t(ROLE_KEY[role] as Parameters<typeof t>[0])}</span>
        </div>
      </div>
    </div>
  );
}

/** TV-07 + TV-09. */
export function TvElimination({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>();
  const lv = view.lastVote;
  const out = view.eliminated ? byIdTv(view, view.eliminated.playerId) : undefined;
  const role = view.eliminated?.role ?? null;
  const random = lv?.outcome === "RANDOM";
  const none = !view.eliminated;
  const T = useMemo(() => {
    const votesEnd = ms(3000);
    const wheel = random ? ms(2000) : 0;
    const k = random ? 0.6 : 1;
    const grow = ms(400 * k), hold = ms(600 * k), flip = ms(800 * k);
    const cardStart = votesEnd + wheel;
    return { arrows: ms(300), arrowsEnd: ms(1800), suspense: ms(1800), verdict: ms(2400), votesEnd, wheel, cardStart, flipAt: cardStart + grow + hold, flipEnd: cardStart + grow + hold + flip, reaction: cardStart + grow + hold + flip + ms(200), total: cardStart + grow + hold + flip + ms(800) };
  }, [random]);
  // Late mount (reconnect mid-phase) → end state.
  const dl = view.deadline;
  const lateStart = dl ? Math.max(0, dl.durationMs - (dl.at - Date.now())) > 1500 : true;
  const [el, setEl] = useElapsed(T.total, lateStart ? T.total : 0);
  const skip = (): void => setEl(T.total);
  const animating = el < T.total;
  const stage = el < T.votesEnd ? "votes" : el < T.cardStart ? "wheel" : "card";
  const d = useDeadline(view.deadline);

  return (
    <div class={`tvscreen tvelim${stage === "card" && role ? ` wash--${role.toLowerCase()}` : ""}`}>
      <TvTopBar view={view} title={stage === "votes" ? `${t("round.label", { count: view.round })} · ${t("vote.votesIn")}` : undefined} />
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
              <RoleCard p={out} role={role} flipped={el >= T.flipAt} />
              {random && <span class="tvbadge tvbadge--accent tvelim__random"><Icon name="dice" size={18} />{t("elim.randomPick")}</span>}
            </div>
            <h1 class="tvt-displayM tvelim__name"><bdi>{t("elim.eliminated", { name: "⁨" + out.name + "⁩" })}</bdi></h1>
            {(() => {
              const line = t((role === "BLANK" && !view.settings.blankGuess ? "elim.reactionBlankNoGuess" : REACTION[role]) as Parameters<typeof t>[0]);
              // One line between "Next round in…" (start) and Continue (end): long lines step down to tv-title.
              return <p class={`${line.length > 26 ? "tvt-title" : "tvt-headline"} tvelim__reaction${el >= T.reaction ? " is-on" : ""}`}>{line}</p>;
            })()}
          </div>
        ) : null
      )}
      <div class="tvbottom">
        {stage === "votes" && animating && <span class="tvbottom__center tvt-caption tv-muted">{t("tv.skipHint")}</span>}
        {stage === "card" && d && <span class={`${none ? "tvbottom__center" : "tvbottom__start"} tvt-body tv-secondary tnum`}>{t("elim.nextRound", { count: d.secs })}</span>}
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
              <Avatar color={p.color} size={big ? 56 : 64} state={p.id === top ? "normal" : avatarState(p)} />
              <bdi class="tile__name">{p.name}</bdi>
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
  const lv = view.lastVote!;
  const maxN = Math.max(0, ...lv.tally.map((x) => x.voterIds.length));
  const tied = lv.tally.filter((x) => x.voterIds.length === maxN).map((x) => byIdTv(view, x.targetId)).filter((p): p is PublicPlayer => !!p).sort((a, b) => a.seat - b.seat);
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

/** TV-10 Blank guess. */
export function TvGuess({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>(view.guess?.status);
  const g = view.guess;
  const p = byIdTv(view, g?.playerId);
  if (!g || !p) return <div class="tvscreen"><TvTopBar view={view} /></div>;
  const pending = g.status === "PENDING";
  const name = "⁨" + p.name + "⁩";
  return (
    <div class={`tvscreen tvguess${pending ? " is-dark" : ` is-${g.status.toLowerCase()}`}`}>
      <TvTopBar view={view} />
      {g.status === "CORRECT" && <><div class="tvflash" aria-hidden="true" /><Confetti colors={["#ECE6F5", "#FFC23D", "#FFF7EC"]} count={48} /></>}
      <div class="tvguess__spot" aria-hidden="true" />
      <div class="tvstage tvguess__stage">
        <div class={`tvguess__hero${g.status === "WRONG" ? " shake" : ""}`}>
          <TimerRing deadline={pending ? view.deadline : null} size={220} showNumber={pending}>
            <span class="tvguess__ring"><Avatar color={p.color} size={140} state={avatarState({ ...p, alive: true })} /></span>
          </TimerRing>
        </div>
        {pending ? (
          <>
            <h1 class="tvt-displayS">{t("guess.title")}</h1>
            <p class="tvt-body tv-secondary">{t("guess.guessing", { name })}</p>
            <p class="tvt-caption tv-muted">{t("guess.silence")}</p>
          </>
        ) : (
          <>
            <h1 class={`tvt-displayM tvguess__verdict tvguess__verdict--${g.status.toLowerCase()}`}>{t(g.status === "CORRECT" ? "guess.correct" : g.status === "WRONG" ? "guess.wrong" : "guess.timeout")}</h1>
            {g.overridden && <span class="tvbadge tvbadge--accent">{t("guess.overridden")}</span>}
          </>
        )}
      </div>
      <div class="tvbottom">
        {!pending && <div class="tvguess__bar"><TvTimerBar deadline={view.deadline} /></div>}
        {!pending && !g.overridden && g.status === "WRONG" && (
          <button type="button" class="tvbtn" onClick={() => openDialog({ title: t("guess.acceptConfirm", { name }), confirm: t("guess.accept"), onConfirm: () => tvSend({ type: "HOST_OVERRIDE_GUESS", accept: true }) })}>
            <Icon name="check" />{t("guess.accept")}
          </button>
        )}
        {!pending && !g.overridden && g.status === "CORRECT" && (
          <button type="button" class="tvbtn tvbtn--danger" onClick={() => openDialog({ title: t("guess.rejectConfirm"), confirm: t("guess.reject"), danger: true, onConfirm: () => tvSend({ type: "HOST_OVERRIDE_GUESS", accept: false }) })}>
            <Icon name="x" />{t("guess.reject")}
          </button>
        )}
        <ActionPill label={pending ? t("guess.skip") : t("common.continue")} pillRef={pill} key={pending ? "skip" : "continue"} />
      </div>
    </div>
  );
}

const CAUSE_ICON: Record<string, string> = { VOTE: "vote", RANDOM: "dice", KICK: "user-x", LEAVE: "door-out", NONE: "x" };

/** TV-11 Results: stage 1 (victory moment, words meet), then stage 2 (scoreboard, history, actions). */
export function TvResults({ view }: { view: TvView }) {
  const r = view.result;
  const [stage2, setStage2] = useState(false);
  const playRef = useInitialFocus<HTMLButtonElement>(stage2);
  useEffect(() => {
    const id = setTimeout(() => setStage2(true), ms(5000));
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Enter" && !stage2) { e.preventDefault(); setStage2(true); } };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, []);
  if (!r) return null;
  const winnerName = r.winner === "BLANK" ? byIdTv(view, r.winnerIds[0])?.name ?? "" : "";
  const teamKey = r.winner === "CIVILIANS" ? "winner.civilians" : r.winner === "INFILTRATORS" ? "winner.infiltrators" : "winner.blank";
  const ranked = [...view.players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const blankGuess = r.winner === "BLANK" ? r.guesses.find((g) => g.status === "CORRECT")?.text ?? null : null;
  const l = locale.value;
  return (
    <div class={`tvscreen tvresults tvresults--${r.winner.toLowerCase()}${stage2 ? " is-stage2" : ""}`} onClick={() => setStage2(true)}>
      <TvTopBar view={view} title={t("results.title")} />
      <div class="tvresults__wash" aria-hidden="true">
        {!reduced() && r.winner === "CIVILIANS" && Array.from({ length: 12 }, (_, i) => <span key={i} class="particle" style={{ "--i": i }}><RoleEmblem role="CIVILIAN" size={28} /></span>)}
        {!reduced() && r.winner === "INFILTRATORS" && [0, 1, 2, 3].map((i) => <span key={i} class={`peek-mask peek-mask--${i}`}><RoleEmblem role="UNDERCOVER" size={96} /></span>)}
      </div>
      <div class="tvstage tvresults__stage">
        <h1 class={`tvresults__title ${stage2 ? "tvt-headline" : "tvt-displayL"}`}>{t(teamKey, { name: "⁨" + winnerName + "⁩" })}</h1>
        {!stage2 && r.winner === "BLANK" && blankGuess && (
          <div class="tvblankcard"><RoleEmblem role="BLANK" size={64} /><span class="tvt-displayS">{blankGuess}</span></div>
        )}
        <div class={`tvwords${stage2 ? " tvwords--strip" : ""}`}>
          <div class="tvword tvword--civilian">
            <span class="tvword__label">{t("results.civilianWord")}</span>
            <span class="tvword__text" lang={view.settings.wordLocale}>{r.civilianWord.text}</span>
            {r.civilianWord.translit && <span class="tvword__translit">{r.civilianWord.translit}</span>}
          </div>
          <div class="tvword tvword--undercover">
            <span class="tvword__label">{t("results.undercoverWord")}</span>
            <span class="tvword__text" lang={view.settings.wordLocale}>{r.undercoverWord.text}</span>
            {r.undercoverWord.translit && <span class="tvword__translit">{r.undercoverWord.translit}</span>}
          </div>
        </div>
        {stage2 && (
          <>
            <p class="tvt-caption tv-secondary tvresults__meta">
              {t("results.pack", { title: r.pack.title[l] })}
              {r.guesses.map((g, i) => {
                const gp = byIdTv(view, g.playerId);
                return gp && g.text !== null ? <Fragment key={i}>{"  ·  "}{t("guess.guessed", { name: "⁨" + gp.name + "⁩", text: "⁨" + g.text + "⁩" })}</Fragment> : null;
              })}
            </p>
            <div class="tvsb" role="table" aria-label={t("results.scoreboard")}>
              <div class="tvsb__row tvsb__row--head" role="row">
                <span>{t("results.colRank")}</span><span>{t("results.colPlayer")}</span><span>{t("results.colRole")}</span><span>{t("results.colGame")}</span><span>{t("results.colTotal")}</span>
              </div>
              <div class="tvsb__body" tabIndex={0}>
                {ranked.map((p, i) => {
                  const pts = r.pointsAwarded[p.id] ?? 0;
                  return (
                    <div key={p.id} role="row" class={`tvsb__row${i === 0 ? " is-first" : ""}`} style={{ "--i": i }}>
                      <span class="tvsb__rank">{i === 0 ? <Icon name="trophy" size={22} /> : <bdi class="num">{fmtNum(i + 1)}</bdi>}</span>
                      <span class="tvsb__who"><Avatar color={p.color} size={32} state={p.left ? "left" : "normal"} /><bdi>{p.name}</bdi></span>
                      <span class="tvsb__role">{p.revealedRole && <><span class={`tvsb__emb tvsb__emb--${p.revealedRole.toLowerCase()}`}><RoleEmblem role={p.revealedRole} size={18} /></span>{t(ROLE_KEY[p.revealedRole] as Parameters<typeof t>[0])}</>}</span>
                      <span class={`tvsb__pts${pts > 0 ? " tv-success" : " tv-muted"}`}><bdi class="num">{pts > 0 ? t("results.pointsEarned", { count: pts }) : fmtNum(0)}</bdi></span>
                      <span class="tv-accent tvsb__total"><bdi class="num">{fmtNum(p.score)}</bdi></span>
                    </div>
                  );
                })}
              </div>
            </div>
            <ol class="tvhistory" aria-label={t("history.title")}>
              {view.history.map((h, i) => {
                const hp = byIdTv(view, h.eliminatedId);
                return (
                  <li key={i} class="tvhistory__item">
                    <span class="tvt-caption tv-muted">R{fmtNum(h.round)}</span>
                    {hp ? <Avatar color={hp.color} size={28} state="out" /> : null}
                    {h.role && <RoleEmblem role={h.role} size={20} />}
                    <Icon name={CAUSE_ICON[h.cause] ?? "x"} size={18} />
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      {stage2 && (
        <div class="tvbottom tvbottom--results">
          <button type="button" ref={playRef} class="tvbtn tvbtn--primary" onClick={() => tvSend({ type: "PLAY_AGAIN" })}><Icon name="refresh" />{t("results.playAgain")}</button>
          <button type="button" class="tvbtn" onClick={() => { tvSend({ type: "PLAY_AGAIN" }); tvScreen.value = "settings"; }}><Icon name="settings" />{t("results.changeSettings")}</button>
          <button type="button" class="tvbtn" onClick={() => openDialog({ title: t("results.newRoomConfirm"), confirm: t("results.newRoom"), onConfirm: () => void tvCreateRoom() })}><Icon name="plus" />{t("results.newRoom")}</button>
        </div>
      )}
    </div>
  );
}
