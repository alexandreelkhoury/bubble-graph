// QA bots: slow bot "phones" that join an EXISTING room (the real TV app's room code) and play whatever game the TV
// starts, so a human can screenshot every phase on the TV. Bots never start a game; the TV remote drives the room.
//
//   pnpm --filter @jamaa/sim run qa-bots -- --server https://play.mishana.workers.dev --code ABCD --bots 4 --delay 4000
//     [--locale en|ar|fr|es] [--hold] [--quiet-lobby]
//   pnpm --filter @jamaa/sim run qa-bots -- --server … --selftest [--bots 4] [--delay 1500]
//
// Every action mirrors what the phone web client sends in that phase (web-client/src/games/<id>/phone.tsx, needsMe):
//   mishana  ROLE_REVEAL READY · CLUES/TIE_BREAK CLUE_DONE (own turn) · VOTING CAST_VOTE · MR_WHITE_GUESS SUBMIT_GUESS
//   bluff    WRITING SUBMIT_LIE · VOTING VOTE (never an own option; not when Spot on) + sometimes one LIKE
//   likely   VOTING VOTE {cardId, targetId} (any seat but the card's named player)
//   trivia   ANSWER ANSWER {choice}
// `--hold`: bots stay connected but never act (lobby and games). Without it, bots send one reaction emoji each time the
// room enters HUB or SETUP (so the TV lobby shows life). `--selftest` creates its own room and plays the TV side too
// (hub → each game → back to hub), for checking the bots without a TV. `kill -USR2 <pid>` drops the first bot's socket
// (it then resumes with its token, or joins again if the room forgot it).
import { COLORS, PING_FRAME } from "@jamaa/shared/constants";
import { REACTIONS } from "@jamaa/shared/room";
import type { RoomIntentMsg, RoomView } from "@jamaa/shared/protocol/v2";
import type { MishanaMe, MishanaPublic } from "@jamaa/shared/games/mishana/protocol";
import type { BluffMe, BluffPublic } from "@jamaa/shared/games/bluff/protocol";
import type { LikelyMe, LikelyPublic } from "@jamaa/shared/games/likely/protocol";
import type { TriviaMe, TriviaPublic } from "@jamaa/shared/games/trivia/protocol";
import { ALL_TV_GAMES } from "@jamaa/shared/testing";
import { WsClient, createRoomHttp, joinAsPlayer } from "./ws-mode";

type Locale = "en" | "ar" | "fr" | "es";
interface QaArgs { server: string; code: string | null; bots: number; delay: number; locale: Locale; hold: boolean; quietLobby: boolean; selftest: boolean; selftestGames: string[] }

function parseQaArgs(argv: readonly string[]): QaArgs {
  const o: QaArgs = { server: "https://play.mishana.workers.dev", code: null, bots: 4, delay: 4000, locale: "en", hold: false, quietLobby: false, selftest: false, selftestGames: ["mishana", "bluff", "likely", "trivia"] };
  const a = argv.filter((x) => x !== "--");
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    const v = (): string => {
      const x = a[++i];
      if (x === undefined) throw new Error(`${k} needs a value`);
      return x;
    };
    if (k === "--server") o.server = v().replace(/\/$/, "");
    else if (k === "--code") o.code = v().toUpperCase();
    else if (k === "--bots") o.bots = Number(v());
    else if (k === "--delay") o.delay = Number(v());
    else if (k === "--locale") o.locale = v() as Locale;
    else if (k === "--hold") o.hold = true;
    else if (k === "--quiet-lobby") o.quietLobby = true;
    else if (k === "--selftest") o.selftest = true;
    else if (k === "--selftest-games") o.selftestGames = v().split(",");
    else if (k === "--help" || k === "-h") {
      console.log("qa-bots --server URL --code ABCD [--bots 4] [--delay 4000] [--locale en|ar|fr|es] [--hold] [--quiet-lobby] [--selftest [--selftest-games mishana,bluff,likely,trivia]]");
      process.exit(0);
    } else throw new Error(`unknown argument ${k}`);
  }
  if (!o.code && !o.selftest) throw new Error("--code ABCD is required (or --selftest)");
  if (!Number.isInteger(o.bots) || o.bots < 1 || o.bots > 12) throw new Error("--bots must be 1..12");
  if (!Number.isFinite(o.delay) || o.delay < 0) throw new Error("--delay must be ≥ 0 (ms)");
  if (!["en", "ar", "fr", "es"].includes(o.locale)) throw new Error("--locale must be en, ar, fr or es");
  return o;
}

