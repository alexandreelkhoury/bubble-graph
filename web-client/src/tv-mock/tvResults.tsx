// TV-10 Blank guess and TV-11 results (stage 1: the victory moment and the words meeting; stage 2: scoreboard,
// history and the next-game actions).
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { fmtNum, isolate, locale, t } from "../i18n/t";
import { ROLE_KEY, ROLE_WAS_KEY } from "../lib/keys";
import { ms, reduced } from "../lib/motion";
import { byId, competitionRank, culprits, rankPlayers, winnerMessage } from "../lib/view";
import { Avatar, avatarState } from "../components/PlayerChip";
import { RoleEmblem } from "../components/Role";
import { Icon } from "../components/Icon";
import { Confetti, PALETTE } from "../components/UI";
import { TimerRing, TvTimerBar, TvTopBar, ActionPill } from "./tvParts";
import { openDialog } from "./tvDialogs";
import { tvAct, tvCreateRoom, tvScreen } from "./tvStore";
import { useInitialFocus } from "./dpad";

/** TV-10 Blank guess. */
export function TvGuess({ view }: { view: TvView }) {
  const pill = useInitialFocus<HTMLButtonElement>(view.guess?.status);
  const g = view.guess;
  const p = byId(view, g?.playerId);
  if (!g || !p) return <div class="tvscreen"><TvTopBar view={view} /></div>;
  const pending = g.status === "PENDING";
  const name = isolate(p.name);
  return (
    <div class={`tvscreen tvguess${pending ? " is-dark" : ` is-${g.status.toLowerCase()}`}`}>
      <TvTopBar view={view} />
      {g.status === "CORRECT" && <><div class="tvflash" aria-hidden="true" /><Confetti colors={[PALETTE.blank, PALETTE.accent, PALETTE.text]} count={48} /></>}
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
            {/* The host's override relies on the room hearing the guess: the TV asks for it out loud too. */}
            <p class="tvt-caption tv-accent">{t("guess.sayAloud", { name })}</p>
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
          <button type="button" class="tvbtn" onClick={() => openDialog({ title: t("guess.acceptConfirm", { name }), confirm: t("guess.accept"), onConfirm: () => tvAct({ type: "HOST_OVERRIDE_GUESS", accept: true }) })}>
            <Icon name="check" />{t("guess.accept")}
          </button>
        )}
        {!pending && !g.overridden && g.status === "CORRECT" && (
          <button type="button" class="tvbtn tvbtn--danger" onClick={() => openDialog({ title: t("guess.rejectConfirm"), confirm: t("guess.reject"), danger: true, onConfirm: () => tvAct({ type: "HOST_OVERRIDE_GUESS", accept: false }) })}>
            <Icon name="x" />{t("guess.reject")}
          </button>
        )}
        <ActionPill label={pending ? t("guess.skip") : t("common.continue")} pillRef={pill} key={pending ? "skip" : "continue"} />
      </div>
    </div>
  );
}

/** TV-11 scoreboard rows in view (40 dp each): five, so the Mole of a 5–6 player game is never behind the fold. */
export const SB_ROWS = 5;

/** Stage 1 title steps down with its length so it always stays one line ("THE MOLES & THE BLANK WIN!" included). */
export function titleSize(text: string): string {
  const n = [...text].length;
  return n <= 16 ? "tvt-displayL" : n <= 24 ? "tvt-displayM" : "tvt-displayS";
}

/** The civilian-win houses rise in two lanes beside the title, never across its letters: x (canvas px) for each of
 *  the 12, from the title's layout box (transform-free, so the pop-in scale doesn't skew it). A lane narrower than
 *  one house is left empty. */
export function particleLanes(titleLeft: number, titleRight: number, canvas = 960, size = 28, pad = 24): number[] {
  const lane = (from: number, to: number): number[] =>
    to - from < 0 ? [] : Array.from({ length: 6 }, (_, i) => Math.round(from + ((to - from) * i) / 5));
  return [...lane(pad, titleLeft - pad - size), ...lane(titleRight + pad, canvas - pad - size)];
}

