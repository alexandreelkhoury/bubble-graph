// JAMAA-PLATFORM §7.4: alert evaluation (one notification per incident) and the hourly cron (log line + email).
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALERT_DEFAULTS, alertConfig, estimateRequests, evaluateAlerts, REQUESTS_PER_PLAYER, REQUESTS_PER_ROOM } from "../../src/monitor/alerts";
import type { AlertIncident, AlertResult } from "../../src/monitor/alerts";
import { alertMailReady, runMonitorCron } from "../../src/monitor/notify";
import type { StatsApi } from "../../src/monitor/stats-api";
import { fakeEnv } from "../support/env";

const T0 = Date.UTC(2026, 10, 15, 10, 23);
const H = 3_600_000;
const m = (server = 0, client = 0, rooms = 0) => ({ lastHour: { server_errors: server, client_errors: client }, today: { rooms_created: rooms } });

afterEach(() => vi.restoreAllMocks());

describe("evaluateAlerts", () => {
  it("opens an incident once, stays silent while firing, closes below the threshold", () => {
    const r1 = evaluateAlerts({}, m(25), T0, ALERT_DEFAULTS);
    expect(r1.notify.map((i) => i.key)).toEqual(["server_errors"]);
    const r2 = evaluateAlerts(r1.incidents, m(40), T0 + H, ALERT_DEFAULTS);
    expect(r2.notify).toEqual([]);
    expect(r2.incidents.server_errors).toMatchObject({ value: 40, lastSeenAt: T0 + H, closedAt: null, notifiedAt: T0 });
    const r3 = evaluateAlerts(r2.incidents, m(1), T0 + 2 * H, ALERT_DEFAULTS);
    expect(r3.open).toEqual([]);
    expect(r3.incidents.server_errors!.closedAt).toBe(T0 + 2 * H);
  });

  it("a flapping rule is not re-notified inside the renotify window, then is", () => {
    let inc: Record<string, AlertIncident> = evaluateAlerts({}, m(0, 60), T0, ALERT_DEFAULTS).incidents;
    inc = evaluateAlerts(inc, m(0, 0), T0 + H, ALERT_DEFAULTS).incidents;
    const again = evaluateAlerts(inc, m(0, 60), T0 + 2 * H, ALERT_DEFAULTS);
    expect(again.notify).toEqual([]);
    expect(again.open).toHaveLength(1);
    inc = evaluateAlerts(again.incidents, m(0, 0), T0 + 3 * H, ALERT_DEFAULTS).incidents;
    expect(evaluateAlerts(inc, m(0, 60), T0 + 7 * H, ALERT_DEFAULTS).notify.map((i) => i.rule)).toEqual(["client_errors"]);
  });

  it("quota: today's estimate vs the plan quota, one incident per UTC day", () => {
    const rooms = Math.ceil((ALERT_DEFAULTS.dailyRequests * ALERT_DEFAULTS.quotaRatio) / REQUESTS_PER_ROOM);
    const r1 = evaluateAlerts({}, m(0, 0, rooms), T0, ALERT_DEFAULTS);
    expect(r1.notify.map((i) => i.key)).toEqual(["quota:2026-11-15"]);
    const r2 = evaluateAlerts(r1.incidents, m(0, 0, rooms), T0 + 24 * H, ALERT_DEFAULTS);
    expect(r2.incidents["quota:2026-11-15"]!.closedAt).toBe(T0 + 24 * H);
    expect(r2.notify.map((i) => i.key)).toEqual(["quota:2026-11-16"]); // a new day is a new incident
  });

  it("a 0 threshold turns the rule off", () => {
    expect(evaluateAlerts({}, m(1000), T0, { ...ALERT_DEFAULTS, serverErrorsPerHour: 0 }).notify).toEqual([]);
  });

  it("estimateRequests and alertConfig parsing", () => {
    expect(estimateRequests({ rooms_created: 2, players_joined: 3, client_errors: 5 })).toBe(2 * REQUESTS_PER_ROOM + 3 * REQUESTS_PER_PLAYER + 5);
    expect(alertConfig({})).toEqual(ALERT_DEFAULTS);
    expect(alertConfig({ ALERT_SERVER_ERRORS_PER_HOUR: "5", PLAN_DAILY_REQUESTS: "10000000", ALERT_QUOTA_RATIO: "2", ALERT_CLIENT_ERRORS_PER_HOUR: "x" }))
      .toMatchObject({ serverErrorsPerHour: 5, dailyRequests: 10_000_000, quotaRatio: ALERT_DEFAULTS.quotaRatio, clientErrorsPerHour: ALERT_DEFAULTS.clientErrorsPerHour });
  });
});

describe("runMonitorCron", () => {
  const incident: AlertIncident = { key: "server_errors", rule: "server_errors", openedAt: T0, lastSeenAt: T0, closedAt: null, value: 30, threshold: 20, notifiedAt: T0 };
  const stats = (r: AlertResult): StatsApi => ({ ingest: async () => undefined, snapshot: async () => { throw new Error("unused"); }, evaluate: async () => r });

  it("logs one ALERT line and sends one email per new incident when email is set up", async () => {
    const send = vi.fn(async (_msg: unknown) => ({ messageId: "x" }));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = fakeEnv({ ALERT_MAILER: { send } as unknown as SendEmail, ALERT_EMAIL: "owner@example.com", ALERT_EMAIL_FROM: "alerts@example.com" });
    expect(alertMailReady(env)).toBe(true);
    await runMonitorCron(env, stats({ incidents: { server_errors: incident }, notify: [incident], open: [incident] }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "owner@example.com", from: "alerts@example.com", subject: expect.stringContaining("30 server errors") });
    expect(err.mock.calls.map((c) => JSON.parse(String(c[0])).code)).toEqual(["ALERT"]);
    send.mockClear();
    await runMonitorCron(env, stats({ incidents: { server_errors: incident }, notify: [], open: [incident] }));
    expect(send).not.toHaveBeenCalled();
  });

  it("email unset → logged only; a failing send is logged, never thrown", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runMonitorCron(fakeEnv(), stats({ incidents: {}, notify: [incident], open: [incident] }));
    expect(JSON.parse(String(err.mock.calls[0]![0]))).toMatchObject({ code: "ALERT", email: false });
    err.mockClear();
    const env = fakeEnv({ ALERT_MAILER: { send: async () => { throw new Error("not verified"); } } as unknown as SendEmail, ALERT_EMAIL: "o@example.com", ALERT_EMAIL_FROM: "a@example.com" });
    await runMonitorCron(env, stats({ incidents: {}, notify: [incident], open: [incident] }));
    expect(err.mock.calls.map((c) => JSON.parse(String(c[0])).code)).toEqual(["ALERT", "ALERT_EMAIL_FAILED"]);
    expect(await runMonitorCron(env, null)).toBeNull();
  });
});