// ---------------------------------------------------------------- content

const NAMES: Record<Locale, readonly string[]> = {
  en: ["Sami", "Lina", "Omar", "Maya", "Karim", "Nour", "Ziad", "Rania", "Tarek", "Yara", "Hadi", "Dina"],
  fr: ["Sami", "Léa", "Omar", "Chloé", "Karim", "Inès", "Hugo", "Rania", "Théo", "Yara", "Lucas", "Manon"],
  es: ["Sami", "Lucía", "Omar", "Sofía", "Karim", "Nuria", "Pablo", "Rania", "Diego", "Yara", "Mateo", "Carmen"],
  ar: ["سامي", "لينا", "عمر", "مايا", "كريم", "نور", "زياد", "رانيا", "طارق", "يارا", "هادي", "دينا"],
};
const LIES: Record<Locale, readonly string[]> = {
  en: ["a goat in pajamas", "my grandmother's jazz band", "under the purple moon", "tiny pickles", "sideways forever", "the uncle who sings", "a cloud made of cheese", "three angry ducks"],
  fr: ["une chèvre en pyjama", "le jazz de mamie", "sous la lune violette", "des petits cornichons", "pour toujours", "un nuage de fromage", "trois canards fâchés"],
  es: ["una cabra en pijama", "el jazz de la abuela", "bajo la luna morada", "pepinillos pequeños", "para siempre", "una nube de queso", "tres patos enfadados"],
  ar: ["قطة بتغني", "تحت القمر", "تيتا بتخبز", "غيمة صغيرة", "زيتون دايماً", "عمو بالمقلوب", "تلات بطات زعلانين"],
};
const GUESSES: Record<Locale, readonly string[]> = {
  en: ["banana", "airport", "coffee", "beach"], fr: ["banane", "aéroport", "café", "plage"],
  es: ["plátano", "aeropuerto", "café", "playa"], ar: ["موز", "مطار", "قهوة", "بحر"],
};

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;
const stamp = (): string => new Date().toTimeString().slice(0, 8);
const log = (s: string): void => console.log(`${stamp()} ${s}`);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- what is on the TV

function nameOf(v: RoomView, id: string | null | undefined): string {
  return v.room.members.find((m) => m.id === id)?.name ?? String(id);
}

/** One line describing the room/game phase (logged once per change). */
export function phaseLabel(v: RoomView): string {
  const r = v.room;
  if (r.phase === "HUB") return `HUB (focused ${r.focusedGameId}, ${r.members.filter((m) => !m.left).length} players)`;
  if (r.phase === "SETUP") return `SETUP ${r.setupGameId}`;
  const g = v.game;
  if (!g) return "PLAYING (no game)";
  const over = g.over ? " [over]" : "";
  switch (g.gameId) {
    case "mishana": {
      const p = g.public as MishanaPublic;
      const spk = (p.phase === "CLUES" || p.phase === "TIE_BREAK") && p.currentSpeakerId ? ` speaker ${nameOf(v, p.currentSpeakerId)}` : "";
      return `[mishana #${g.n}] ${p.phase} round ${p.round}${p.revote ? " (revote)" : ""}${spk}${over}`;
    }
    case "bluff": {
      const p = g.public as BluffPublic;
      return `[bluff #${g.n}] ${p.phase} round ${p.round}/3 prompt ${Math.min(p.promptIndex + 1, p.promptCount)}/${p.promptCount}${over}`;
    }
    case "likely": {
      const p = g.public as LikelyPublic;
      return `[likely #${g.n}] ${p.phase} card ${Math.min(p.cardIndex + 1, p.cardCount)}/${p.cardCount}${over}`;
    }
    case "trivia": {
      const p = g.public as TriviaPublic;
      return `[trivia #${g.n}] ${p.phase} question ${Math.min(p.index + 1, p.total)}/${p.total}${over}`;
    }
  }
}

