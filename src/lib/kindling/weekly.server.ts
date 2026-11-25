/**
 * Server-only helpers for the weekly email, one-click unsubscribe, and the account actions that need the
 * Supabase service role key (deleting an account, sending a test email).
 * Uses plain fetch and Web Crypto so it works on any host and needs no extra packages.
 */
import { workflowFor } from "@/lib/kindling/catalog";
import { span, summaryLines, utcDay, weekStats, dayNumber } from "@/lib/kindling/summary";
import type { Snapshot } from "@/lib/kindling/cloud";

const SUPABASE_URL = () => process.env.VITE_SUPABASE_URL || (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "";
const ANON_KEY = () => process.env.VITE_SUPABASE_ANON_KEY || (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || "";
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type Prefs = {
  user_id: string;
  email: string;
  weekly_email: boolean;
  weekday: number;
  consented_at: string | null;
  last_sent_on: string | null;
  last_kind: string | null;
};

/* ------------------------------------------------------------------ */
/* Which services are switched on (names only, never keys)             */
/* ------------------------------------------------------------------ */

export function emailProvider(): "Resend" | "Brevo" | null {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "Resend";
  if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM) return "Brevo";
  return null;
}

export function aiProviders(): string[] {
  const names: string[] = [];
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) names.push("Google Gemini");
  if (process.env.GROQ_API_KEY) names.push("Groq");
  if (process.env.ANTHROPIC_API_KEY) names.push("Anthropic");
  if (process.env.OPENAI_API_KEY) names.push("OpenAI");
  if (process.env.XAI_API_KEY) names.push("xAI");
  return names;
}

export function weeklyReady(): boolean {
  return Boolean(emailProvider() && SERVICE_KEY() && SUPABASE_URL() && (process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET));
}

export function accountDeleteReady(): boolean {
  return Boolean(SERVICE_KEY() && SUPABASE_URL());
}

/* ------------------------------------------------------------------ */
/* Supabase over REST                                                  */
/* ------------------------------------------------------------------ */

