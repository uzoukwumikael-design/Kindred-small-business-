// Pieces added for launch: backup encryption and restore, search helpers, usage-event consistency, error-report cleaning,
// the Turnstile check, the stats maths and the new health checks.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };
const root = new URL("../../", import.meta.url).pathname;

// ---------- backup and restore
const lib = await import("../../scripts/backup-lib.mts");
const sealed = lib.seal('{"hello":"world"}', "correct horse battery staple");
t("an encrypted backup does not contain the data", !JSON.stringify(sealed).includes("hello"));
t("the right passphrase opens it", lib.unseal(sealed, "correct horse battery staple") === '{"hello":"world"}');
t("a wrong passphrase fails", (() => { try { lib.unseal(sealed, "wrong"); return false; } catch { return true; } })());
t("a changed file fails", (() => { try { lib.unseal({ ...sealed, data: Buffer.from("tampered").toString("base64") }, "correct horse battery staple"); return false; } catch { return true; } })());
t("two backups of the same data differ", JSON.stringify(lib.seal("x", "p")) !== JSON.stringify(lib.seal("x", "p")));
t("sealed files are recognised", lib.isSealed(sealed) && !lib.isSealed({ version: 1 }));
t("batches split evenly", lib.batches([1, 2, 3, 4, 5], 2).length === 3 && lib.batches([], 2).length === 0);
const sample = { version: 1 as const, createdAt: "2026-10-27T00:00:00Z", counts: {}, tables: { kindling_state: [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }], kindling_teams: [{ id: "t" }], kindling_members: [{ team_id: "t", user_id: "a" }] } };
const plan = lib.planRestore(sample, 2);
t("the plan restores parents before children", plan.findIndex((p) => p.table === "kindling_teams") < plan.findIndex((p) => p.table === "kindling_members"));
t("the plan counts rows and batches", plan.find((p) => p.table === "kindling_state")!.rows === 3 && plan.find((p) => p.table === "kindling_state")!.batches === 2);
const calls: { url: string; init: any }[] = [];
const fake = (async (url: string, init: any) => { calls.push({ url, init }); return new Response(null, { status: url.includes("kindling_prefs") ? 409 : 201 }); }) as unknown as typeof fetch;
const restored = await lib.applyRestore(sample, "https://x.supabase.co", "svc", fake, 2);
t("restore merges by primary key so it is safe to run twice", calls.every((c) => c.init.headers.Prefer.includes("resolution=merge-duplicates")) && calls[0].url.includes("on_conflict=user_id"));
t("restore sends the service key", calls.every((c) => c.init.headers.Authorization === "Bearer svc"));
t("restore counts what went in", restored.restored.kindling_state === 3 && restored.restored.kindling_teams === 1);
t("restore sends no request for empty tables", calls.length === 3 + 1 /* state 2 batches + teams 1 + members 1 = 4 */ || calls.length === 4);
const failing = await lib.applyRestore({ ...sample, tables: { ...sample.tables, kindling_prefs: [{ user_id: "a" }] } }, "https://x.supabase.co", "svc", fake, 2);
t("a refused table is reported, not hidden", failing.errors.some((e) => e.startsWith("kindling_prefs: HTTP 409")));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-"));
const file = path.join(dir, "b.enc.json");
fs.writeFileSync(file, JSON.stringify(lib.seal(JSON.stringify(sample), "pass-phrase-for-test")));
const run = (args: string[], env: Record<string, string> = {}) => spawnSync("npx", ["tsx", "scripts/restore.mts", ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
let r = run([file], { BACKUP_PASSPHRASE: "pass-phrase-for-test" });
t("restore is a dry run by default", r.status === 0 && r.stdout.includes("Dry run. Nothing was written."));
t("the dry run shows the plan", r.stdout.includes("kindling_state: 3 rows"));
r = run([file]);
t("an encrypted backup without a passphrase is refused", r.status === 2 && r.stderr.includes("BACKUP_PASSPHRASE"));
r = run([file], { BACKUP_PASSPHRASE: "nope" });
t("the wrong passphrase gives a clear message", r.status === 2 && r.stderr.includes("wrong passphrase"));
r = run([file, "--apply"], { BACKUP_PASSPHRASE: "pass-phrase-for-test", I_UNDERSTAND_THIS_OVERWRITES_ROWS: "" });
t("writing needs an explicit confirmation", r.status === 2 && r.stderr.includes("I_UNDERSTAND_THIS_OVERWRITES_ROWS"));
const b = spawnSync("npx", ["tsx", "scripts/backup.mts"], { cwd: root, encoding: "utf8", env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "svc", BACKUP_PASSPHRASE: "" } });
t("a backup refuses to write unencrypted data by accident", b.status === 2 && b.stderr.includes("BACKUP_PASSPHRASE"));
fs.rmSync(dir, { recursive: true, force: true });

// ---------- search helpers
const seo = await import("../../src/lib/kindling/seo");
t("a private page asks to stay out of search", seo.pageHead({ title: "x", path: "/studio", index: false }).meta.some((m: any) => m.name === "robots" && m.content === "noindex"));
t("a public page does not", !seo.pageHead({ title: "x", path: "/", description: "d" }).meta.some((m: any) => m.name === "robots"));
t("structured data cannot close its own script tag", !seo.homeJsonLd().includes("</script>") && !seo.homeJsonLd().includes("<"));
t("structured data includes every FAQ question", JSON.parse(seo.homeJsonLd().replace(/\\u003c/g, "<")).find((d: any) => d["@type"] === "FAQPage").mainEntity.length === seo.FAQ.length);
t("the FAQ has real answers", seo.FAQ.length >= 8 && seo.FAQ.every((f) => f.question.endsWith("?") && f.answer.length > 60));
t("the FAQ has no em dashes", !JSON.stringify(seo.FAQ).includes("\u2014"));
t("the sitemap pages include help, pricing and the legal pages", ["/help", "/pricing", "/privacy", "/terms"].every((p) => seo.PUBLIC_PATHS.includes(p)) && !seo.PUBLIC_PATHS.includes("/studio"));

// ---------- the usage-event list matches the database
const { EVENTS } = await import("../../src/lib/kindling/events");
const sql = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const inSql = [...(/event in \(([^)]*)\)/s.exec(sql)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
t("the app and the database agree on the list of events", JSON.stringify(inSql) === JSON.stringify([...EVENTS].sort()));

// ---------- error report cleaning
const sent: any[] = [];
(globalThis as any).window = { location: { pathname: "/learn" }, addEventListener() {} };
(globalThis as any).fetch = async (_u: string, init: any) => { sent.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); };
const { report } = await import("../../src/lib/kindling/report");
const boom = new Error("boom for maria@shop.com card 4111 1111 1111 1111 at https://kindling.example/assets/app.js?v=9:12:3");
report(boom);
t("a report keeps the message and path", sent[0]?.message.includes("boom for") && sent[0]?.path === "/learn");
t("private details are masked", !/maria@shop|4111/.test(JSON.stringify(sent[0])) && sent[0].message.includes("[EMAIL]"));
t("web addresses are cut to paths with no query string", !JSON.stringify(sent[0]).includes("kindling.example") && !JSON.stringify(sent[0]).includes("?v=9"));
report(boom); // the same error from the same place
t("the same error is not sent twice", sent.length === 1);
for (let i = 0; i < 10; i += 1) report(new Error("different " + i));
t("no more than five reports are sent", sent.length === 5);
report("a plain string error");
t("reporting a non-error never throws", true);

// ---------- Turnstile
const guard = await import("../../src/lib/kindling/guard");
delete process.env.TURNSTILE_SECRET_KEY;
t("with no secret the check is off and lets everyone through", (await guard.verifyTurnstile("")) === true);
process.env.TURNSTILE_SECRET_KEY = "s3cret";
process.env.TURNSTILE_VERIFY_URL = "http://turnstile.test/verify";
let verifyBody = "";
let verdict: any = { success: true };
(globalThis as any).fetch = async (_u: string, init: any) => { verifyBody = String(init.body); if (verdict === "throw") throw new Error("network"); return new Response(JSON.stringify(verdict), { status: 200 }); };
t("with a secret, no token is refused", (await guard.verifyTurnstile("")) === false);
t("an oversized token is refused", (await guard.verifyTurnstile("x".repeat(5000))) === false);
t("a good token passes", (await guard.verifyTurnstile("tok-1")) === true);
t("the secret and token are sent to Cloudflare, not the visitor", verifyBody.includes("secret=s3cret") && verifyBody.includes("response=tok-1"));
verdict = { success: false };
t("a rejected token fails", (await guard.verifyTurnstile("tok-2")) === false);
verdict = "throw";
t("if Cloudflare cannot be reached the check fails closed", (await guard.verifyTurnstile("tok-3")) === false);
delete process.env.TURNSTILE_SECRET_KEY;

// ---------- stats maths
process.env.VITE_SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
(globalThis as any).fetch = async () => new Response(JSON.stringify([
  { day: "2026-10-26", event: "visit", count: 100 }, { day: "2026-10-26", event: "week_built", count: 40 },
  { day: "2026-10-27", event: "visit", count: 100 }, { day: "2026-10-27", event: "week_built", count: 20 }, { day: "2026-10-27", event: "draft_created", count: 30 }, { day: "2026-10-27", event: "send_clicked", count: 15 },
]), { status: 200 });
const weekly = await import("../../src/lib/kindling/weekly.server");
const stats = await weekly.eventStats(7);
t("totals add up across days", stats.totals.visit === 200 && stats.totals.week_built === 60);
t("the funnel gives each step as a share of the one before", stats.funnel.map((f) => f.fromPrevious).join() === ",30%,50%,50%");
t("per-day numbers are kept", stats.perDay["2026-10-27"].send_clicked === 15);
(globalThis as any).fetch = async () => new Response("[]", { status: 200 });
const empty = await weekly.eventStats(7);
t("no data gives zeros, not errors", empty.funnel.every((f) => f.count === 0 && f.fromPrevious === ""));

// ---------- the new health checks
for (const k of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) delete process.env[k];
const health = await import("../../src/lib/kindling/health.server");
const status = async (id: string) => (await health.runHealth()).checks.find((c) => c.id === id)?.status;
for (const k of ["VITE_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "ERROR_WEBHOOK_URL", "FEEDBACK_WEBHOOK_URL", "VITE_SITE_URL"]) delete process.env[k];
t("no security check at all is fine", (await status("turnstile")) === "pass");
process.env.VITE_TURNSTILE_SITE_KEY = "site";
t("a site key without a secret is a warning", (await status("turnstile")) === "warn");
process.env.TURNSTILE_SECRET_KEY = "secret";
t("both together pass", (await status("turnstile")) === "pass");
delete process.env.VITE_TURNSTILE_SITE_KEY;
t("a secret without a site key is a failure, because every form would refuse everyone", (await status("turnstile")) === "fail");
t("a missing site address is a warning", (await status("seo-url")) === "warn");
process.env.VITE_SITE_URL = "https://kindling.test";
t("an https site address passes", (await status("seo-url")) === "pass");
t("missing error alerts and a missing help webhook are warnings", (await status("error-alerts")) === "warn" && (await status("feedback")) === "warn");
process.env.ERROR_WEBHOOK_URL = "http://x";
process.env.FEEDBACK_WEBHOOK_URL = "http://x";
t("and pass once set", (await status("error-alerts")) === "pass" && (await status("feedback")) === "pass");
process.exit(bad ? 1 : 0);
