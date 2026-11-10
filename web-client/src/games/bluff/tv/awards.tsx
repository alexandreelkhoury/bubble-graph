// BL-TV-07 awards and BL-TV-08 results on /tv (GAME-BLUFF §6.6, §12.5): trophy cards drop onto a velvet stand one by
// one and the winners run in to lift them (Bluff of the Night replays the answer with a "fooled ×N" counter ticking);
// then the podium (characters jump onto steps 3, 2, 1, confetti on 1) and the full scoreboard. OK completes the drop.
import { useEffect, useState } from "preact/hooks";
import { t } from "../../../i18n/t";
import type { MessageKey } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Character } from "../../../components/Character";
import { Icon } from "../../../components/Icon";
import { resultsSettled } from "../../../tv-mock/tvPlatform";
import { useInGameOk } from "../../../tv-mock/tvParts";
import { Odo } from "../art";
import { awardAt, awardBodyKey, awardTitleKey, placeOf, ranked } from "../model";
import type { Award, BluffModel } from "../model";
import { BfTop, Cafe, tk } from "./stage";
import { sfx } from "./sfx";

export function TvAwards({ m }: { m: BluffModel }) {
  const awards = m.pub.awards;
  const [shown, setShown] = useState(reduced() ? awards.length : 0);
  useEffect(() => {
    if (reduced()) return;
    const ids = awards.map((_, i) => setTimeout(() => { setShown((n) => Math.max(n, i + 1)); sfx("award"); }, awardAt(i)));
    return () => ids.forEach(clearTimeout);
  }, []);
  useInGameOk(shown < awards.length, () => setShown(awards.length));
  const cur = shown > 0 ? awards[shown - 1] : undefined;
  return (
    <div class="tvscreen bf bf--awards" data-world="hakawati-cafe" data-bf-phase="AWARDS" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe dim board={false} neon={false} />
      <BfTop m={m} timer={false} label={tk("awards.title")} />
      <div class="bfawards">
        {!cur ? (
          <p class="bfawards__drum"><span class="bfneon">{tk("awards.title")}</span></p>
        ) : <TrophyCard m={m} a={cur} key={cur.id} />}
        <ol class="bfawards__shelf" aria-hidden="true">
          {awards.slice(0, Math.max(0, shown - 1)).map((a) => <li key={a.id}><Icon name="trophy" size={18} />{t(awardTitleKey(a) as MessageKey)}</li>)}
        </ol>
      </div>
    </div>
  );
}

function TrophyCard({ m, a }: { m: BluffModel; a: Award }) {
  const [n, setN] = useState(reduced() ? a.value : 0);
  useEffect(() => {
    if (reduced() || a.id !== "bluffOfTheNight") { setN(a.value); return; }
    let i = 0;
    const id = setInterval(() => { i++; setN(Math.min(a.value, i)); if (i >= a.value) clearInterval(id); }, 260);
    return () => clearInterval(id);
  }, []);
  return (
    <div class={`bftrophy bftrophy--${a.id}`} role="status">
      <div class="bftrophy__card">
        <span class="bftrophy__cup"><Icon name="trophy" size={44} /></span>
        <p class="bftrophy__title">{t(awardTitleKey(a) as MessageKey)}</p>
        {a.text && <p class="bftrophy__quote" dir="auto">{a.text}</p>}
        <p class="bftrophy__body">{t(awardBodyKey(a) as MessageKey, { count: a.id === "bluffOfTheNight" ? n : a.value })}</p>
      </div>
      <span class="bftrophy__stand" aria-hidden="true" />
      <div class="bftrophy__who">
        {a.playerIds.map((id, i) => {
          const s = m.byId.get(id);
          return s ? (
            <span key={id} class="bftrophy__p" style={{ "--i": i }}>
              <Character color={s.color} size={a.playerIds.length > 2 ? 84 : 108} expression="cheer" />
              <bdi>{s.name}</bdi>
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

const STEP_ORDER = [2, 1, 0] as const;

export function TvResults({ m }: { m: BluffModel }) {
  const list = ranked(m.seats);
  const podium = list.slice(0, 3);
  const [step, setStep] = useState(reduced() ? 3 : 0);
  useEffect(() => {
    if (reduced()) { const id = setTimeout(() => { resultsSettled.value = true; }, 300); return () => { clearTimeout(id); resultsSettled.value = false; }; }
    const ids = [0, 1, 2].map((i) => setTimeout(() => setStep(i + 1), 500 + i * 650));
    const done = setTimeout(() => { resultsSettled.value = true; }, 2600);
    return () => { ids.forEach(clearTimeout); clearTimeout(done); resultsSettled.value = false; };
  }, []);
  useInGameOk(step < 3, () => setStep(3));
  // Steps 3, 2, 1 land in that order (§12.5): podium index 2 first.
  const landed = (i: number): boolean => STEP_ORDER.indexOf(i as 0 | 1 | 2) < step;
  const winners = list.filter((s) => s.score === list[0]?.score && s.score > 0);
  return (
    <div class="tvscreen bf bf--results" data-world="hakawati-cafe" data-bf-phase="RESULTS" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe dim board={false} neon={false} />
      <BfTop m={m} timer={false} label={t("results.title")} />
      <div class="bfpodium">
        {[1, 0, 2].map((i) => {
          const s = podium[i];
          if (!s) return <div key={i} class="bfpodium__col is-empty" />;
          const place = placeOf(list, s.id);
          return (
            <div key={s.id} class={`bfpodium__col bfpodium__col--${i + 1}${landed(i) ? " is-landed" : ""}`}>
              <span class="bfpodium__char"><Character color={s.color} size={i === 0 ? 112 : 84} expression={landed(i) ? (i === 0 ? "cheer" : "happy") : "idle"} crown={i === 0 && landed(i)} /></span>
              <bdi class="bfpodium__name">{s.name}</bdi>
              <span class="bfpodium__score"><Odo value={landed(i) ? s.score : 0} max={s.score} /></span>
              <span class="bfpodium__step"><span class="tnum">{place}</span></span>
            </div>
          );
        })}
        {step >= 3 && winners.length > 0 && <span class="bfconfetti bfconfetti--podium" style={{ "--p": 1 }} aria-hidden="true">
          {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ "--a": `${(i * 53) % 360}deg`, "--d": `${80 + ((i * 31) % 160)}px`, "--c": ["#FFC94D", "#FFF7EC", "#E9A23B", "#FF5A5F"][i % 4], "--x": "50%" }} />)}
        </span>}
      </div>
      <ol class="bfboardtv">
        {list.slice(3, 12).map((s) => (
          <li key={s.id} class={s.left ? "is-left" : ""}>
            <span class="tnum">{placeOf(list, s.id)}</span>
            <Character color={s.color} size={28} expression="idle" />
            <bdi>{s.name}</bdi>
            <span class="tnum bfboardtv__score">{s.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
