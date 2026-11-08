// JAMAA-PLATFORM §2.4 / §3.3 PHH-05 / DESIGN-JAMAA §2.6: "Tonight's cup" on the phone results. This player's new
// stars fly in from the top (3 × 32 px amber stars, 120 ms stagger, ease.overshoot); then the session standings.
import { CUP_STARS } from "@jamaa/shared/constants";
import type { RoomPublic } from "@jamaa/shared/protocol/v2";
import { fmtNum, t } from "../i18n/t";
import { Icon } from "../components/Icon";
import { Character } from "../components/Character";

/** Stars this instance gave each member: 1st +3, 2nd +2, 3rd +1 over the competition ranking groups (§2.4). */
export function starsOfLast(cup: RoomPublic["cup"]): Record<string, number> {
  const out: Record<string, number> = {};
  const r = cup.last?.ranking ?? [];
  const ranked = r.reduce((n, g) => n + g.length, 0);
  let place = 0;
  for (const group of r) {
    const stars = ranked < 3 && place > 0 ? 0 : CUP_STARS[place] ?? 0;
    for (const id of group) out[id] = stars;
    place += group.length;
  }
  return out;
}

/** Members by session stars, desc, then seat. */
export function cupStandings(room: RoomPublic): { id: string; name: string; color: RoomPublic["members"][number]["color"]; stars: number }[] {
  return room.members.filter((m) => !m.left)
    .map((m) => ({ id: m.id, name: m.name, color: m.color, stars: room.cup.stars[m.id] ?? 0, seat: m.seat }))
    .sort((a, b) => b.stars - a.stars || a.seat - b.seat);
}

export function CupPanel({ room, myId }: { room: RoomPublic; myId: string | null }) {
  const earned = myId ? starsOfLast(room.cup)[myId] ?? 0 : 0;
  const rows = cupStandings(room);
  const top = rows[0]?.stars ?? 0;
  return (
    <section class="card cup" aria-labelledby="cup-h">
      <h2 id="cup-h" class="cup__title"><Icon name="trophy" size={22} />{t("cup.title")}</h2>
      {earned > 0 && (
        <p class="cup__earned" aria-label={t("cup.starsEarned", { count: earned })}>
          {Array.from({ length: earned }, (_, i) => <span key={i} class="cup__fly" style={{ "--i": i }}><Icon name="star" size={32} /></span>)}
          <span class="cup__plus tnum">{t("cup.starsEarned", { count: earned })}</span>
        </p>
      )}
      <ol class="cup__list">
        {rows.slice(0, 6).map((r) => (
          <li key={r.id} class={`cup__row${r.id === myId ? " is-you" : ""}`}>
            <Character color={r.color} size={40} expression={r.stars > 0 && r.stars === top ? "cheer" : "idle"} crown={r.stars > 0 && r.stars === top} />
            <bdi class="cup__name">{r.name}</bdi>
            <span class="cup__stars tnum"><Icon name="star" size={18} />{fmtNum(r.stars)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