async function rest<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null }> {
  const key = SERVICE_KEY();
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

/** Checks a person's access token with Supabase and returns who it belongs to. */
export async function verifyAccessToken(token: string): Promise<{ id: string; email: string } | null> {
  if (!token || token.length > 4000 || !SUPABASE_URL()) return null;
  try {
    const response = await fetch(`${SUPABASE_URL()}/auth/v1/user`, {
      headers: { apikey: ANON_KEY(), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    return user.id ? { id: user.id, email: user.email ?? "" } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Signed unsubscribe links                                            */
/* ------------------------------------------------------------------ */

async function hmacHex(message: string): Promise<string> {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsubscribe:${message}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function unsubscribeLink(origin: string, userId: string): Promise<string> {
  const token = await hmacHex(userId);
  return `${origin}/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export async function unsubscribe(userId: string, token: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !SERVICE_KEY()) return false;
  const expected = await hmacHex(userId);
  if (!sameText(expected, token)) return false;
  const result = await rest(`kindling_prefs?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ weekly_email: false, updated_at: new Date().toISOString() }),
  });
  return result.ok;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].replace(/^"|"$/g, ""), email: match[2] } : { name: "Kindling", email: from.trim() };
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
}): Promise<boolean> {
  const from = process.env.EMAIL_FROM ?? "";
  // Mail apps POST to this address for one-click unsubscribe; people clicking the link in the body get the page.
  const oneClick = args.unsubscribeUrl.replace("/unsubscribe?", "/api/unsubscribe?");
  const headers = {
    "List-Unsubscribe": `<${oneClick}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  try {
    if (process.env.RESEND_API_KEY) {
      const response = await fetch(`${process.env.RESEND_BASE_URL || "https://api.resend.com"}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [args.to], subject: args.subject, text: args.text, html: args.html, headers }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok;
    }
    if (process.env.BREVO_API_KEY) {
      const sender = parseFrom(from);
      const response = await fetch(`${process.env.BREVO_BASE_URL || "https://api.brevo.com"}/v3/smtp/email`, {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender,
          to: [{ email: args.to }],
          subject: args.subject,
          textContent: args.text,
          htmlContent: args.html,
          headers,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      return response.ok;
    }
  } catch {
    return false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Building the email                                                  */
/* ------------------------------------------------------------------ */

type CrewRow = { id: string; name: string; state: unknown };

function asSnapshot(raw: unknown): Pick<Snapshot, "log" | "baselines" | "shop" | "intake"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const log = Array.isArray(r.log) ? (r.log as Snapshot["log"]).filter((e) => e && typeof e.day === "string" && typeof e.minutes === "number") : [];
  const baselines = r.baselines && typeof r.baselines === "object" ? (r.baselines as Record<string, number>) : {};
  const shop = (r.shop && typeof r.shop === "object" ? r.shop : {}) as Snapshot["shop"];
  return { log, baselines, shop, intake: (r.intake as Snapshot["intake"]) ?? null };
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildEmail(args: {
  prefs: Pick<Prefs, "email">;
  personal: unknown;
  crews: CrewRow[];
  today: string;
  origin: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string; kind: "summary" | "nudge" } {
  const me = args.prefs.email.split("@")[0].slice(0, 40);
  const personal = asSnapshot(args.personal);
  const hourly = typeof personal?.shop?.hourly === "number" ? personal.shop.hourly : 40;

  const parts: { title: string; lines: string[] }[] = [];
  let totalSaved = 0;
  let totalRuns = 0;

  if (personal && personal.log.length > 0) {
    const stats = weekStats(personal.log, personal.baselines, args.today);
    const { line, trend } = summaryLines(stats, hourly);
    parts.push({ title: personal.shop?.name ? `${personal.shop.name}` : "Your week", lines: [line + trend] });
    totalSaved += stats.saved;
    totalRuns += stats.runs;
  }
  for (const crew of args.crews) {
    const snap = asSnapshot(crew.state);
    if (!snap || snap.log.length === 0) continue;
    const mine = weekStats(snap.log, snap.baselines, args.today, (entry) => entry.by === me);
    const all = weekStats(snap.log, snap.baselines, args.today);
    const lines: string[] = [];
    if (mine.runs > 0) lines.push(`You ran it ${mine.runs} ${mine.runs === 1 ? "time" : "times"} and got back ${span(mine.saved)}.`);
    lines.push(
      all.runs > 0
        ? `The whole crew ran it ${all.runs} ${all.runs === 1 ? "time" : "times"} and got back ${span(all.saved)}.`
        : "Nobody in the crew logged a run this week.",
    );
    parts.push({ title: crew.name, lines });
    totalSaved += mine.saved;
    totalRuns += mine.runs;
  }

  const studio = `${args.origin}/studio`;
  const kind = totalRuns > 0 ? "summary" : "nudge";
  const subject = kind === "summary" ? `Your week with Kindling: ${span(totalSaved)} ${totalSaved >= 0 ? "back" : ""}`.trim() : "Nothing logged this week";

  let jobLine = "";
  if (personal?.intake) {
    try {
      jobLine = `Your job: ${workflowFor(personal.intake.pain).title}.`;
    } catch {
      jobLine = "";
    }
  }
  const intro = kind === "summary" ? "Here is your week." : "Nothing is logged for this week yet. One run takes a few minutes, and it is how you find out if this is worth keeping.";
  const footer = process.env.EMAIL_FOOTER ? `\n${process.env.EMAIL_FOOTER}` : "";

  const text = [
    intro,
    ...(jobLine ? ["", jobLine] : []),
    ...parts.flatMap((part) => ["", part.title, ...part.lines]),
    "",
    `Open your week: ${studio}`,
    "",
    "You get this because you turned on the weekly email in your Kindling account.",
    `Stop it any time: ${args.unsubscribeUrl}${footer}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4ece0;font-family:Georgia,'Times New Roman',serif;color:#1b1511;">
<div style="max-width:520px;margin:0 auto;background:#fff8f0;border:1px solid #dccfbd;border-radius:12px;padding:28px;">
<p style="margin:0 0 12px;font-size:18px;line-height:1.5;">${esc(intro)}</p>
${jobLine ? `<p style="margin:0 0 16px;font-size:15px;color:#5f5347;">${esc(jobLine)}</p>` : ""}
${parts.map((part) => `<h2 style="margin:20px 0 6px;font-size:18px;">${esc(part.title)}</h2>${part.lines.map((l) => `<p style="margin:0 0 6px;font-size:16px;line-height:1.5;">${esc(l)}</p>`).join("")}`).join("")}
<p style="margin:24px 0 0;"><a href="${esc(studio)}" style="display:inline-block;background:#9a3412;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;">Open your week</a></p>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5f5347;font-family:Arial,sans-serif;">You get this because you turned on the weekly email in your Kindling account. <a href="${esc(args.unsubscribeUrl)}" style="color:#5f5347;">Stop it any time</a>.${process.env.EMAIL_FOOTER ? `<br>${esc(process.env.EMAIL_FOOTER)}` : ""}</p>
</div></body></html>`;

  return { subject, text, html, kind };
}

/* ------------------------------------------------------------------ */
/* The daily job                                                       */
/* ------------------------------------------------------------------ */

/** Weekly means once every seven days, on the person's chosen weekday (UTC). Missed weeks catch up the next day. */
export function isDue(prefs: Pick<Prefs, "weekly_email" | "weekday" | "last_sent_on">, today: string): boolean {
  if (!prefs.weekly_email) return false;
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (!prefs.last_sent_on) return weekday === prefs.weekday;
  const since = dayNumber(today) - dayNumber(prefs.last_sent_on);
  if (since < 7) return false;
  return weekday === prefs.weekday || since >= 8;
}

async function gather(userId: string): Promise<{ personal: unknown; crews: CrewRow[] }> {
  const state = await rest<{ state: unknown }[]>(`kindling_state?user_id=eq.${userId}&select=state`);
  const memberships = await rest<{ team_id: string }[]>(`kindling_members?user_id=eq.${userId}&select=team_id`);
  const ids = (memberships.data ?? []).map((m) => m.team_id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  let crews: CrewRow[] = [];
  if (ids.length > 0) {
    const teams = await rest<CrewRow[]>(`kindling_teams?id=in.(${ids.join(",")})&select=id,name,state`);
    crews = teams.data ?? [];
  }
  return { personal: state.data?.[0]?.state ?? null, crews };
}

export async function runWeekly(origin: string, now = new Date()): Promise<{ considered: number; sent: number; failed: number }> {
  const today = utcDay(now);
  const result = { considered: 0, sent: 0, failed: 0 };
  if (!weeklyReady()) return result;

  const prefs = await rest<Prefs[]>(`kindling_prefs?weekly_email=eq.true&select=*&limit=1000`);
  const max = Math.max(1, Number(process.env.WEEKLY_MAX_PER_RUN || 90));
  for (const row of prefs.data ?? []) {
    if (!isDue(row, today)) continue;
    if (result.sent + result.failed >= max) break;
    result.considered += 1;
    const { personal, crews } = await gather(row.user_id);
    const unsubscribeUrl = await unsubscribeLink(origin, row.user_id);
    const mail = buildEmail({ prefs: row, personal, crews, today, origin, unsubscribeUrl });
    // Do not send two nudges in a row to someone who is not using it.
    if (mail.kind === "nudge" && row.last_kind === "nudge") {
      await rest(`kindling_prefs?user_id=eq.${row.user_id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_sent_on: today }),
      });
      continue;
    }
    const sent = await sendEmail({ to: row.email, subject: mail.subject, text: mail.text, html: mail.html, unsubscribeUrl });
    if (!sent) {
      result.failed += 1;
      continue;
    }
    await rest(`kindling_prefs?user_id=eq.${row.user_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_sent_on: today, last_kind: mail.kind }),
    });
    result.sent += 1;
  }
  return result;
}

/** Sends the signed-in person one email right now so they can see exactly what it looks like. */
export async function sendTest(token: string, origin: string): Promise<{ ok: boolean; error?: string }> {
  if (!weeklyReady()) return { ok: false, error: "Weekly email is not switched on for this site yet." };
  const user = await verifyAccessToken(token);
  if (!user) return { ok: false, error: "Sign in again and retry." };
  const { personal, crews } = await gather(user.id);
  const unsubscribeUrl = await unsubscribeLink(origin, user.id);
  const mail = buildEmail({ prefs: { email: user.email }, personal, crews, today: utcDay(), origin, unsubscribeUrl });
  const sent = await sendEmail({ to: user.email, subject: `[Test] ${mail.subject}`, text: mail.text, html: mail.html, unsubscribeUrl });
  return sent ? { ok: true } : { ok: false, error: "The email service did not accept the message. Check the sender address is verified." };
}

/** Permanently deletes the signed-in person's account and everything attached to it. */
export async function deleteAccount(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!accountDeleteReady()) return { ok: false, error: "Account deletion is not switched on for this site." };
  const user = await verifyAccessToken(token);
  if (!user) return { ok: false, error: "Sign in again and retry." };
  try {
    const response = await fetch(`${SUPABASE_URL()}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY(), Authorization: `Bearer ${SERVICE_KEY()}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, error: "Could not delete the account. Try again, or ask the site owner." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete the account. Try again, or ask the site owner." };
  }
}


/* ------------------------------------------------------------------ */
/* Usage counts (no identifiers)                                       */
/* ------------------------------------------------------------------ */

export async function bumpEvent(event: string): Promise<void> {
  if (!SERVICE_KEY() || !SUPABASE_URL()) return;
  try {
    await rest("rpc/bump_event", { method: "POST", body: JSON.stringify({ ev: event }) });
  } catch {
    // losing a count is fine
  }
}

export async function eventStats(days: number): Promise<{
  days: number;
  totals: Record<string, number>;
  perDay: Record<string, Record<string, number>>;
  funnel: { step: string; count: number; fromPrevious: string }[];
}> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const result = await rest<{ day: string; event: string; count: number }[]>(
    `kindling_event_counts?day=gte.${since}&select=day,event,count&order=day&limit=5000`,
  );
  const totals: Record<string, number> = {};
  const perDay: Record<string, Record<string, number>> = {};
  for (const row of result.data ?? []) {
    totals[row.event] = (totals[row.event] ?? 0) + Number(row.count);
    (perDay[row.day] ??= {})[row.event] = Number(row.count);
  }
  const steps = ["visit", "week_built", "draft_created", "send_clicked"];
  const funnel = steps.map((step, i) => {
    const count = totals[step] ?? 0;
    const prev = i === 0 ? 0 : (totals[steps[i - 1]] ?? 0);
    return { step, count, fromPrevious: i === 0 || prev === 0 ? "" : `${Math.round((count / prev) * 100)}%` };
  });
  return { days, totals, perDay, funnel };
}
