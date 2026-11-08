// JAMAA-PLATFORM §3.6 / DESIGN-JAMAA §2.4: the ⓘ rules content, shared by the TV side sheet and the phone bottom sheet.
// The sections for the current phase come first, marked "You are here"; on the hub the content ends with
// "How JAMAA works".
import type { GameId } from "@jamaa/shared/games/ids";
import { metaOf } from "../lib/meta";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { PHASE_KEY } from "../lib/keys";
import { HowToScene } from "./HowTo";

const tk = (k: string): string => t(k as MessageKey);

/** The phase's display name: Mish Ana!'s phase keys, else the raw phase id (G lanes add theirs). */
function phaseName(id: GameId, phase: string): string {
  if (id === "mishana" && phase in PHASE_KEY) return t(PHASE_KEY[phase as keyof typeof PHASE_KEY]);
  return tk(`game.${id}.phase.${phase}`);
}

export function RulesBody({ id, phase, hub }: { id: GameId; phase: string | null; hub: boolean }) {
  const rules = metaOf(id)?.rules;
  if (!rules) return <div class="rules" aria-busy="true" />;
  const here = phase ? rules.ruleSections.filter((s) => s.phases.includes(phase)) : [];
  const rest = rules.ruleSections.filter((s) => !here.includes(s));
  return (
    <div class="rules">
      {here.length > 0 && (
        <section class="rules__here">
          <p class="rules__hereLabel">{t("rules.youAreHere", { phase: phaseName(id, phase!) })}</p>
          {here.map((s) => (
            <div key={s.id} class="rules__sec">
              <h3 class="rules__h">{tk(s.titleKey)}</h3>
              <p class="rules__p">{tk(s.bodyKey)}</p>
            </div>
          ))}
        </section>
      )}
      {rest.map((s, i) => (
        <section key={s.id} class="rules__sec">
          <h3 class="rules__h">{tk(s.titleKey)}</h3>
          <p class="rules__p">{tk(s.bodyKey)}</p>
          {i === 0 && here.length === 0 && <HowToScene index={0} size={44} />}
        </section>
      ))}
      {rules.ruleSections.length === 0 && rules.howToKeys.map((k) => <p key={k} class="rules__p">{tk(k)}</p>)}
      {hub && (
        <section class="rules__jamaa">
          <h3 class="rules__h">{t("hub.howJamaa.title")}</h3>
          <ol class="rules__cards">
            {(["join", "pick", "cup"] as const).map((k, i) => (
              <li key={k} class="rules__card"><span class="rules__num tnum">{i + 1}</span><span>{t(`hub.howJamaa.${k}`)}</span></li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
