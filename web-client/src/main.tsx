import { render } from "preact";
import "./styles.css";
import { App } from "./app";
import { detectLocale, setLocale } from "./i18n/t";
import { loadLocale } from "./lib/storage";
import { startRouter } from "./router";

setLocale(loadLocale() ?? detectLocale(navigator.languages));
startRouter();
const root = document.getElementById("app");
if (root) render(<App />, root);
