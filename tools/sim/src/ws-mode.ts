// WS mode (JAMAA-PLATFORM §2.9 `--ws`): plays full Mish Ana! games against a running server (`pnpm dev` / `wrangler
// dev`) through protocol v2 only: hub → OPEN_GAME → setup → START_GAME → GAME intents → REPLAY, and once BACK_TO_HUB
// and back in. One player socket is killed and resumed mid-game, and one late joiner arrives while PLAYING (benched,
// then dealt in at the next instance). Every server frame is validated with ServerMessageV2Schema; every TV frame is
// checked for secrets, every phone frame for other players' secrets (§5.4), and every opening speaking order for the
// Blank-never-first rule. No Origin header is sent (native-client path).
import WebSocket from "ws";
import { COLORS, PING_FRAME, PONG_FRAME, WS_PATH_PREFIX } from "@jamaa/shared/constants";
import { CreateRoomResponse } from "@jamaa/shared/protocol";
import { HealthzV2, ServerMessageV2Schema } from "@jamaa/shared/protocol/v2";
import type { RoomIntentMsg, RoomView, ServerMessageV2, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { MishanaMe, MishanaPublic } from "@jamaa/shared/games/mishana/protocol";
import { createRng } from "@jamaa/shared/engine";
import type { Rng } from "@jamaa/shared/engine";
import { ALL_TV_GAMES, FORBIDDEN_KEYS, ROOM_FORBIDDEN_KEYS, TIMERS_OFF } from "@jamaa/shared/testing";
import type { SimArgs } from "./args";
import { formatColumns } from "./format";

export interface WsGameStats { n: number; games: number; civilians: number; infiltrators: number; blank: number; stalemates: number; resumes: number; lateJoins: number; blanksDealt: number; openingsChecked: number; failures: string[] }

const STEP_TIMEOUT_MS = 10_000;
const MIN_SEND_GAP_MS = 220; // stay under the 5 msg/s per-connection bucket

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** The Mish Ana! public part of a view (null outside a Mish Ana! instance). */
export function mishanaPub(v: RoomView | null): MishanaPublic | null {
  return v?.game?.gameId === "mishana" ? (v.game.public as MishanaPublic) : null;
}

/** One protocol client (TV or phone). Validates every server frame with ServerMessageV2Schema. */
export class WsClient {
  ws: WebSocket | null = null;
  view: RoomView | null = null;
  seq = -1;
  playerId: string | null = null;
  resumeToken: string | null = null;
  errors: { code: string; ref: string | null }[] = [];
  closed: { code: number } | null = null;
  welcomes = 0;
  pongs = 0;
  problems: string[] = [];
  #lastSend = 0;
  #waiters: (() => void)[] = [];
  #actionN = 0;

  constructor(
    readonly label: string,
    readonly wsBase: string,
    readonly code: string,
    readonly onView?: (c: WsClient, msg: ServerMessageV2 & { t: "state" }) => void,
  ) {}

  async open(): Promise<void> {
    this.closed = null;
    const url = `${this.wsBase}${WS_PATH_PREFIX}${this.code}?_pk=${crypto.randomUUID()}&cid=${crypto.randomUUID()}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        this.problems.push(`${this.label}: binary frame from server`);
        return;
      }
      const text = data.toString();
      if (text === PONG_FRAME) {
        this.pongs++;
        this.#notify();
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        this.problems.push(`${this.label}: unparseable frame`);
        return;
      }
      const r = ServerMessageV2Schema.safeParse(parsed);
      if (!r.success) {
        this.problems.push(`${this.label}: frame failed ServerMessageV2Schema: ${r.error.message.slice(0, 200)}`);
        return;
      }
      const m = r.data;
      if (m.t === "state") {
        if (m.seq <= this.seq) this.problems.push(`${this.label}: seq did not increase ${this.seq} → ${m.seq}`);
        this.seq = m.seq;
        this.view = m.view;
        this.onView?.(this, m);
      } else if (m.t === "welcome") {
        this.welcomes++;
        this.playerId = m.playerId;
        this.resumeToken = m.resumeToken;
      } else if (m.t === "error") {
        this.errors.push({ code: m.code, ref: m.ref });
      }
      this.#notify();
    });
    ws.on("close", (code) => {
      this.closed = { code };
      this.#notify();
    });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (e) => reject(e));
      ws.once("unexpected-response", (_req, res) => reject(new Error(`${this.label}: upgrade failed with HTTP ${res.statusCode}`)));
    });
  }

  async sendRaw(text: string): Promise<void> {
    const wait = this.#lastSend + MIN_SEND_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.#lastSend = Date.now();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error(`${this.label}: socket not open`);
    this.ws.send(text);
  }

  send(msg: object): Promise<void> {
    return this.sendRaw(JSON.stringify(msg));
  }

  /** Sends a v2 room intent with a fresh id; returns the id (echoed as `ref` on errors). */
  async act(a: RoomIntentMsg): Promise<string> {
    const id = `${this.label}-${++this.#actionN}`.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 36);
    await this.send({ v: 2, t: "action", id, a });
    return id;
  }

  /** A Mish Ana! in-game intent. */
  game(i: Record<string, unknown>): Promise<string> {
    return this.act({ type: "GAME", gameId: "mishana", i } as RoomIntentMsg);
  }

  closeSocket(): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve) => {
      ws.once("close", () => resolve());
      ws.close(1000, "bye");
    });
  }

  #notify(): void {
    const ws = this.#waiters;
    this.#waiters = [];
    for (const w of ws) w();
  }

  /** Resolves when `pred()` holds (checked after every frame), rejects after `timeoutMs`. */
  waitFor(pred: () => boolean, what: string, timeoutMs = STEP_TIMEOUT_MS): Promise<void> {
    if (pred()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.label}: timed out waiting for ${what}`)), timeoutMs);
      const check = (): void => {
        if (pred()) {
          clearTimeout(timer);
          resolve();
        } else this.#waiters.push(check);
      };
      this.#waiters.push(check);
    });
  }
}

/**
 * SPEC §5.4 on a v2 TV frame: no secret word, no state-only key (room or game), no `me` anywhere, and before the
 * instance is over no alive revealed role, no guess text and no result.
 */
export function tvViewProblems(view: TvRoomView, secretWords: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const over = view.game?.over ?? false;
  if (view.me !== null) out.push("TV view has a room me");
  if (view.game && view.game.me !== null) out.push("TV view has a game me");
  const forbidden = new Set([...FORBIDDEN_KEYS, ...ROOM_FORBIDDEN_KEYS, "word"]);
  const walk = (x: unknown, path: string): void => {
    if (typeof x === "string") {
      if (!over && secretWords.has(x) && !path.endsWith(".name") && !path.includes(".title.")) out.push(`secret word at ${path}`);
    } else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if (forbidden.has(k)) out.push(`forbidden key ${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    }
  };
  walk(view, "view");
  const pub = mishanaPub(view);
  if (pub && !over) {
    for (const p of pub.players) if (p.alive && p.revealedRole !== null) out.push(`alive player ${p.id} has a revealed role`);
    if (pub.guess && pub.guess.text !== null) out.push("guess.text before RESULTS");
    if (pub.result !== null) out.push("result before RESULTS");
  }
  return out;
}

