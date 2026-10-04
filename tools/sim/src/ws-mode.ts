// WS mode (§13.1): plays full games against a running server (`pnpm dev` / `wrangler dev`) through the wire
// protocol only — the M1 "scripted WS client" acceptance test. No Origin header is sent (native-client path).
import WebSocket from "ws";
import { COLORS, PING_FRAME, PONG_FRAME, WS_PATH_PREFIX } from "@mishana/shared/constants";
import type { ClientIntentMsg, ServerMessage, TvView, View } from "@mishana/shared/protocol";
import { CreateRoomResponse, ServerMessageSchema } from "@mishana/shared/protocol";
import { createRng } from "@mishana/shared/engine";
import type { Rng } from "@mishana/shared/engine";
import { FORBIDDEN_KEYS, TIMERS_OFF } from "@mishana/shared/testing";
import type { SimArgs } from "./args";
import { formatColumns } from "./format";

export interface WsGameStats { n: number; games: number; civilians: number; infiltrators: number; blank: number; stalemates: number; resumes: number; failures: string[] }

const STEP_TIMEOUT_MS = 10_000;
const MIN_SEND_GAP_MS = 220; // stay under the 5 msg/s per-connection bucket

function randomCid(): string {
  return crypto.randomUUID();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One protocol client (TV or phone). Validates every server frame with ServerMessageSchema. */
export class WsClient {
  ws: WebSocket | null = null;
  view: View | null = null;
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
    readonly onView?: (c: WsClient, msg: ServerMessage & { t: "state" }) => void,
  ) {}

  async open(): Promise<void> {
    this.closed = null;
    const url = `${this.wsBase}${WS_PATH_PREFIX}${this.code}?_pk=${crypto.randomUUID()}&cid=${randomCid()}`;
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
      const r = ServerMessageSchema.safeParse(parsed);
      if (!r.success) {
        this.problems.push(`${this.label}: frame failed ServerMessageSchema: ${r.error.message.slice(0, 200)}`);
        return;
      }
      const m = r.data;
      if (m.t === "state") {
        if (m.seq < this.seq) this.problems.push(`${this.label}: seq went backwards ${this.seq} → ${m.seq}`);
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

  /** Sends an action with a fresh id; returns the id (echoed as `ref` on errors). */
  async act(a: ClientIntentMsg): Promise<string> {
    const id = `${this.label}-${++this.#actionN}`.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 36);
    await this.send({ v: 1, t: "action", id, a });
    return id;
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

/** §5.4 on a TV state: no secret word, no alive revealed role and no guess text before RESULTS; no forbidden keys. */
export function tvViewProblems(view: TvView, secretWords: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const results = view.phase === "RESULTS";
  // Every state-only key, plus the per-player keys a TV view never carries.
  const forbidden = new Set([...FORBIDDEN_KEYS, "word", "me"]);
  const walk = (x: unknown, path: string): void => {
    if (typeof x === "string") {
      if (!results && secretWords.has(x) && !path.endsWith(".name") && !path.includes(".title.")) out.push(`secret word at ${path}`);
    } else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if (forbidden.has(k)) out.push(`forbidden key ${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    }
  };
  walk(view, "view");
  if (!results) {
    for (const p of view.players) if (p.alive && p.revealedRole !== null) out.push(`alive player ${p.id} has a revealed role`);
    if (view.guess && view.guess.text !== null) out.push("guess.text before RESULTS");
    if (view.result !== null) out.push("result before RESULTS");
  }
  return out;
}

export async function createRoomHttp(httpBase: string): Promise<{ code: string; tvToken: string }> {
  const res = await fetch(`${httpBase}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en" }) });
  if (res.status !== 201) throw new Error(`POST /api/rooms → HTTP ${res.status}`);
  if (res.headers.get("cache-control") !== "no-store") throw new Error("POST /api/rooms response lacks Cache-Control: no-store");
  const body = CreateRoomResponse.parse(await res.json());
  return { code: body.code, tvToken: body.tvToken };
}

interface Table {
  tv: WsClient;
  players: WsClient[];
  secretWords: Set<string>;
  rng: Rng;
  failures: string[];
}

/** Runs `games` consecutive games with `n` bots in one room, including one kill-and-resume mid-game. */
export async function playRoom(httpBase: string, n: number, games: number, args: Pick<SimArgs, "seed" | "winRule" | "tieBreak" | "verbose">, log: (s: string) => void): Promise<WsGameStats> {
  const stats: WsGameStats = { n, games: 0, civilians: 0, infiltrators: 0, blank: 0, stalemates: 0, resumes: 0, failures: [] };
  const wsBase = httpBase.replace(/^http/, "ws");
  const { code, tvToken } = await createRoomHttp(httpBase);
  const t: Table = { tv: null as unknown as WsClient, players: [], secretWords: new Set(), rng: createRng((args.seed * 7919 + n) >>> 0), failures: stats.failures };

  const onTvView = (_c: WsClient, m: { view: View }): void => {
    if (m.view.kind !== "tv") {
      t.failures.push(`TV received a ${m.view.kind} view`);
      return;
    }
    for (const p of tvViewProblems(m.view, t.secretWords)) t.failures.push(`TV §5.4: ${p}`);
  };
  const onPlayerView = (_c: WsClient, m: { view: View }): void => {
    if (m.view.kind !== "player") return;
    const w = m.view.me?.word;
    if (w && m.view.phase !== "RESULTS") {
      t.secretWords.add(w.text);
      if (w.translit) t.secretWords.add(w.translit);
    }
  };

  try {
    // TV
    t.tv = new WsClient("tv", wsBase, code, onTvView);
    await t.tv.open();
    await t.tv.sendRaw(PING_FRAME);
    await t.tv.waitFor(() => t.tv.pongs > 0, "pong");
    await t.tv.send({ v: 1, t: "hello", role: "tv", tvToken });
    await t.tv.waitFor(() => t.tv.view !== null, "TV state");
    await t.tv.act({ type: "UPDATE_SETTINGS", patch: { ...TIMERS_OFF, winRule: args.winRule, tieBreak: args.tieBreak } });

    // Players
    for (let i = 0; i < n; i++) {
      const c = new WsClient(`p${i + 1}`, wsBase, code, onPlayerView);
      await c.open();
      await c.send({ v: 1, t: "hello", role: "player" });
      await c.waitFor(() => c.view !== null, "spectator state");
      if (c.view?.kind !== "player" || c.view.me !== null) t.failures.push(`${c.label}: spectator state should have me:null`);
      await c.send({ v: 1, t: "join", name: `Bot ${i + 1}`, color: (COLORS[i] ?? COLORS[0]).id, locale: "en" });
      await c.waitFor(() => c.playerId !== null, "welcome");
      t.players.push(c);
    }
    await t.tv.waitFor(() => (t.tv.view?.players.length ?? 0) === n, `${n} players in TV view`);

    const finished = new Set<number>();
    let resumed = false;
    let stuck = false;
    for (let steps = 0; steps < 2000; steps++) {
      const v = t.tv.view as TvView;
      if (v.phase === "RESULTS" || (v.phase === "LOBBY" && v.gameNumber > 0)) {
        if (!finished.has(v.gameNumber)) {
          finished.add(v.gameNumber);
          stats.games++;
          if (v.phase === "LOBBY") stats.stalemates++;
          else if (v.result?.winner === "CIVILIANS") stats.civilians++;
          else if (v.result?.winner === "INFILTRATORS") stats.infiltrators++;
          else if (v.result?.winner === "BLANK") stats.blank++;
          if (args.verbose) log(`n=${n} room=${code} game=${v.gameNumber} → ${v.phase === "LOBBY" ? "stalemate" : v.result?.winner}`);
          t.secretWords.clear();
        }
        if (finished.size >= games) break;
      }

      // Kill and resume one player socket in the first CLUES phase of the first game (§13.1).
      if (!resumed && v.phase === "CLUES") {
        resumed = true;
        await killAndResume(t, v);
        stats.resumes++;
        continue;
      }

      const before = t.tv.seq;
      const sent = await stepOnce(t, v, stuck);
      const errorsBefore = sent.client.errors.length;
      await t.tv.waitFor(() => t.tv.seq > before || sent.client.errors.slice(errorsBefore).some((e) => e.ref === sent.id), `state after an action in ${v.phase}`);
      // A rejected bot action (e.g. a race with a phase change) makes the TV advance on the next step instead.
      const rejected = t.tv.seq === before;
      if (rejected && stuck) throw new Error(`TV HOST_ADVANCE rejected in ${v.phase}: ${sent.client.errors.at(-1)?.code}`);
      stuck = rejected;
    }
    if (finished.size < games) t.failures.push(`only ${finished.size}/${games} games finished`);
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

async function killAndResume(t: Table, v: TvView): Promise<void> {
  const victim = t.players.find((c) => c.playerId !== v.currentSpeakerId && v.players.some((p) => p.id === c.playerId && p.alive));
  if (!victim) throw new Error("no resume candidate");
  const pid = victim.playerId;
  const token = victim.resumeToken;
  if (!pid || !token) throw new Error("victim without welcome");
  await victim.closeSocket();
  await t.tv.waitFor(() => t.tv.view?.players.find((p) => p.id === pid)?.connected === false, "victim shown disconnected");
  const welcomesBefore = victim.welcomes;
  victim.playerId = null;
  await victim.open();
  await victim.send({ v: 1, t: "hello", role: "player", resumeToken: token });
  await victim.waitFor(() => victim.welcomes > welcomesBefore, "welcome after resume");
  if (victim.playerId !== pid) throw new Error(`resume gave playerId ${victim.playerId}, expected ${pid}`);
  if (victim.resumeToken !== token) throw new Error("resume changed the token");
  await t.tv.waitFor(() => t.tv.view?.players.find((p) => p.id === pid)?.connected === true, "victim shown connected again");
  await victim.waitFor(() => victim.view?.kind === "player" && victim.view.me?.id === pid, "resumed player view");
}

function clientFor(t: Table, playerId: string | null): WsClient | undefined {
  return playerId === null ? undefined : t.players.find((c) => c.playerId === playerId && c.closed === null);
}

/** Issues exactly one action that should change the state. `stuck` → the TV advances. */
async function stepOnce(t: Table, v: TvView, stuck: boolean): Promise<{ client: WsClient; id: string }> {
  const tv = t.tv;
  const pick = <T>(xs: readonly T[]): T | undefined => (xs.length ? xs[t.rng.int(xs.length)] : undefined);
  switch (v.phase) {
    case "LOBBY":
      return { client: tv, id: await tv.act({ type: "START" }) };
    case "RESULTS":
      return { client: tv, id: await tv.act({ type: "PLAY_AGAIN" }) };
    case "ROLE_REVEAL": {
      const p = pick(v.players.filter((x) => x.connected && !x.left && !x.ready));
      const c = p ? clientFor(t, p.id) : undefined;
      if (c && !stuck) return { client: c, id: await c.act({ type: "READY" }) };
      else return { client: tv, id: await tv.act({ type: "HOST_ADVANCE" }) };
    }
    case "CLUES":
    case "TIE_BREAK": {
      const c = clientFor(t, v.currentSpeakerId);
      if (c && !stuck && t.rng.next() > 0.05) return { client: c, id: await c.act({ type: "CLUE_DONE" }) };
      else return { client: tv, id: await tv.act({ type: "HOST_ADVANCE" }) };
    }
    case "VOTING": {
      const voters = v.players.filter((p) => p.alive && !p.left && p.connected && !p.hasVoted);
      const voter = pick(voters);
      const c = voter ? clientFor(t, voter.id) : undefined;
      if (voter && c && !stuck) {
        const targets = v.players.filter((p) => p.alive && !p.left && p.id !== voter.id && (!v.revote || v.tieCandidates.includes(p.id)));
        const target = pick(targets);
        if (target) {
          return { client: c, id: await c.act({ type: "CAST_VOTE", targetId: target.id }) };
        }
      }
      return { client: tv, id: await tv.act({ type: "HOST_ADVANCE" }) };
    }
    case "ELIMINATION":
      return { client: tv, id: await tv.act({ type: "HOST_ADVANCE" }) };
    case "MR_WHITE_GUESS": {
      const g = v.guess;
      const c = g ? clientFor(t, g.playerId) : undefined;
      if (g?.status === "PENDING" && c && !stuck) {
        // 30%: the word most bots hold (the civilian word); otherwise a string that matches no word.
        const counts = new Map<string, number>();
        for (const pc of t.players) {
          const w = pc.view?.kind === "player" ? pc.view.me?.word?.text : undefined;
          if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
        }
        const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const text = majority && t.rng.next() < 0.3 ? majority : `zzwrong${t.rng.int(1_000_000)}`;
        return { client: c, id: await c.act({ type: "SUBMIT_GUESS", text }) };
      } else {
        return { client: tv, id: await tv.act({ type: "HOST_ADVANCE" }) };
      }
    }
  }
}

export async function runWsMode(args: SimArgs, log: (s: string) => void = console.log): Promise<WsGameStats[]> {
  const httpBase = (args.ws ?? "").replace(/\/$/, "");
  const health = await fetch(`${httpBase}/healthz`).catch((e: unknown) => {
    throw new Error(`cannot reach ${httpBase}/healthz: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!health.ok) throw new Error(`${httpBase}/healthz → HTTP ${health.status}`);
  const rows: WsGameStats[] = [];
  for (const n of args.players) rows.push(await playRoom(httpBase, n, args.games, args, log));
  return rows;
}

export function formatWsTable(rows: WsGameStats[]): string {
  const header = ["n", "games", "civilians", "infiltrators", "blank", "stalemates", "resumes", "failures"];
  const lines = rows.map((r) => [r.n, r.games, r.civilians, r.infiltrators, r.blank, r.stalemates, r.resumes, r.failures.length].map(String));
  return formatColumns(header, lines);
}
