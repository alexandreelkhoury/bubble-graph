#!/usr/bin/env node
// Mish Ana! screenshot bots: join a TV room as 5-6 phone players over the real WebSocket protocol
// (protocol v1, see bubble-graph/shared/src/protocol + docs/SPEC.md) and play along slowly so each
// TV phase can be captured. No dependencies (Node >= 22 global WebSocket).
//
// Usage: node mishana-bots.mjs <ROOM> [--players 6] [--pace 7000] [--timeout 900] [--server https://play.mishana.workers.dev]
//   --pace     ms each bot waits before acting in a phase (ready, clue done, vote), staggered per bot
//   --timeout  hard stop in seconds (bots always disconnect; never left running)
// stdin: "p"+Enter toggles pause (bots stop acting, stay connected), "q"+Enter quits.

const args = process.argv.slice(2);
const code = (args[0] ?? "").toUpperCase();
if (!/^[A-Z]{4}$/.test(code)) {
  console.error("usage: node mishana-bots.mjs <ROOM CODE> [--players 6] [--pace 7000] [--timeout 900]");
  process.exit(2);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const N = Math.min(6, Math.max(3, Number(opt("players", 6))));
const PACE = Number(opt("pace", 7000));
const TIMEOUT_S = Number(opt("timeout", 900));
const SERVER = String(opt("server", "https://play.mishana.workers.dev")).replace(/\/$/, "");
const WS_BASE = SERVER.replace(/^http/, "ws") + "/parties/room/"; // WS_PATH_PREFIX
const PING = '{"v":1,"t":"ping"}';
const PONG = '{"v":1,"t":"pong"}';

const ROSTER = [
  { name: "Maya", color: "coral" },
  { name: "Karim", color: "azure" },
  { name: "Lea", color: "lemon" },
  { name: "Joe", color: "jade" },
  { name: "Nour", color: "grape" },
  { name: "Sami", color: "tangerine" },
].slice(0, N);
const CLUES = ["cheese", "slice", "oven", "delivery", "crust", "tomato", "Friday", "box"];

let paused = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const rid = () => crypto.randomUUID();

class Bot {
  constructor(i, spec) {
    this.i = i;
    this.spec = spec;
    this.view = null;
    this.playerId = null;
    this.n = 0;
    this.lastSend = 0;
    this.busy = new Set(); // phase keys already handled
    this.ws = null;
    this.pinger = null;
  }
  open() {
    return new Promise((resolve, reject) => {
      // _pk: /^[A-Za-z0-9_-]{1,64}$/, cid: /^[A-Za-z0-9-]{8,64}$/ (server/src/index.ts, room-core.ts)
      const ws = new WebSocket(`${WS_BASE}${code}?_pk=${rid()}&cid=${rid()}`);
      this.ws = ws;
      ws.onopen = () => {
        this.send({ v: 1, t: "hello", role: "player" });
        this.pinger = setInterval(() => ws.readyState === 1 && ws.send(PING), 20_000);
        resolve();
      };
      ws.onerror = (e) => reject(new Error(`${this.spec.name}: socket error ${e.message ?? ""}`));
      ws.onclose = (e) => {
        clearInterval(this.pinger);
        if (!shuttingDown) log(`${this.spec.name}: closed ${e.code} ${e.reason}`);
      };
      ws.onmessage = (ev) => this.onFrame(String(ev.data));
    });
  }
  async send(msg) {
    const wait = this.lastSend + 250 - Date.now(); // stay under 5 msg/s
    if (wait > 0) await sleep(wait);
    this.lastSend = Date.now();
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
  act(a) {
    return this.send({ v: 1, t: "action", id: `${this.spec.name}-${++this.n}`, a });
  }
  onFrame(text) {
    if (text === PONG) return;
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (m.t === "welcome") {
      this.playerId = m.playerId;
      log(`${this.spec.name} joined as ${m.playerId}`);
    } else if (m.t === "error") {
      log(`${this.spec.name}: error ${m.code} (ref ${m.ref})`);
    } else if (m.t === "state") {
      const first = this.view === null;
      this.view = m.view;
      if (first && m.view.me === null && !this.playerId) {
        this.send({ v: 1, t: "join", name: this.spec.name, color: this.spec.color, locale: "en" });
      }
      this.react();
    }
  }
  /** Schedules at most one action per (game, round, phase, revote) key. */
  once(key, delay, fn) {
    if (this.busy.has(key)) return;
    this.busy.add(key);
    (async () => {
      await sleep(delay);
      while (paused) await sleep(500);
      if (shuttingDown) return;
      await fn();
    })();
  }
  react() {
    const v = this.view;
    if (!v || !v.me || !this.playerId) return;
    const me = v.players.find((p) => p.id === this.playerId);
    if (!me || me.left) return;
    const key = `${v.gameNumber}:${v.round}:${v.phase}:${v.revote}`;
    const stagger = this.i * Math.round(PACE / 3);
    switch (v.phase) {
      case "ROLE_REVEAL":
        if (!me.ready) this.once(key, PACE + stagger, () => this.act({ type: "READY" }));
        break;
      case "CLUES":
      case "TIE_BREAK":
        if (v.currentSpeakerId === this.playerId && me.alive) {
          this.once(`${key}:${this.playerId}`, PACE, async () => {
            const cur = this.view;
            if (cur.currentSpeakerId !== this.playerId) return;
            const clue = v.me.isBlank ? "round" : CLUES[(this.i + v.round) % CLUES.length];
            log(`${this.spec.name} says "${clue}" (word: ${v.me.word?.text ?? "BLANK"})`);
            await this.act({ type: "CLUE_DONE" });
          });
        }
        break;
      case "VOTING":
        if (me.alive && !me.hasVoted && !v.me.myVote) {
          this.once(key, PACE + stagger, async () => {
            const cur = this.view;
            if (cur.phase !== "VOTING") return;
            let targets = cur.players.filter((p) => p.alive && !p.left && p.id !== this.playerId);
            if (cur.revote && cur.tieCandidates.length) targets = targets.filter((p) => cur.tieCandidates.includes(p.id));
            if (!targets.length) return;
            // Most bots pile on one suspect (highest seat alive) so a clear elimination happens; bot 1 dissents.
            targets.sort((a, b) => b.seat - a.seat);
            const t = this.i === 1 && targets.length > 1 ? targets[1] : targets[0];
            log(`${this.spec.name} votes ${t.name}`);
            await this.act({ type: "CAST_VOTE", targetId: t.id });
          });
        }
        break;
      case "MR_WHITE_GUESS":
        if (v.guess?.playerId === this.playerId && v.guess.status === "PENDING") {
          this.once(key, PACE, () => this.act({ type: "SUBMIT_GUESS", text: "pizza" }));
        }
        break;
      default:
        break;
    }
  }
  close() {
    clearInterval(this.pinger);
    try {
      this.ws?.close(1000, "bye");
    } catch {}
  }
}

let shuttingDown = false;
const bots = ROSTER.map((s, i) => new Bot(i, s));
function shutdown(why) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`stopping (${why})`);
  for (const b of bots) b.close();
  setTimeout(() => process.exit(0), 800);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
setTimeout(() => shutdown(`timeout ${TIMEOUT_S}s`), TIMEOUT_S * 1000).unref?.();
setTimeout(() => shutdown(`timeout ${TIMEOUT_S}s`), TIMEOUT_S * 1000);
process.stdin.on("data", (d) => {
  const s = String(d).trim();
  if (s === "p") log((paused = !paused) ? "paused" : "resumed");
  if (s === "q") shutdown("quit");
});
process.stdin.on("end", () => {}); // keep running when stdin is closed (background use)

log(`joining ${code} on ${SERVER} as ${ROSTER.map((r) => r.name).join(", ")} (pace ${PACE} ms)`);
for (const b of bots) {
  try {
    await b.open();
  } catch (e) {
    log(String(e));
    shutdown("connect failed");
    break;
  }
  await sleep(1500); // join one by one so the lobby fills visibly
}