/** What one phone learned about its own secrets in one instance (from its own `game.me`). */
export interface DealtSecret { word: { text: string; translit: string | null } | null; role: string | null; isBlank: boolean }

/**
 * SPEC §5.4 on a v2 phone frame: `game.me` is the viewer's own, no alive player's role is revealed before the instance
 * is over, and no other player's secret word that differs from the viewer's own appears anywhere in the frame.
 * `dealt` holds every player's own secrets for this instance (player id → secret).
 */
export function playerViewProblems(view: RoomView, viewerId: string, dealt: ReadonlyMap<string, DealtSecret>): string[] {
  const out: string[] = [];
  if (view.kind !== "player" || !view.game || view.game.gameId !== "mishana" || view.game.over) return out;
  const me = view.game.me as MishanaMe | null;
  if (me && me.id !== viewerId) out.push(`game.me is ${me.id}, not the viewer`);
  const own = new Set([me?.word?.text, me?.word?.translit].filter((x): x is string => !!x));
  const foreign = new Set<string>();
  for (const [id, d] of dealt) {
    if (id === viewerId || !d.word) continue;
    for (const w of [d.word.text, d.word.translit]) if (w && !own.has(w)) foreign.add(w);
  }
  const walk = (x: unknown, path: string): void => {
    if (typeof x === "string") {
      if (foreign.has(x) && !path.endsWith(".name") && !path.includes(".title.")) out.push(`another player's word at ${path}`);
    } else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
  };
  if (foreign.size > 0) walk(view, "view");
  const pub = mishanaPub(view);
  if (pub) for (const p of pub.players) if (p.alive && p.revealedRole !== null) out.push(`alive player ${p.id} has a revealed role`);
  return out;
}

