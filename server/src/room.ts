// Thin Durable Object adapter (§7.5): all behaviour lives in RoomCore. Only this file and index.ts import partyserver.
import { Server } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { PING_FRAME, PONG_FRAME } from "@mishana/shared/constants";
import type { Catalog } from "@mishana/shared/engine";
import { loadCatalog } from "@mishana/shared/packs";
import { PACKS } from "@mishana/word-packs";
import type { Env } from "./env";
import { clientIp, notFound } from "./request";
import { RoomCore } from "./room-core";
import type { ConnHandle, ConnState, InitRoomArgs, InitRoomResult, RoomStorage } from "./room-core";
import { randomBytes, sha256hex } from "./tokens";

// §7.8: built once per isolate, on the first Room access (onStart), so the stateless Worker never pays the
// schema parse. A schema failure throws there; word-packs tests and pack-lint catch it at build time.
let catalog: Catalog | null = null;
function roomCatalog(): Catalog {
  return (catalog ??= loadCatalog(PACKS));
}

export class Room extends Server<Env> {
  static override options = { hibernate: true };

  #core: RoomCore | null = null;

  get #roomCore(): RoomCore {
    if (this.#core === null) {
      const storage = this.ctx.storage;
      const roomStorage: RoomStorage = {
        get: <T>(key: string) => storage.get<T>(key),
        put: (entries: Record<string, unknown>) => storage.put(entries),
        deleteAll: () => storage.deleteAll(),
        getAlarm: () => storage.getAlarm(),
        setAlarm: (at: number) => storage.setAlarm(at),
        deleteAlarm: () => storage.deleteAlarm(),
      };
      this.#core = new RoomCore({
        storage: roomStorage,
        // partyserver lists only OPEN sockets; its Connection already has state/setState/send/close.
        connections: { list: () => [...this.getConnections<ConnState>()] as unknown as ConnHandle[] },
        clock: { now: () => Date.now() },
        crypto: { randomBytes, sha256hex },
        catalog: roomCatalog(),
        debugInvariants: this.env.DEBUG_INVARIANTS === "1",
        roomCode: this.name,
      });
    }
    return this.#core;
  }

  override async onStart(): Promise<void> {
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME));
    await this.#roomCore.start();
  }

  /** Native RPC from the Worker (§7.6). */
  async initRoom(args: InitRoomArgs): Promise<InitRoomResult> {
    return this.#roomCore.initRoom(args);
  }

  override async onConnect(conn: Connection<ConnState>, ctx: ConnectionContext): Promise<void> {
    await this.#roomCore.onConnect(conn as unknown as ConnHandle, {
      url: ctx.request.url,
      ip: clientIp(ctx.request),
    });
  }

  override async onMessage(conn: Connection<ConnState>, msg: WSMessage): Promise<void> {
    await this.#roomCore.onMessage(conn as unknown as ConnHandle, msg);
  }

  override async onClose(conn: Connection<ConnState>): Promise<void> {
    await this.#roomCore.onClose(conn as unknown as ConnHandle);
  }

  override async onAlarm(): Promise<void> {
    await this.#roomCore.onAlarm();
  }

  override onRequest(): Response {
    return notFound();
  }
}
