import { render } from "preact";
import "virtual:jamaa-worlds.css"; // the world palettes (vite.config.ts, from @jamaa/shared/worlds)
import "./styles.css";
import { App } from "./app";
import { detectLocale, setLocale } from "./i18n/t";
import { loadLocale } from "./lib/storage";
import { watchActionBar, watchKeyboard } from "./lib/keyboard";
import { route, startRouter } from "./router";
import { installReporter, setReportContext } from "./lib/report";
import { view } from "./state/store";

// JAMAA-PLATFORM §8.3: uncaught errors → POST /api/client-errors (throttled). The TV store sets its own context.
installReporter();
setReportContext(() => {
  const r = route.value;
  const room = view.value?.room;
  return { s: room ? room.phase + ":" + room.setupGameId : r.kind, r: (r as { code?: string }).code };
});
// The first paint is already in the player's language: wait for its catalog (FR/AR are separate chunks).
await setLocale(loadLocale() ?? detectLocale(navigator.languages));
startRouter();
watchKeyboard(window, document.documentElement);
watchActionBar(document);
const root = document.getElementById("app");
if (root) render(<App />, root);
