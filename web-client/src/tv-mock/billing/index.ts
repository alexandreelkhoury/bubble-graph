// The TV mock's one BillingController, wired to the browser (fetch, localStorage with try/catch, crypto).
import { readRaw, removeRaw, writeRaw } from "../../lib/storage";
import { BillingController } from "./controller";

export const billing = new BillingController({
  fetch: (url, init) => fetch(url, init),
  now: () => Date.now(),
  read: readRaw,
  write: writeRaw,
  remove: removeRaw,
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});