// ---------------------------------------------------------------- decisions (one per opportunity)

interface Decision { key: string; what: string; a: RoomIntentMsg }
const gameIntent = (gameId: string, i: Record<string, unknown>): RoomIntentMsg => ({ type: "GAME", gameId, i }) as RoomIntentMsg;

function decide(v: RoomView, myId: string, locale: Locale, hold: boolean, quietLobby: boolean): Decision | null {
  if (hold || v.kind !== "player" || !v.me || v.me.benched) return null;
  const r = v.room;
  if (r.phase !== "PLAYING") {
    if (quietLobby) return null;
    const kind = pick(REACTIONS);
    return { key: `lobby:${r.phase}:${r.setupGameId ?? r.focusedGameId}`, what: `REACT ${kind}`, a: { type: "REACT", kind } };
  }
  const g = v.game;
  if (!g || g.over || !g.me) return null;
  switch (g.gameId) {
    case "mishana": {
      const p = g.public as MishanaPublic;
      const me = g.me as MishanaMe;
      const self = p.players.find((x) => x.id === myId);
      const base = `m${g.n}:${p.round}:${p.phase}:${p.revote}`;
      // The Blank guesses right after being voted out, so this check comes before the alive filter.
      if (p.phase === "MR_WHITE_GUESS" && p.guess?.playerId === myId && p.guess.status === "PENDING") {
        const text = pick(GUESSES[locale]);
        return { key: base, what: `SUBMIT_GUESS "${text}"`, a: gameIntent("mishana", { type: "SUBMIT_GUESS", text }) };
      }
      if (!self?.alive || self.left) return null;
      if (p.phase === "ROLE_REVEAL" && !self.ready) return { key: base, what: "READY", a: gameIntent("mishana", { type: "READY" }) };
      if ((p.phase === "CLUES" || p.phase === "TIE_BREAK") && p.currentSpeakerId === myId)
        return { key: `${base}:${p.speakingOrder.join(",")}`, what: "CLUE_DONE", a: gameIntent("mishana", { type: "CLUE_DONE" }) };
      if (p.phase === "VOTING" && me.myVote === null && !self.hasVoted) {
        const targets = p.players.filter((x) => x.alive && !x.left && x.id !== myId && (!p.revote || p.tieCandidates.includes(x.id)));
        if (!targets.length) return null;
        const t = pick(targets);
        return { key: base, what: `CAST_VOTE → ${nameOf(v, t.id)}`, a: gameIntent("mishana", { type: "CAST_VOTE", targetId: t.id }) };
      }
      return null;
    }
    case "bluff": {
      const p = g.public as BluffPublic;
      const me = g.me as BluffMe;
      if (me.waitingForNext || !p.prompt) return null;
      if (p.phase === "WRITING" && me.myLieStatus === "none") {
        const text = pick(LIES[locale]);
        return { key: `b${g.n}:${p.prompt.id}:write:${me.tooCloseCount}`, what: `SUBMIT_LIE "${text}"`, a: gameIntent("bluff", { type: "SUBMIT_LIE", text, promptId: p.prompt.id }) };
      }
      if (p.phase === "VOTING" && !me.spotOn && me.myVote === null) {
        const opts = p.options.filter((o) => !me.myOptionIds.includes(o.id));
        if (!opts.length) return null;
        const o = pick(opts);
        return { key: `b${g.n}:${p.prompt.id}:vote`, what: `VOTE "${o.text}"`, a: gameIntent("bluff", { type: "VOTE", optionId: o.id }) };
      }
      if (p.phase === "VOTING" && me.myVote !== null && me.myLikes.length === 0 && (myId.charCodeAt(myId.length - 1) + p.promptIndex) % 2 === 0) {
        const opts = p.options.filter((o) => !me.myOptionIds.includes(o.id) && o.id !== me.myVote);
        if (!opts.length) return null;
        const o = pick(opts);
        return { key: `b${g.n}:${p.prompt.id}:like`, what: `LIKE "${o.text}"`, a: gameIntent("bluff", { type: "LIKE", optionId: o.id, on: true }) };
      }
      return null;
    }
    case "likely": {
      const p = g.public as LikelyPublic;
      const me = g.me as LikelyMe;
      if (p.phase !== "VOTING" || me.waitingForNext || me.myVote !== null || !p.card) return null;
      const left = new Set(r.members.filter((m) => m.left).map((m) => m.id));
      const targets = p.scores.map((s) => s.playerId).filter((id) => !left.has(id) && r.members.some((m) => m.id === id) && id !== p.card?.namedPlayerId);
      if (!targets.length) return null;
      const t = pick(targets);
      return { key: `l${g.n}:${p.cardIndex}:${p.card.id}`, what: `VOTE → ${nameOf(v, t)}`, a: gameIntent("likely", { type: "VOTE", cardId: p.card.id, targetId: t }) };
    }
    case "trivia": {
      const p = g.public as TriviaPublic;
      const me = g.me as TriviaMe;
      if (p.phase !== "ANSWER" || me.waitingForNext || me.myChoice !== null || p.answeredIds.includes(myId) || !p.question) return null;
      const n = p.options.length || (p.question.type === "tf" ? 2 : 4);
      const choice = Math.floor(Math.random() * n);
      return { key: `t${g.n}:${p.index}:${p.question.id}`, what: `ANSWER ${choice} "${p.options[choice] ?? ""}"`, a: gameIntent("trivia", { type: "ANSWER", choice }) };
    }
  }
  return null;
}

