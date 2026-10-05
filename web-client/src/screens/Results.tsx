// PH-13 Results: personal headline, team result, both words, pack, Blank guesses, scoreboard.
import type { Me, PlayerView } from "@mishana/shared/protocol";
import type { WordRef } from "@mishana/shared/engine";
import { dirOf, fmtNum, isolate, locale, t } from "../i18n/t";
import { act } from "../state/session";
import { Avatar, avatarState, COLOR_BY_ID } from "../components/PlayerChip";
import { RoleChip, RoleEmblem } from "../components/Role";
import { Button, Confetti, PALETTE, Slot } from "../components/UI";
import { Icon } from "../components/Icon";
import { byId, competitionRank, culprits, rankPlayers, winnerMessage } from "../lib/view";
import { ROLE_WAS_KEY } from "../lib/keys";

function Word({ label, word, cls, wordLocale }: { label: string; word: WordRef; cls: string; wordLocale: PlayerView["settings"]["wordLocale"] }) {
  return (
    <div class={`resword ${cls}`}>
      <span class="resword__label">{label}</span>
      <span class="resword__text" lang={wordLocale} dir={dirOf(wordLocale)}>{word.text}</span>
      {word.translit !== null && <span class="resword__translit" dir="auto">{word.translit}</span>}
    </div>
  );
}

export function Results({ view, me }: { view: PlayerView; me: Me | null }) {
  const r = view.result;
  if (!r) return null;
  const myId = me?.id ?? null;
  const won = myId !== null && r.winnerIds.includes(myId);
  const myPts = myId ? r.pointsAwarded[myId] ?? 0 : 0;
  const blankName = r.winner === "BLANK" ? byId(view, r.winnerIds[0])?.name ?? "" : "";
  const meP = byId(view, myId);
  const isVip = myId !== null && view.hostPlayerId === myId;
  const ranked = rankPlayers(view.players);
  const win = winnerMessage(view);
  const caught = culprits(view);
  return (
    <>
      <main class={`screen screen--results results--${r.winner.toLowerCase()}`}>
        {won && meP && <Confetti colors={[COLOR_BY_ID[meP.color].hex, PALETTE.text, PALETTE.accent]} />}
        <div class="results__head">
          {myId && (
            <p class={`results__me ${won ? "is-won" : "is-lost"}`}>
              {won ? <><Icon name="trophy" size={22} />{t("results.youWon", { count: myPts })}</> : t("results.youLost")}
            </p>
          )}
          <h1 class="display results__team" tabIndex={-1}>{t(win.key, { count: win.count, name: isolate(blankName) })}</h1>
          {meP?.revealedRole && <p class="results__role"><Slot k="elim.youWere" slot="role"><RoleChip role={meP.revealedRole} size={22} /></Slot></p>}
        </div>
        <div class="reswords">
          <Word label={t("results.civilianWord")} word={r.civilianWord} cls="resword--civilian" wordLocale={view.settings.wordLocale} />
          <Word label={t("results.undercoverWord")} word={r.undercoverWord} cls="resword--undercover" wordLocale={view.settings.wordLocale} />
        </div>
        {/* The payoff: who the Mole and the Blank were, above the fold (the scoreboard sorts them to the bottom). */}
        {caught.length > 0 && (
          <ul class="culprits">
            {caught.map((p) => (
              <li key={p.id} class={`culprits__item culprits__item--${p.revealedRole!.toLowerCase()}`}>
                <Avatar color={p.color} size={32} state={p.left ? "left" : "normal"} />
                <span>{t(ROLE_WAS_KEY[p.revealedRole!], { name: isolate(p.name) })}</span>
              </li>
            ))}
          </ul>
        )}
        <p class="results__meta">{t("results.pack", { title: r.pack.title[locale.value] })}</p>
        {r.guesses.map((g, i) => {
          const p = byId(view, g.playerId);
          return p && g.text !== null ? (
            <p class="results__guess" key={i}>
              <RoleEmblem role="BLANK" size={20} />
              {t("guess.guessed", { name: isolate(p.name), text: isolate(g.text) })}
              <Icon name={g.status === "CORRECT" ? "check" : "x"} size={18} class={g.status === "CORRECT" ? "ok" : "bad"} />
            </p>
          ) : null;
        })}
        <section class="card scoreboard" aria-labelledby="sb-h">
          <div class="sb__head">
            <h2 id="sb-h" class="eyebrow">{t("results.scoreboard")}</h2>
            <span class="sb__col" aria-hidden="true">{t("results.colGame")}</span>
            <span class="sb__col" aria-hidden="true">{t("results.colTotal")}</span>
          </div>
          <ol class="sb">
            {ranked.map((p, i) => {
              const pts = r.pointsAwarded[p.id] ?? 0;
              const rank = competitionRank(ranked, p); // equal totals share a rank (and the trophy)
              return (
                <li key={p.id} class={`sb__row${p.id === myId ? " is-you" : ""}${rank === 1 ? " is-first" : ""}`} style={{ "--i": i }}>
                  <span class="sb__rank">{rank === 1 ? <Icon name="trophy" size={18} /> : <bdi class="num">{fmtNum(rank)}</bdi>}</span>
                  <Avatar color={p.color} size={32} state={p.left ? "left" : avatarState({ ...p, alive: true })} />
                  <span class="sb__who">
                    <bdi class="sb__name">{p.name}</bdi>
                    {p.id === myId && <span class="sr-only">{t("common.you")}</span>}
                  </span>
                  <span>{p.revealedRole && <span class={`sb__role sb__role--${p.revealedRole.toLowerCase()}`}><RoleEmblem role={p.revealedRole} size={16} /></span>}</span>
                  <span class={`sb__pts${pts > 0 ? " is-pos" : ""}`}><bdi class="num">{pts > 0 ? t("results.pointsEarned", { count: pts }) : fmtNum(0)}</bdi></span>
                  <span class="sb__total"><bdi class="num">{fmtNum(p.score)}</bdi></span>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
      <footer class="actionbar">
        {isVip ? (
          <Button onClick={() => act({ type: "PLAY_AGAIN" })}><Icon name="refresh" />{t("results.playAgain")}</Button>
        ) : (
          <p class="waiting"><span class="waiting__text"><span class="dots" aria-hidden="true"><i /><i /><i /></span>{t("results.waitingHost")}</span></p>
        )}
      </footer>
    </>
  );
}