/**
 * The Blank never speaks first (turns.ts openingOrder), unless no non-Blank can open that pass: no alive one in CLUES,
 * no tie candidate in TIE_BREAK (two tied Blanks).
 */
export function blankOpensProblem(pub: MishanaPublic, dealt: ReadonlyMap<string, DealtSecret>): string | null {
  const first = pub.speakingOrder[0];
  if (first === undefined || dealt.get(first)?.isBlank !== true) return null;
  const pool = pub.phase === "TIE_BREAK" ? pub.tieCandidates : pub.players.filter((p) => p.alive && !p.left).map((p) => p.id);
  if (!pool.some((id) => dealt.get(id) !== undefined && dealt.get(id)?.isBlank !== true)) return null;
  return `the Blank ${first} opens ${pub.phase} (round ${pub.round})`;
}

export async function createRoomHttp(httpBase: string): Promise<{ code: string; tvToken: string }> {
  const res = await fetch(`${httpBase}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en" }) });
  if (res.status !== 201) throw new Error(`POST /api/rooms → HTTP ${res.status}`);
  if (res.headers.get("cache-control") !== "no-store") throw new Error("POST /api/rooms response lacks Cache-Control: no-store");
  const body = CreateRoomResponse.parse(await res.json());
  return { code: body.code, tvToken: body.tvToken };
}

interface Table {
  wsBase: string;
  code: string;
  tv: WsClient;
  players: WsClient[];
  secretWords: Set<string>;
  rng: Rng;
  failures: string[];
  onPlayerView: (c: WsClient, m: { view: RoomView }) => void;
  /** game.n → player id → that player's own secrets, as its phone saw them. */
  dealt: Map<number, Map<string, DealtSecret>>;
}

const member = (v: RoomView | null, id: string | null) => v?.room.members.find((m) => m.id === id);

async function newPlayer(t: Table, i: number): Promise<WsClient> {
  const c = new WsClient(`p${i + 1}`, t.wsBase, t.code, t.onPlayerView);
  await c.open();
  await c.send({ v: 2, t: "hello", role: "player" });
  await c.waitFor(() => c.view !== null, "spectator state");
  if (c.view?.kind !== "player" || c.view.me !== null) t.failures.push(`${c.label}: spectator state should have me:null`);
  await c.send({ v: 2, t: "join", name: `Bot ${i + 1}`, color: (COLORS[i] ?? COLORS[0]).id, locale: "en" });
  await c.waitFor(() => c.playerId !== null, "welcome");
  return c;
}

/** Runs `games` instances with `n` bots in one room: one kill-and-resume, one late joiner, one trip back to the hub. */
export async function playRoom(httpBase: string, n: number, games: number, args: Pick<SimArgs, "seed" | "winRule" | "tieBreak" | "verbose">, log: (s: string) => void): Promise<WsGameStats> {
  const stats: WsGameStats = { n, games: 0, civilians: 0, infiltrators: 0, blank: 0, stalemates: 0, resumes: 0, lateJoins: 0, blanksDealt: 0, openingsChecked: 0, failures: [] };
  const openings = new Set<string>();
  const wsBase = httpBase.replace(/^http/, "ws");
  const { code, tvToken } = await createRoomHttp(httpBase);
  const t: Table = {
    wsBase, code, tv: null as unknown as WsClient, players: [], secretWords: new Set(), rng: createRng((args.seed * 7919 + n) >>> 0), failures: stats.failures,
    dealt: new Map(),
    onPlayerView: (c, m) => {
      if (m.view.kind !== "player" || !m.view.game || m.view.game.gameId !== "mishana" || m.view.game.over) return;
      const me = m.view.game.me as MishanaMe | null;
      let dealt = t.dealt.get(m.view.game.n);
      if (!dealt) t.dealt.set(m.view.game.n, (dealt = new Map()));
      if (me && c.playerId && me.id === c.playerId) {
        const prev = dealt.get(me.id);
        if (!prev && me.isBlank) stats.blanksDealt++;
        dealt.set(me.id, { word: me.word, role: me.role, isBlank: me.isBlank });
      }
      if (c.playerId) for (const p of playerViewProblems(m.view, c.playerId, dealt)) t.failures.push(`${c.label} §5.4: ${p}`);
      const w = me?.word;
      if (w) {
        t.secretWords.add(w.text);
        if (w.translit) t.secretWords.add(w.translit);
      }
    },
  };
  const onTvView = (_c: WsClient, m: { view: RoomView }): void => {
    if (m.view.kind !== "tv") {
      t.failures.push(`TV received a ${m.view.kind} view`);
      return;
    }
    for (const p of tvViewProblems(m.view, t.secretWords)) t.failures.push(`TV §5.4: ${p}`);
    // Blank-first rule, at the first frame of each speaking pass (CLUES or TIE_BREAK) of each instance and round.
    const pub = mishanaPub(m.view);
    if (pub && m.view.game && !m.view.game.over && (pub.phase === "CLUES" || pub.phase === "TIE_BREAK")) {
      const key = `${m.view.game.n}/${pub.round}/${pub.phase}/${pub.revote}`;
      if (!openings.has(key)) {
        openings.add(key);
        stats.openingsChecked++;
        const p = blankOpensProblem(pub, t.dealt.get(m.view.game.n) ?? new Map());
        if (p) t.failures.push(`Blank-first rule: ${p}`);
      }
    }
  };

  try {
    t.tv = new WsClient("tv", wsBase, code, onTvView);
    await t.tv.open();
    await t.tv.sendRaw(PING_FRAME);
    await t.tv.waitFor(() => t.tv.pongs > 0, "pong");
    await t.tv.send({ v: 2, t: "hello", role: "tv", tvToken, games: ALL_TV_GAMES });
    await t.tv.waitFor(() => t.tv.view !== null, "TV state");
    if (t.tv.view?.room.phase !== "HUB") t.failures.push(`a new room starts in ${t.tv.view?.room.phase}, not HUB`);
    if (!t.tv.view?.room.games.some((g) => g.id === "mishana")) throw new Error("mishana is not offered in room.games");
    for (let i = 0; i < n; i++) t.players.push(await newPlayer(t, i));
    await t.tv.waitFor(() => (t.tv.view?.room.members.length ?? 0) === n, `${n} members in TV view`);

    const finished = new Set<number>();
    let resumed = false;
    let late: WsClient | null = null;
    let lateInstance = 0;
    let hubTrip = false;
    let configured = false;
    let stuck = false;
    for (let steps = 0; steps < 3000; steps++) {
      const v = t.tv.view as TvRoomView;
      const room = v.room;
      const pub = mishanaPub(v);
      // The late joiner is dealt in by the first instance after the one it joined.
      if (late && v.game && v.game.n > lateInstance && member(v, late.playerId)?.benched === true) t.failures.push("late joiner still benched in a new instance");
      if (late && v.game && v.game.n > lateInstance && !t.players.includes(late)) {
        t.players.push(late);
        await late.waitFor(() => late?.view?.game?.me !== null && late?.view?.game?.n === v.game?.n, "late joiner dealt in");
      }
      if (room.phase === "PLAYING" && v.game?.over && pub) {
        if (!finished.has(v.game.n)) {
          finished.add(v.game.n);
          stats.games++;
          if (pub.result?.winner === "CIVILIANS") stats.civilians++;
          else if (pub.result?.winner === "INFILTRATORS") stats.infiltrators++;
          else if (pub.result?.winner === "BLANK") stats.blank++;
          if (args.verbose) log(`n=${n} room=${code} game=${v.game.n} → ${pub.result?.winner}`);
          t.secretWords.clear();
        }
        if (finished.size >= games) break;
      }
      // Kill and resume one player socket in the first CLUES phase (SPEC §13.1).
      if (!resumed && pub?.phase === "CLUES") {
        resumed = true;
        await killAndResume(t, pub);
        stats.resumes++;
        continue;
      }
      // One late joiner while PLAYING: benched (public game view, no game me) until the next instance.
      if (!late && resumed && pub && !v.game?.over && room.members.length < 12) {
        late = await newPlayer(t, n);
        lateInstance = v.game?.n ?? 0;
        stats.lateJoins++;
        await late.waitFor(() => late?.view?.me?.benched === true || (late?.view?.game?.me ?? null) !== null, "late joiner view");
        if (late.view?.me?.benched !== true) t.failures.push("a member who joined while PLAYING is not benched");
        if (late.view?.game?.me) t.failures.push("a benched member received a game me");
        continue;
      }
      const before = t.tv.seq;
      let sent: { client: WsClient; id: string };
      if (room.phase === "HUB") sent = { client: t.tv, id: await t.tv.act({ type: "OPEN_GAME", gameId: "mishana" }) };
      else if (room.phase === "SETUP" && !configured) {
        configured = true;
        sent = { client: t.tv, id: await t.tv.act({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { ...TIMERS_OFF, winRule: args.winRule, tieBreak: args.tieBreak } } as RoomIntentMsg) };
      } else if (room.phase === "SETUP") sent = { client: t.tv, id: await t.tv.act({ type: "START_GAME" }) };
      else if (v.game?.over) {
        // Once: back to the hub and in again; otherwise REPLAY.
        if (!hubTrip && finished.size === 1) {
          hubTrip = true;
          sent = { client: t.tv, id: await t.tv.act({ type: "BACK_TO_HUB" }) };
        } else sent = { client: t.tv, id: await t.tv.act({ type: "REPLAY" }) };
      } else if (pub) sent = await stepOnce(t, v, pub, stuck);
      else throw new Error(`unexpected view: phase ${room.phase}, game ${v.game?.gameId ?? "none"}`);
      const errorsBefore = sent.client.errors.length;
      await t.tv.waitFor(() => t.tv.seq > before || sent.client.errors.slice(errorsBefore).some((e) => e.ref === sent.id), `state after an action in ${pub?.phase ?? room.phase}`);
      const rejected = t.tv.seq === before;
      if (rejected && stuck) throw new Error(`TV action rejected in ${pub?.phase ?? room.phase}: ${sent.client.errors.at(-1)?.code}`);
      stuck = rejected;
    }
    if (finished.size < games) t.failures.push(`only ${finished.size}/${games} games finished`);
    if ((t.tv.view?.room.cup.last?.n ?? 0) < finished.size) t.failures.push("the cup did not record every finished instance");
  } catch (e) {
    t.failures.push(e instanceof Error ? e.message : String(e));
  } finally {
    for (const c of [t.tv, ...t.players]) {
      if (!c) continue;
      for (const p of c.problems) t.failures.push(p);
      await c.closeSocket().catch(() => undefined);
    }
  }
  stats.failures = t.failures.map((f) => `n=${n} room=${code}: ${f}`);
  return stats;
}

async function killAndResume(t: Table, pub: MishanaPublic): Promise<void> {
  const victim = t.players.find((c) => c.playerId !== pub.currentSpeakerId && pub.players.some((p) => p.id === c.playerId && p.alive));
  if (!victim) throw new Error("no resume candidate");
  const pid = victim.playerId;
  const token = victim.resumeToken;
  if (!pid || !token) throw new Error("victim without welcome");
  await victim.closeSocket();
  await t.tv.waitFor(() => member(t.tv.view, pid)?.connected === false, "victim shown disconnected");
  const welcomesBefore = victim.welcomes;
  victim.playerId = null;
  victim.seq = -1;
  await victim.open();
  await victim.send({ v: 2, t: "hello", role: "player", resumeToken: token });
  await victim.waitFor(() => victim.welcomes > welcomesBefore, "welcome after resume");
  if (victim.playerId !== pid) throw new Error(`resume gave playerId ${victim.playerId}, expected ${pid}`);
  if (victim.resumeToken !== token) throw new Error("resume changed the token");
  await t.tv.waitFor(() => member(t.tv.view, pid)?.connected === true, "victim shown connected again");
  await victim.waitFor(() => victim.view?.kind === "player" && victim.view.me?.id === pid, "resumed player view");
}

function clientFor(t: Table, playerId: string | null): WsClient | undefined {
  return playerId === null ? undefined : t.players.find((c) => c.playerId === playerId && c.closed === null);
}

/** Issues exactly one in-game action that should change the state. `stuck` → the TV advances. */
async function stepOnce(t: Table, v: TvRoomView, pub: MishanaPublic, stuck: boolean): Promise<{ client: WsClient; id: string }> {
  const tv = t.tv;
  const pick = <T>(xs: readonly T[]): T | undefined => (xs.length ? xs[t.rng.int(xs.length)] : undefined);
  const advance = async (): Promise<{ client: WsClient; id: string }> => ({ client: tv, id: await tv.game({ type: "HOST_ADVANCE" }) });
  const connected = (id: string): boolean => member(v, id)?.connected === true;
  switch (pub.phase) {
    case "ROLE_REVEAL": {
      const p = pick(pub.players.filter((x) => connected(x.id) && !x.left && !x.ready));
      const c = p ? clientFor(t, p.id) : undefined;
      return c && !stuck ? { client: c, id: await c.game({ type: "READY" }) } : advance();
    }
    case "CLUES":
    case "TIE_BREAK": {
      const c = clientFor(t, pub.currentSpeakerId);
      return c && !stuck && t.rng.next() > 0.05 ? { client: c, id: await c.game({ type: "CLUE_DONE" }) } : advance();
    }
    case "VOTING": {
      const voter = pick(pub.players.filter((p) => p.alive && !p.left && connected(p.id) && !p.hasVoted));
      const c = voter ? clientFor(t, voter.id) : undefined;
      if (voter && c && !stuck) {
        const target = pick(pub.players.filter((p) => p.alive && !p.left && p.id !== voter.id && (!pub.revote || pub.tieCandidates.includes(p.id))));
        if (target) return { client: c, id: await c.game({ type: "CAST_VOTE", targetId: target.id }) };
      }
      return advance();
    }
    case "MR_WHITE_GUESS": {
      const g = pub.guess;
      const c = g ? clientFor(t, g.playerId) : undefined;
      if (g?.status === "PENDING" && c && !stuck) {
        // 30%: the word most bots hold (the civilian word); otherwise a string that matches no word.
        const counts = new Map<string, number>();
        for (const pc of t.players) {
          const w = (pc.view?.game?.me as MishanaMe | null | undefined)?.word?.text;
          if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
        }
        const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const text = majority && t.rng.next() < 0.3 ? majority : `zzwrong${t.rng.int(1_000_000)}`;
        return { client: c, id: await c.game({ type: "SUBMIT_GUESS", text }) };
      }
      return advance();
    }
    default:
      return advance();
  }
}

export async function runWsMode(args: SimArgs, log: (s: string) => void = console.log): Promise<WsGameStats[]> {
  const httpBase = (args.ws ?? "").replace(/\/$/, "");
  const health = await fetch(`${httpBase}/healthz`).catch((e: unknown) => {
    throw new Error(`cannot reach ${httpBase}/healthz: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!health.ok) throw new Error(`${httpBase}/healthz → HTTP ${health.status}`);
  const h = HealthzV2.safeParse(await health.json());
  if (!h.success) throw new Error(`${httpBase}/healthz is not a protocol-2 JAMAA server`);
  const rows: WsGameStats[] = [];
  for (const n of args.players.filter((x) => x >= 3)) rows.push(await playRoom(httpBase, n, args.games, args, log));
  return rows;
}

export function formatWsTable(rows: WsGameStats[]): string {
  const header = ["n", "games", "civilians", "infiltrators", "blank", "stalemates", "resumes", "late joins", "blanks dealt", "openings checked", "failures"];
  const lines = rows.map((r) => [r.n, r.games, r.civilians, r.infiltrators, r.blank, r.stalemates, r.resumes, r.lateJoins, r.blanksDealt, r.openingsChecked, r.failures.length].map(String));
  return formatColumns(header, lines);
}