/** TV-11 Results: stage 1 (victory moment, words meet), then stage 2 (scoreboard, history, actions). */
export function TvResults({ view }: { view: TvView }) {
  const r = view.result;
  const [stage2, setStage2] = useState(false);
  const [sbEnd, setSbEnd] = useState(false);
  const playRef = useInitialFocus<HTMLButtonElement>();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [lanes, setLanes] = useState<number[]>([]);
  useEffect(() => {
    if (stage2) return;
    const id = setTimeout(() => setStage2(true), ms(5000));
    return () => clearTimeout(id);
  }, [stage2]);
  // Stage 1 already shows the action bar with Play again focused (Kotlin): any OK there only skips to stage 2.
  const guard = (f: () => void) => (): void => { if (stage2) f(); else setStage2(true); };
  const showHouses = !!r && r.winner === "CIVILIANS" && !stage2 && !reduced();
  useLayoutEffect(() => {
    const h = titleRef.current;
    const stageEl = h?.offsetParent as HTMLElement | null;
    if (!showHouses || !h || !stageEl) return;
    const left = stageEl.offsetLeft + h.offsetLeft;
    setLanes(particleLanes(left, left + h.offsetWidth));
  }, [showHouses]);
  if (!r) return null;
  const winnerName = r.winner === "BLANK" ? byId(view, r.winnerIds[0])?.name ?? "" : "";
  const ranked = rankPlayers(view.players);
  const blankGuess = r.winner === "BLANK" ? r.guesses.find((g) => g.status === "CORRECT")?.text ?? null : null;
  const l = locale.value;
  const win = winnerMessage(view);
  const title = t(win.key, { count: win.count, name: isolate(winnerName) });
  const caught = culprits(view);
  return (
    <div class={`tvscreen tvresults tvresults--${r.winner.toLowerCase()}${stage2 ? " is-stage2" : ""}`} onClick={() => setStage2(true)}>
      <TvTopBar view={view} title={t("results.title")} />
      <div class="tvresults__wash" aria-hidden="true">
        <div class="tvresults__fx">
          {showHouses && lanes.map((x, i) => <span key={i} class="particle" style={{ "--i": i, left: `${x}px` }}><RoleEmblem role="CIVILIAN" size={28} /></span>)}
          {!reduced() && r.winner === "INFILTRATORS" && [0, 1, 2, 3].map((i) => <span key={i} class={`peek-mask peek-mask--${i}`}><RoleEmblem role="UNDERCOVER" size={96} /></span>)}
        </div>
      </div>
      <div class="tvstage tvresults__stage">
        <h1 ref={titleRef} class={`tvresults__title ${stage2 ? "tvt-headline" : titleSize(title)}`}>{title}</h1>
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
        {/* The reveal everyone waited for ("it was Ben!"), under the words. */}
        {!stage2 && caught.length > 0 && (
          <ul class="tvculprits">
            {caught.map((p) => (
              <li key={p.id} class={`tvculprits__item tvculprits__item--${p.revealedRole!.toLowerCase()}`}>
                <Avatar color={p.color} size={48} state={p.left ? "left" : "normal"} />
                <span class="tvt-title">{t(ROLE_WAS_KEY[p.revealedRole!], { name: isolate(p.name) })}</span>
              </li>
            ))}
          </ul>
        )}
        {stage2 && (
          <>
            <p class="tvt-body tv-secondary tvresults__meta">
              {t("results.pack", { title: r.pack.title[l] })}
              {r.guesses.map((g, i) => {
                const gp = byId(view, g.playerId);
                return gp && g.text !== null ? <Fragment key={i}>{"  ·  "}{t("guess.guessed", { name: isolate(gp.name), text: isolate(g.text) })}</Fragment> : null;
              })}
            </p>
            <div class="tvsb" role="table" aria-label={t("results.scoreboard")}>
              <div class="tvsb__row tvsb__row--head" role="row">
                <span>{t("results.colRank")}</span><span>{t("results.colPlayer")}</span><span>{t("results.colRole")}</span><span>{t("results.colGame")}</span><span>{t("results.colTotal")}</span>
              </div>
              {/* DESIGN TV-11: 5 rows show (the round history lives in the pause menu); every row is a D-pad stop, so focus scrolls the list (data-scroll: the
                  remote enters it on a visible row). The fade and chevron stay until the last row is in view. */}
              <div class={`tvsb__bodywrap${ranked.length > SB_ROWS && !sbEnd ? " has-more" : ""}`}>
                {ranked.length > SB_ROWS && !sbEnd && <span class="tvsb__more" aria-hidden="true"><Icon name="chevron-down" size={20} /></span>}
                <div class="tvsb__body" data-scroll onScroll={(e) => { const b = e.currentTarget; setSbEnd(b.scrollTop + b.clientHeight >= b.scrollHeight - 2); }}>
                {ranked.map((p, i) => {
                  const pts = r.pointsAwarded[p.id] ?? 0;
                  const rank = competitionRank(ranked, p); // equal totals share a rank (and the trophy)
                  return (
                    <div key={p.id} role="row" tabIndex={0} class={`tvsb__row${rank === 1 ? " is-first" : ""}`} style={{ "--i": i }}>
                      <span class="tvsb__rank">{rank === 1 ? <Icon name="trophy" size={22} /> : <bdi class="num">{fmtNum(rank)}</bdi>}</span>
                      <span class="tvsb__who"><Avatar color={p.color} size={32} state={p.left ? "left" : "normal"} /><bdi>{p.name}</bdi></span>
                      <span class="tvsb__role">{p.revealedRole && <><span class={`tvsb__emb tvsb__emb--${p.revealedRole.toLowerCase()}`}><RoleEmblem role={p.revealedRole} size={20} /></span>{t(ROLE_KEY[p.revealedRole])}</>}</span>
                      <span class={`tvsb__pts${pts > 0 ? " tv-success" : " tv-muted"}`}><bdi class="num">{pts > 0 ? t("results.pointsEarned", { count: pts }) : fmtNum(0)}</bdi></span>
                      <span class="tv-accent tvsb__total"><bdi class="num">{fmtNum(p.score)}</bdi></span>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div class="tvbottom tvbottom--results">
        <button type="button" ref={playRef} class="tvbtn tvbtn--primary" data-default-focus onClick={guard(() => tvAct({ type: "PLAY_AGAIN" }))}><Icon name="refresh" />{t("results.playAgain")}</button>
        <button type="button" class="tvbtn" onClick={guard(() => { tvAct({ type: "PLAY_AGAIN" }); tvScreen.value = "settings"; })}><Icon name="settings" />{t("results.changeSettings")}</button>
        <button type="button" class="tvbtn" onClick={guard(() => openDialog({ title: t("results.newRoomConfirm"), confirm: t("results.newRoom"), onConfirm: () => void tvCreateRoom() }))}><Icon name="plus" />{t("results.newRoom")}</button>
      </div>
    </div>
  );
}
