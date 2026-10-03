// PH-13 Results: personal headline, team result, both words, pack, Blank guesses, scoreboard.
import type { Me, PlayerView, PublicPlayer } from "@mishana/shared/protocol";
import type { WordRef } from "@mishana/shared/engine";
import { dirOf, fmtNum, locale, t } from "../i18n/t";
import { act } from "../state/session";
import { Avatar, avatarState, COLOR_BY_ID } from "../components/PlayerChip";
import { RoleChip, RoleEmblem } from "../components/Role";
import { Button, Confetti, Slot } from "../components/UI";
import { Icon } from "../components/Icon";
import { byId } from "./Clues";

function Word({ label, word, cls, wordLocale }: { label: string; word: WordRef; cls: string; wordLocale: PlayerView["settings"]["wordLocale"] }) {
  return (
    <div class={`resword ${cls}`}>
      <span class="resword__label">{label}</span>
      <span class="resword__text" lang={wordLocale} dir={dirOf(wordLocale)}>{word.text}</span>
      {word.translit !== null && <span class="resword__translit" dir="auto">{word.translit}</span>}
    </div>
  );
}

export function rankPlayers(players: PublicPlayer[]): PublicPlayer[] {
  return [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
}

export function Results({ view, me }: { view: PlayerView; me: Me | null }) {
  const r = view.result;
  if (!r) return null;
  const myId = me?.id ?? null;
  const won = myId !== null && r.winnerIds.includes(myId);
  const myPts = myId ? r.pointsAwarded[myId] ?? 0 : 0;
  const blankName = r.winner === "BLANK" ? byId(view, r.winnerIds[0] ?? null)?.name ?? "" : "";
  const teamKey = r.winner === "CIVILIANS" ? "winner.civilians" : r.winner === "INFILTRATORS" ? "winner.infiltrators" : "winner.blank";
  const meP = byId(view, myId);
  const isVip = myId !== null && view.hostPlayerId === myId;
  const ranked = rankPlayers(view.players);
  return (
    <>
      <main class={`screen screen--results results--${r.winner.toLowerCase()}`}>
        {won && meP && <Confetti colors={[COLOR_BY_ID[meP.color].hex, "#FFF7EC", "#FFC23D"]} />}
        <div class="results__head">
          {myId && (
            <p class={`results__me ${won ? "is-won" : "is-lost"}`}>
              {won ? <><Icon name="trophy" size={22} />{t("results.youWon", { count: myPts })}</> : t("results.youLost")}
            </p>
          )}
          <h1 class="display results__team" tabIndex={-1}>{t(teamKey, { name: "⁨" + blankName + "⁩" })}</h1>
          {meP?.revealedRole && <p class="results__role"><Slot k="elim.youWere" slot="role"><RoleChip role={meP.revealedRole} size={22} /></Slot></p>}
        </div>
        <div class="reswords">
          <Word label={t("results.civilianWord")} word={r.civilianWord} cls="resword--civilian" wordLocale={view.settings.wordLocale} />
          <Word label={t("results.undercoverWord")} word={r.undercoverWord} cls="resword--undercover" wordLocale={view.settings.wordLocale} />
        </div>
        <p class="results__meta">{t("results.pack", { title: r.pack.title[locale.value] })}</p>
        {r.guesses.map((g, i) => {
          const p = byId(view, g.playerId);
          return p && g.text !== null ? (
            <p class="results__guess" key={i}>
              <RoleEmblem role="BLANK" size={20} />
              {t("guess.guessed", { name: "⁨" + p.name + "⁩", text: "⁨" + g.text + "⁩" })}
              <Icon name={g.status === "CORRECT" ? "check" : "x"} size={18} class={g.status === "CORRECT" ? "ok" : "bad"} />
            </p>
          ) : null;
        })}
        <section class="card scoreboard" aria-labelledby="sb-h">
          <h2 id="sb-h" class="eyebrow">{t("results.scoreboard")}</h2>
          <ol class="sb">
            {ranked.map((p, i) => {
              const pts = r.pointsAwarded[p.id] ?? 0;
              return (
                <li key={p.id} class={`sb__row${p.id === myId ? " is-you" : ""}${i === 0 ? " is-first" : ""}`} style={{ "--i": i }}>
                  <span class="sb__rank">{i === 0 ? <Icon name="trophy" size={18} /> : <bdi class="num">{fmtNum(i + 1)}</bdi>}</span>
                  <Avatar color={p.color} size={32} state={p.left ? "left" : avatarState({ ...p, alive: true })} />
                  <span class="sb__who">
                    <bdi class="sb__name">{p.name}</bdi>
                    {p.revealedRole && <span class={`sb__role sb__role--${p.revealedRole.toLowerCase()}`}><RoleEmblem role={p.revealedRole} size={16} /></span>}
                    {p.id === myId && <span class="tag">{t("common.you")}</span>}
                  </span>
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
          <p class="waiting"><span class="dots" aria-hidden="true"><i /><i /><i /></span>{t("results.waitingHost")}</p>
        )}
      </footer>
    </>
  );
}
