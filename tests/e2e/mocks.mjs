// Stand-in servers for the services Kindling talks to, so the end-to-end tests run offline and repeatably.
//   9913  Supabase (auth + a generic REST layer + usage counts)
//   9912  webhooks (feedback, errors, update list): records every POST
//   9915  Cloudflare Turnstile verification
//   9911  Gemini
// Each has a small /__something endpoint the tests use to look inside or flip a switch.
import http from "node:http";
import crypto from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const parse = (t) => { try { return JSON.parse(t); } catch { return {}; } };
const send = (res, code, obj, extra = {}) => { res.writeHead(code, { "content-type": "application/json", ...extra }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
const readBody = (req) => new Promise((resolve) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => resolve(b)); });

/* ---------------- Supabase ---------------- */
const users = new Map(); // email -> {id,email,password}
const flags = { captcha: false, autoconfirm: false };
const state = { recover: [], events: new Map(), lastCaptcha: [] };
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, exp, aud: "authenticated", role: "authenticated" })}.sig`;
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r" + u.id, user: { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}
const who = (req) => { try { return JSON.parse(Buffer.from((req.headers.authorization || "").replace("Bearer ", "").split(".")[1], "base64url").toString()); } catch { return null; } };
const captchaOk = (body) => !flags.captcha || String(body?.gotrue_meta_security?.captcha_token ?? "").startsWith("tok-");

http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-expose-headers", "content-range");
  res.setHeader("access-control-allow-headers", "authorization,apikey,content-type,prefer,x-client-info,accept,accept-profile,content-profile,x-supabase-api-version");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  const body = parse(await readBody(req));
  const svc = (req.headers.authorization || "") === "Bearer svc";

  if (p === "/__captcha") { flags.captcha = url.searchParams.get("on") === "1"; return send(res, 200, flags); }
  if (p === "/__autoconfirm") { flags.autoconfirm = url.searchParams.get("on") === "1"; return send(res, 200, flags); }
  if (p === "/__recover") return send(res, 200, state.recover);
  if (p === "/__events") return send(res, 200, Object.fromEntries(state.events));
  if (p === "/__users") return send(res, 200, [...users.values()].map((u) => ({ email: u.email })));
  if (p === "/__session") { const u = users.get(url.searchParams.get("email") || ""); return u ? send(res, 200, session(u)) : send(res, 404, {}); }
  if (p === "/__reset") { users.clear(); state.recover.length = 0; state.events.clear(); flags.captcha = false; return send(res, 200, {}); }

  if (p === "/auth/v1/settings") return send(res, 200, { disable_signup: false, mailer_autoconfirm: flags.autoconfirm, external: { email: true, google: true } });
  if (p === "/auth/v1/signup") {
    if (!captchaOk(body)) return send(res, 400, { error_code: "captcha_failed", msg: "captcha protection: request disallowed" });
    if (users.has(body.email)) return send(res, 422, { error_code: "user_already_exists", msg: "User already registered" });
    const u = { id: crypto.randomUUID(), email: body.email, password: body.password };
    users.set(u.email, u);
    return send(res, 200, session(u));
  }
  if (p === "/auth/v1/token") {
    if (!captchaOk(body)) return send(res, 400, { error_code: "captcha_failed", msg: "captcha protection: request disallowed" });
    const u = users.get(body.email);
    if (!u || u.password !== body.password) return send(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, session(u));
  }
  if (p === "/auth/v1/otp") { if (!captchaOk(body)) return send(res, 400, { error_code: "captcha_failed", msg: "captcha protection: request disallowed" }); return send(res, 200, {}); }
  if (p === "/auth/v1/recover") {
    if (!captchaOk(body)) return send(res, 400, { error_code: "captcha_failed", msg: "captcha protection: request disallowed" });
    state.recover.push({ email: body.email, captcha: body?.gotrue_meta_security?.captcha_token ?? null, redirect: url.searchParams.get("redirect_to") });
    return send(res, 200, {}); // same answer whether or not the address exists
  }
  if (p === "/auth/v1/logout") { res.statusCode = 204; return res.end(); }
  if (p === "/auth/v1/user") {
    const w = who(req);
    const u = w && [...users.values()].find((x) => x.id === w.sub);
    if (!u) return send(res, 401, { msg: "invalid JWT" });
    if (req.method === "PUT") {
      if (body.password) {
        if (body.password === u.password) return send(res, 422, { error_code: "same_password", msg: "New password should be different from the old password." });
        u.password = body.password;
      }
      return send(res, 200, session(u).user);
    }
    return send(res, 200, session(u).user);
  }

  // usage counts
  if (p === "/rest/v1/rpc/bump_event") {
    if (!svc) return send(res, 401, { message: "no" });
    const key = `${new Date().toISOString().slice(0, 10)}|${body.ev}`;
    state.events.set(key, (state.events.get(key) ?? 0) + 1);
    res.statusCode = 204; return res.end();
  }
  if (p === "/rest/v1/kindling_event_counts" && req.method === "GET" && svc) {
    const rows = [...state.events].map(([k, count]) => { const [day, event] = k.split("|"); return { day, event, count }; });
    return send(res, 200, rows, { "content-range": `0-${rows.length}/${rows.length}` });
  }

  // everything else under /rest/v1 is an empty, well-behaved table
  if (p.startsWith("/rest/v1/")) {
    if (req.method === "HEAD") { res.setHeader("content-range", "*/0"); res.statusCode = 200; return res.end(); }
    if (req.method === "GET") {
      if ((req.headers.accept || "").includes("pgrst.object")) return send(res, 406, { code: "PGRST116", message: "no rows" });
      return send(res, 200, [], { "content-range": "*/0" });
    }
    if (req.method === "PATCH") return send(res, 200, []);
    res.statusCode = req.method === "POST" ? 201 : 204; return res.end();
  }
  send(res, 404, { message: "not found " + p });
}).listen(9913);

/* ---------------- webhooks ---------------- */
const hooks = [];
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__hooks") return send(res, 200, hooks);
  if (url.pathname === "/__reset") { hooks.length = 0; return send(res, 200, {}); }
  const raw = await readBody(req);
  hooks.push({ path: url.pathname, body: parse(raw) });
  send(res, 200, {});
}).listen(9912);

/* ---------------- Turnstile verification ---------------- */
const used = new Set();
const calls = [];
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__calls") return send(res, 200, calls);
  if (url.pathname === "/__reset") { used.clear(); calls.length = 0; return send(res, 200, {}); }
  const form = new URLSearchParams(await readBody(req));
  const token = form.get("response") || "";
  const good = form.get("secret") === "test-secret" && token.startsWith("tok-") && !used.has(token);
  calls.push({ token, success: good });
  if (good) used.add(token); // a token works once
  send(res, 200, good ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] });
}).listen(9915);

/* ---------------- Gemini ---------------- */
const bodies = [];
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__bodies") return send(res, 200, bodies);
  const m = url.pathname.split("/models/")[1];
  if (!m) return send(res, 404, {});
  const raw = await readBody(req);
  if (m.startsWith("gemini-3.5-flash")) return send(res, 404, {});
  bodies.push(parse(raw));
  send(res, 200, { candidates: [{ content: { parts: [{ text: "Hi Maria, yes. [CHECK: Sunday opening time] see you." }] } }] });
}).listen(9911);

console.log("mocks up: 9913 supabase, 9912 hooks, 9915 turnstile, 9911 gemini");
