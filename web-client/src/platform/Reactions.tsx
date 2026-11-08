// JAMAA-PLATFORM §3.3 / §3.7: the phone reactions bar (the 6 REACTIONS as icons, no emoji → REACT) and the members
// strip (40 px characters with names; reactions replay per `reaction.n`).
import { useState } from "preact/hooks";
import { REACTION_MIN_GAP_MS } from "@jamaa/shared/constants";
import type { MemberPublic } from "@jamaa/shared/protocol/v2";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { act } from "../state/session";
import { HAPTIC, haptic } from "../lib/haptics";
import { Icon } from "../components/Icon";
import { MemberCharacter } from "../components/Character";
import { ellipsizeName } from "../lib/names";

export const REACTION_KINDS = ["laugh", "shock", "facepalm", "happy", "sad", "cheer"] as const;

export function ReactionsBar() {
  const [cool, setCool] = useState(false);
  const send = (kind: (typeof REACTION_KINDS)[number]): void => {
    if (cool) return;
    if (act({ type: "REACT", kind })) {
      haptic(HAPTIC.tick);
      setCool(true);
      setTimeout(() => setCool(false), REACTION_MIN_GAP_MS);
    }
  };
  return (
    <div class={`reactbar${cool ? " is-cool" : ""}`} role="group" aria-label={t("react.bar")}>
      {REACTION_KINDS.map((k) => (
        <button key={k} type="button" class={`reactbar__btn reactbar__btn--${k}`} aria-label={t(`react.${k}` as MessageKey)} aria-disabled={cool} onClick={() => send(k)}>
          <Icon name={`r-${k}`} size={28} />
        </button>
      ))}
    </div>
  );
}

export function MembersStrip({ members, myId, status, size = 40 }: { members: readonly MemberPublic[]; myId: string | null; status?: { doneIds: readonly string[]; awaitedIds: readonly string[] } | null; size?: number }) {
  const list = members.filter((m) => !m.left);
  const max = list.length > 8 ? 6 : 8;
  return (
    <ul class="mstrip" aria-label={t("setup.gang")}>
      {list.map((m) => (
        <li key={m.id} class={`mstrip__item${m.id === myId ? " is-you" : ""}${m.benched ? " is-benched" : ""}`}>
          <MemberCharacter m={m} size={size} status={status ?? null} crown={m.isHost} />
          <bdi class="mstrip__name">{ellipsizeName(m.name, max)}</bdi>
        </li>
      ))}
    </ul>
  );
}
