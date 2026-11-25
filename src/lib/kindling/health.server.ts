/**
 * The launch checklist, checked by the live site itself. Call /api/health with your CRON_SECRET and it reports
 * what is switched on, what is missing and what looks unsafe. It never returns a secret value, only
 * whether each setting is present and whether each service answers.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/health
 */
import { aiProviders, emailProvider } from "@/lib/kindling/weekly.server";

export type Check = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string };

const env = (name: string) => process.env[name] ?? "";
const SUPABASE_URL = () => (env("VITE_SUPABASE_URL") || (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || "").replace(/\/$/, "");
const ANON = () => env("VITE_SUPABASE_ANON_KEY") || (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

const TABLES = [
  "kindling_state",
  "kindling_teams",
  "kindling_members",
  "kindling_prefs",
  "kindling_training_consent",
  "kindling_training_examples",
  "kindling_event_counts",
];

async function get(url: string, headers: Record<string, string>) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

export async function runHealth(): Promise<{ ok: boolean; summary: string; checks: Check[] }> {
  const checks: Check[] = [];
  const add = (id: string, label: string, status: Check["status"], detail: string) => checks.push({ id, label, status, detail });

  const site = env("SITE_URL");
  add(
    "site-url",
    "SITE_URL",
    /^https:\/\//.test(site) ? "pass" : "warn",
    /^https:\/\//.test(site) ? "Set to an https address." : "Not set to an https address. Email links fall back to the address the request came from.",
  );

  const secret = env("CRON_SECRET");
  add("cron-secret", "CRON_SECRET", secret.length >= 24 ? "pass" : secret ? "warn" : "fail", secret.length >= 24 ? "Set, and long enough." : secret ? "Set, but shorter than 24 characters. Use a longer random string." : "Not set. The weekly email job and this check cannot run.");

  // Secrets must never be in a variable that starts with VITE_, because those are published to every visitor.
  const leaked = Object.keys(process.env).filter((name) => name.startsWith("VITE_") && /SERVICE_ROLE|SECRET|PRIVATE|API_KEY/i.test(name) && !/ANON|PUBLISHABLE/i.test(name));
  add("no-secret-in-public-vars", "Secrets are not public", leaked.length === 0 ? "pass" : "fail", leaked.length === 0 ? "No secret-looking variable starts with VITE_." : `These look like secrets but start with VITE_, so they are public: ${leaked.join(", ")}. Rename them and rotate the keys.`);

  const url = SUPABASE_URL();
  const anon = ANON();
  add("supabase-env", "Supabase address and public key", url && anon ? "pass" : "warn", url && anon ? "Both are set." : "Not set, so accounts, crews, the weekly email and sharing are off. The app still works on one device.");

  if (url && anon) {
    const settings = await get(`${url}/auth/v1/settings`, { apikey: anon });
    if (settings.status !== 200) {
      add("supabase-reachable", "Supabase answers", "fail", `Supabase did not answer correctly (status ${settings.status}). Check the address and key.`);
    } else {
      const s = settings.body as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: Record<string, boolean> };
      add("supabase-reachable", "Supabase answers", "pass", "Reachable, and the public key is accepted.");
      add("signup-open", "Sign-ups", s.disable_signup ? "warn" : "pass", s.disable_signup ? "New sign-ups are turned off in Supabase." : "New sign-ups are allowed.");
      add("email-confirm", "Email confirmation", s.mailer_autoconfirm ? "warn" : "pass", s.mailer_autoconfirm ? "Accounts are confirmed without checking the email address. Anyone can sign up with an address they do not own. Turn confirmation on." : "New accounts must confirm their email address.");
      const wantsGoogle = env("VITE_GOOGLE_AUTH") === "true" || (import.meta.env?.VITE_GOOGLE_AUTH as string | undefined) === "true";
      if (wantsGoogle) add("google-auth", "Google sign-in", s.external?.google ? "pass" : "fail", s.external?.google ? "Enabled in Supabase." : "The button is shown but Google is not enabled in Supabase, so it will fail.");
      else add("google-auth", "Google sign-in", "pass", "Not switched on (VITE_GOOGLE_AUTH is not true).");
    }

    // Tables exist (needs the service role key), and the public key cannot read private rows.
    const service = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!service) {
      add("service-role", "SUPABASE_SERVICE_ROLE_KEY", "warn", "Not set. The weekly email, account deletion and the training export need it.");
    } else {
      add("service-role", "SUPABASE_SERVICE_ROLE_KEY", "pass", "Set.");
      const missing: string[] = [];
      for (const table of TABLES) {
        const r = await get(`${url}/rest/v1/${table}?select=*&limit=0`, { apikey: service, Authorization: `Bearer ${service}` });
        if (r.status === 404 || r.status === 400) missing.push(table);
      }
      add("schema", "Database tables", missing.length === 0 ? "pass" : "fail", missing.length === 0 ? "All tables exist." : `Missing: ${missing.join(", ")}. Run supabase/schema.sql in the SQL editor.`);
    }
    const exposed: string[] = [];
    for (const table of ["kindling_state", "kindling_prefs", "kindling_training_examples", "kindling_teams"]) {
      const r = await get(`${url}/rest/v1/${table}?select=*&limit=1`, { apikey: anon });
      if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) exposed.push(table);
    }
    add("rls", "Private rows are private", exposed.length === 0 ? "pass" : "fail", exposed.length === 0 ? "The public key cannot read any private rows." : `The public key can read rows in: ${exposed.join(", ")}. Row Level Security is not working. Run supabase/schema.sql again.`);
  }

  const ai = aiProviders();
  add("ai", "AI provider", ai.length > 0 ? "pass" : "warn", ai.length > 0 ? `${ai.length} provider${ai.length === 1 ? "" : "s"} connected.` : "None connected, so drafts come from the offline template only.");
  const mail = emailProvider();
  add("email", "Email provider", mail ? "pass" : "warn", mail ? "Key and sender address are set." : "Not set, so the weekly email is off.");
  if (mail) add("email-footer", "Email footer address", env("EMAIL_FOOTER") ? "pass" : "warn", env("EMAIL_FOOTER") ? "Set." : "EMAIL_FOOTER is not set. Add your business name and address.");
  const who = env("VITE_CONTROLLER_NAME") || (import.meta.env?.VITE_CONTROLLER_NAME as string | undefined);
  const contact = env("VITE_CONTACT_EMAIL") || (import.meta.env?.VITE_CONTACT_EMAIL as string | undefined);
  add("privacy-identity", "Privacy page names you", who && contact ? "pass" : "warn", who && contact ? "Controller name and contact email are set." : "VITE_CONTROLLER_NAME or VITE_CONTACT_EMAIL is missing, so the privacy page uses generic wording. Add both before launch.");
  const siteKey = env("VITE_TURNSTILE_SITE_KEY") || (import.meta.env?.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";
  const turnstileSecret = env("TURNSTILE_SECRET_KEY");
  if (!siteKey && !turnstileSecret) add("turnstile", "Security check (Turnstile)", "pass", "Not switched on. Add it if bots start signing up or using the quick draft.");
  else if (siteKey && turnstileSecret) add("turnstile", "Security check (Turnstile)", "pass", "Site key and secret are both set. Also paste the same secret into Supabase (Authentication, Attack Protection) so sign-in is checked too.");
  else if (siteKey) add("turnstile", "Security check (Turnstile)", "warn", "The site key is set but TURNSTILE_SECRET_KEY is not, so the widget shows but nothing verifies it.");
  else add("turnstile", "Security check (Turnstile)", "fail", "TURNSTILE_SECRET_KEY is set but VITE_TURNSTILE_SITE_KEY is not, so no visitor can pass and the quick draft, update list and help form will refuse everyone.");
  const siteVite = env("VITE_SITE_URL") || (import.meta.env?.VITE_SITE_URL as string | undefined) || "";
  add("seo-url", "VITE_SITE_URL (search and link previews)", /^https:\/\//.test(siteVite) ? "pass" : "warn", /^https:\/\//.test(siteVite) ? "Set. Canonical tags and link-preview images use it." : "Not set to an https address, so canonical tags are left out and link previews may lack an image.");
  add("error-alerts", "Error alerts", env("ERROR_WEBHOOK_URL") ? "pass" : "warn", env("ERROR_WEBHOOK_URL") ? "Browser errors are forwarded to your webhook as well as the log." : "ERROR_WEBHOOK_URL is not set. Browser errors only appear in the host's logs.");
  add("feedback", "Help form", env("FEEDBACK_WEBHOOK_URL") ? "pass" : "warn", env("FEEDBACK_WEBHOOK_URL") ? "Messages are sent to your webhook." : "FEEDBACK_WEBHOOK_URL is not set, so the help page shows your email address instead of a form.");
  add("waitlist", "Update list", env("WAITLIST_WEBHOOK_URL") ? "pass" : "warn", env("WAITLIST_WEBHOOK_URL") ? "Webhook set." : "No webhook, so the sign-up form is hidden.");

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  return { ok: fails === 0, summary: `${checks.length - fails - warns} passed, ${warns} to review, ${fails} to fix`, checks };
}
