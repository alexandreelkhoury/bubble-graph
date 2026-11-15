// JAMAA-PLATFORM §8.4: the hourly monitoring cron. Asks the Stats DO to evaluate the alert rules, then for each NEW
// incident writes one `ALERT` log line (always) and sends one email through the Email Routing `send_email` binding
// when it is configured (ALERT_MAILER + ALERT_EMAIL + ALERT_EMAIL_FROM). Unset = alerts are only logged and shown on
// the admin page banner. The email carries counts and thresholds only.
import type { Env } from "../env";
import { alertConfig, describeAlert } from "./alerts";
import type { AlertIncident, AlertResult } from "./alerts";
import type { StatsApi } from "./stats-api";

const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}$/;

type MailEnv = Pick<Env, "ALERT_MAILER" | "ALERT_EMAIL" | "ALERT_EMAIL_FROM">;

export function alertMailReady(env: MailEnv): boolean {
  return env.ALERT_MAILER !== undefined && EMAIL_RE.test(env.ALERT_EMAIL ?? "") && EMAIL_RE.test(env.ALERT_EMAIL_FROM ?? "");
}

export async function sendAlertEmail(env: MailEnv, inc: AlertIncident, openCount: number): Promise<boolean> {
  if (!alertMailReady(env) || !env.ALERT_MAILER) return false;
  const line = describeAlert(inc);
  const text = [
    line,
    "",
    `Opened: ${new Date(inc.openedAt).toISOString()}`,
    `Open incidents now: ${openCount}`,
    "",
    "Details: open /admin on the Worker (ADMIN_TOKEN). You get one email per incident; it closes by itself when the",
    "next hourly check is below the threshold.",
  ].join("\n");
  try {
    await env.ALERT_MAILER.send({ from: env.ALERT_EMAIL_FROM as string, to: env.ALERT_EMAIL as string, subject: line, text });
    return true;
  } catch {
    console.error(JSON.stringify({ code: "ALERT_EMAIL_FAILED", rule: inc.rule }));
    return false;
  }
}

export async function runMonitorCron(env: Env, stats: StatsApi | null): Promise<AlertResult | null> {
  if (!stats) return null;
  let r: AlertResult;
  try {
    r = await stats.evaluate(alertConfig(env));
  } catch {
    console.error(JSON.stringify({ code: "MONITOR_CRON_FAILED" }));
    return null;
  }
  for (const inc of r.notify) {
    // The line to search for in Workers Logs (and the only signal when email is not set up).
    console.error(JSON.stringify({ code: "ALERT", rule: inc.rule, value: inc.value, threshold: inc.threshold, email: alertMailReady(env) }));
    await sendAlertEmail(env, inc, r.open.length);
  }
  return r;
}