// ---------------------------------------------------------------- one bot phone

class QaBot {
  c: WsClient;
  #pending: { key: string; due: number } | null = null;
  #sent = new Map<string, string>(); // decision key → action id
  #errorsSeen = 0;
  #alive = true;
  #reconnecting = false;
  #timer: ReturnType<typeof setInterval> | null = null;
  lastLabel = "";

  constructor(
    readonly idx: number,
    readonly name: string,
    readonly color: string,
    readonly o: QaArgs,
    readonly wsBase: string,
    readonly code: string,
    readonly onPhase: (bot: QaBot, v: RoomView) => void,
  ) {
    this.c = new WsClient(`bot${idx + 1}`, wsBase, code, (_c, m) => {
      this.onPhase(this, m.view);
      this.tick();
    });
  }

  async start(): Promise<void> {
    await this.c.open();
    await joinAsPlayer(this.c, this.name, this.color, this.o.locale);
    log(`${this.name}: joined room ${this.code} as ${this.c.playerId} (${this.color})`);
    this.#timer = setInterval(() => {
      this.tick();
      if (this.c.ws?.readyState === 1) this.c.sendRaw(PING_FRAME).catch(() => undefined);
    }, 1000);
  }

  stop(): Promise<void> {
    this.#alive = false;
    if (this.#timer) clearInterval(this.#timer);
    return this.c.closeSocket();
  }

  tick(): void {
    if (!this.#alive) return;
    if (this.c.closed && !this.#reconnecting) {
      void this.reconnect();
      return;
    }
    // Rejections: log them and let the decision be retried after another delay.
    while (this.#errorsSeen < this.c.errors.length) {
      const e = this.c.errors[this.#errorsSeen++];
      if (!e) continue;
      for (const [k, id] of this.#sent) if (id === e.ref) this.#sent.delete(k);
      log(`${this.name}: server error ${e.code}${e.ref ? ` (action ${e.ref})` : ""}`);
      this.#pending = null;
    }
    const v = this.c.view;
    const myId = this.c.playerId;
    if (!v || !myId || this.c.closed) return;
    const d = decide(v, myId, this.o.locale, this.o.hold, this.o.quietLobby);
    if (!d || this.#sent.has(d.key)) {
      if (!d) this.#pending = null;
      return;
    }
    if (this.#pending?.key !== d.key) {
      // Staggered so the TV shows partial progress ("2 of 4 voted") between the bots' actions.
      const jitter = Math.floor(Math.random() * Math.max(400, this.o.delay * 0.5)) + Math.floor(this.idx * this.o.delay * 0.3);
      this.#pending = { key: d.key, due: Date.now() + this.o.delay + jitter };
      return;
    }
    if (Date.now() < this.#pending.due) return;
    this.#pending = null;
    this.#sent.set(d.key, "");
    this.c.act(d.a).then(
      (id) => {
        if (this.#sent.get(d.key) === "") this.#sent.set(d.key, id);
        const g = v.game?.gameId ?? v.room.phase;
        log(`  ${g} · ${this.name}: ${d.what}`);
      },
      (e: unknown) => {
        this.#sent.delete(d.key);
        log(`${this.name}: send failed: ${e instanceof Error ? e.message : String(e)}`);
      },
    );
  }

  async reconnect(): Promise<void> {
    this.#reconnecting = true;
    log(`${this.name}: socket closed (${this.c.closed?.code}), reconnecting`);
    for (let attempt = 1; this.#alive; attempt++) {
      try {
        const token = this.c.resumeToken;
        const welcomes = this.c.welcomes;
        this.c.seq = -1;
        this.c.view = null;
        await this.c.open();
        if (token) {
          await this.c.send({ v: 2, t: "hello", role: "player", resumeToken: token });
          await this.c.waitFor(() => this.c.welcomes > welcomes || this.c.errors.length > this.#errorsSeen, "welcome after resume", 15_000);
        }
        if (!token || this.c.welcomes === welcomes) {
          // Resume refused (room forgot us): join again as a new player.
          this.c.playerId = null;
          await this.c.closeSocket();
          this.c.seq = -1;
          this.c.view = null;
          await this.c.open();
          await joinAsPlayer(this.c, this.name, this.color, this.o.locale);
        }
        log(`${this.name}: reconnected as ${this.c.playerId}`);
        this.#reconnecting = false;
        return;
      } catch (e) {
        log(`${this.name}: reconnect attempt ${attempt} failed: ${e instanceof Error ? e.message : String(e)}`);
        await this.c.closeSocket().catch(() => undefined);
        await sleep(Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
      }
    }
    this.#reconnecting = false;
  }
}

// ---------------------------------------------------------------- self-test TV (no real TV needed)

const SELFTEST_SETTINGS: Record<string, Record<string, unknown>> = {
  bluff: { length: "short", pace: "fast" },
  likely: { length: "short" },
  trivia: { length: "short", pace: "fast" },
  mishana: {},
};

/** Plays the TV side: each game once (short settings), advancing phases that stall, then back to the hub. */
async function selftestTv(o: QaArgs, wsBase: string, code: string, tvToken: string, gameIds: string[]): Promise<Record<string, string>> {
  const tv = new WsClient("tv", wsBase, code);
  await tv.open();
  await tv.send({ v: 2, t: "hello", role: "tv", tvToken, games: ALL_TV_GAMES });
  await tv.waitFor(() => tv.view !== null, "TV state", 30_000);
  const results: Record<string, string> = {};
  const stallMs = 3 * o.delay + 8000;
  for (const [gi, gameId] of gameIds.entries()) {
    const key = `${gi + 1}. ${gameId}`;
    const t0 = Date.now();
    let lastSeq = tv.seq;
    let lastChange = Date.now();
    let configured = false;
    let started = false;
    let advances = 0;
    for (;;) {
      if (Date.now() - t0 > 25 * 60_000) {
        results[key] = `TIMEOUT after 25 min (${advances} TV advances)`;
        break;
      }
      const v = tv.view;
      if (!v) throw new Error("TV lost its view");
      if (tv.seq !== lastSeq) {
        lastSeq = tv.seq;
        lastChange = Date.now();
      }
      const r = v.room;
      if (r.phase === "HUB" && !started) {
        await tv.act({ type: "OPEN_GAME", gameId });
        await sleep(1500);
        continue;
      }
      if (r.phase === "SETUP" && !configured) {
        configured = true;
        const patch = SELFTEST_SETTINGS[gameId] ?? {};
        if (Object.keys(patch).length) await tv.act({ type: "UPDATE_GAME_SETTINGS", gameId, patch } as RoomIntentMsg);
        await sleep(1500);
        continue;
      }
      if (r.phase === "SETUP") {
        await sleep(o.delay + 2000); // a moment for the lobby screenshot
        started = true;
        const before = tv.errors.length;
        await tv.act({ type: "START_GAME" });
        await sleep(2000);
        if (tv.errors.length > before) log(`TV: START_GAME refused: ${tv.errors.at(-1)?.code} (startBlocker ${r.setup?.startBlocker})`);
        continue;
      }
      if (r.phase === "PLAYING" && v.game?.over) {
        results[key] = `finished in ${Math.round((Date.now() - t0) / 1000)} s (${advances} TV advances)`;
        await sleep(o.delay + 3000);
        await tv.act({ type: "BACK_TO_HUB" });
        await tv.waitFor(() => tv.view?.room.phase === "HUB", "back to hub", 30_000);
        break;
      }
      if (r.phase === "PLAYING" && Date.now() - lastChange > stallMs) {
        // Phases without a phone action and without a clock (or a slow clock): the TV host advances, like the remote.
        advances++;
        log(`TV: HOST_ADVANCE (${phaseLabel(v)} unchanged for ${Math.round((Date.now() - lastChange) / 1000)} s)`);
        await tv.act(gameIntent(v.game?.gameId ?? gameId, { type: "HOST_ADVANCE" }));
        lastChange = Date.now();
      }
      await sleep(500);
    }
  }
  await tv.closeSocket();
  return results;
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const o = parseQaArgs(process.argv.slice(2));
  const wsBase = o.server.replace(/^http/, "ws");
  let code = o.code;
  let tvToken: string | null = null;
  if (o.selftest) {
    const room = await createRoomHttp(o.server);
    code = room.code;
    tvToken = room.tvToken;
    log(`selftest: created room ${code}`);
  }
  if (!code) throw new Error("no room code");
  log(`qa-bots: ${o.bots} bots → room ${code} on ${o.server} (delay ${o.delay} ms, locale ${o.locale}${o.hold ? ", HOLD" : ""})`);
  const names = NAMES[o.locale];
  let lastLabel = "";
  const bots: QaBot[] = [];
  const onPhase = (bot: QaBot, v: RoomView): void => {
    // The first connected bot narrates what the TV shows.
    const narrator = bots.find((b) => b.c.closed === null && b.c.view !== null);
    if (narrator !== bot) return;
    const l = phaseLabel(v);
    if (l !== lastLabel) {
      lastLabel = l;
      log(`== ${l}`);
    }
  };
  for (let i = 0; i < o.bots; i++) {
    const b = new QaBot(i, names[i] ?? `Bot ${i + 1}`, (COLORS[i] ?? COLORS[0]).id, o, wsBase, code, onPhase);
    bots.push(b);
    await b.start();
    await sleep(400);
  }
  const shutdown = async (): Promise<void> => {
    log("stopping bots");
    await Promise.all(bots.map((b) => b.stop().catch(() => undefined)));
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  // `kill -USR2 <pid>`: drop the first bot's socket (no close handshake) to see the TV's disconnected state and the resume.
  process.on("SIGUSR2", () => {
    log(`${bots[0]?.name}: dropping socket (SIGUSR2)`);
    bots[0]?.c.ws?.terminate();
  });
  if (o.selftest && tvToken) {
    const results = await selftestTv(o, wsBase, code, tvToken, o.selftestGames);
    log("selftest results:");
    for (const [g, r] of Object.entries(results)) log(`  ${g}: ${r}`);
    const problems = bots.flatMap((b) => b.c.problems);
    if (problems.length) log(`client problems:\n  ${problems.slice(0, 20).join("\n  ")}`);
    await shutdown();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
