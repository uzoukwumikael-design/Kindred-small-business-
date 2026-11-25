// Search basics, security headers, the 404, usage counts, error reporting, and the CAPTCHA on the quick draft.
import { BASE, SECRET, agree, buildWeek, launch, mock, newPage, ok, results } from "./helpers.mjs";

const browser = await launch();
await fetch("http://127.0.0.1:9913/__reset");
await fetch("http://127.0.0.1:9912/__reset");
await fetch("http://127.0.0.1:9915/__reset");

// ---------- search basics
const home = await (await fetch(BASE + "/")).text();
ok("one description tag", (home.match(/<meta[^>]*name="description"/g) ?? []).length === 1);
ok("canonical points at the live address", home.includes(`<link rel="canonical" href="${BASE}"`) || home.includes(`rel="canonical" href="${BASE}"`));
const ld = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
const data = ld ? JSON.parse(ld[1].replace(/\\u003c/g, "<")) : [];
ok("structured data parses", Array.isArray(data) && data.length === 3);
ok("it describes the product, the organisation and the FAQ", ["WebApplication", "Organization", "FAQPage"].every((t) => data.some((d) => d["@type"] === t)));
ok("the FAQ has all eight questions", data.find((d) => d["@type"] === "FAQPage")?.mainEntity?.length === 8);
ok("link previews have an absolute image", home.includes(`content="${BASE}/og.jpg"`));
const pricing = await (await fetch(BASE + "/pricing")).text();
ok("a public page has its own canonical", pricing.includes(`href="${BASE}/pricing"`));
const studio = await (await fetch(BASE + "/studio")).text();
ok("a private page is kept out of search", studio.includes('name="robots" content="noindex"') && !studio.includes('rel="canonical"'));
const nf = await fetch(BASE + "/no-such-page");
ok("an unknown address is a real 404", nf.status === 404);
ok("with a branded page, not a trace", (await nf.text()).includes("That page is not here"));
const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
ok("the sitemap lists the six public pages", (sitemap.match(/<loc>/g) ?? []).length === 6 && sitemap.includes(`${BASE}/help`));
ok("and none of the private ones", !sitemap.includes("/studio") && !sitemap.includes("/account"));
const robots = await (await fetch(BASE + "/robots.txt")).text();
ok("robots names the sitemap and blocks private pages", robots.includes(`Sitemap: ${BASE}/sitemap.xml`) && robots.includes("Disallow: /studio") && robots.includes("Disallow: /api/"));
const sec = await (await fetch(BASE + "/.well-known/security.txt")).text();
ok("security.txt has a contact and an expiry", sec.includes("Contact: mailto:hi@example.com") && /Expires: \d{4}-\d{2}-\d{2}T/.test(sec));

// ---------- headers
const h = (await fetch(BASE + "/")).headers;
const csp = h.get("content-security-policy") ?? "";
ok("the security policy lets Cloudflare's check load and nothing else new", csp.includes("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com") && csp.includes("frame-src https://challenges.cloudflare.com"));
ok("framing, sniffing and plugins are blocked", csp.includes("frame-ancestors 'none'") && h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff" && csp.includes("object-src 'none'"));

// ---------- fonts come from this site, not from Google
const fontPage = await newPage(browser, { turnstile: "none" });
const outside = [];
fontPage.on("request", (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) outside.push(r.url()); });
await fontPage.goto(BASE + "/", { waitUntil: "networkidle" });
await fontPage.waitForTimeout(500);
ok("no request goes to Google Fonts", outside.length === 0);
ok("the display font loads from this site", await fontPage.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.includes("Fraunces") && f.status === "loaded"); }));
ok("the body font loads from this site", await fontPage.evaluate(() => [...document.fonts].some((f) => f.family.includes("Outfit") && f.status === "loaded")));
ok("the policy no longer allows Google's font servers", !csp.includes("fonts.googleapis.com") && !csp.includes("fonts.gstatic.com") && csp.includes("font-src 'self'"));

// ---------- the quick draft with the security check
const page = await newPage(browser);
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await agree(page);
const captured = [];
page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("_serverFn") && (r.postData() ?? "").includes("turnstile")) captured.push(r); });
await page.getByPlaceholder("Hi, what time are you open on Saturday?").fill("Hi, what time are you open on Saturday?");
await page.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await page.getByRole("button", { name: "Draft a reply" }).click();
await page.getByLabel("Your draft").waitFor({ timeout: 15000 });
ok("the quick draft works with the security check", (await page.getByLabel("Your draft").inputValue()).includes("Hi Maria"));
const calls = await mock("/__calls", 9915);
ok("the server verified the token with Cloudflare", calls.length === 1 && calls[0].success === true);
ok("the FAQ shows on the front page", (await page.getByRole("heading", { name: "Questions people ask first." }).count()) === 1);
const req = captured[0];
const headers = { ...req.headers() };
for (const k of ["host", "content-length", "origin", "referer", "cookie"]) delete headers[k];
const replay = (body) => fetch(req.url(), { method: "POST", headers: { ...headers, origin: BASE }, body }).then((r) => r.text());
ok("reusing the same token is refused", (await replay(req.postData())).includes("security check"));
const token = /tok-[a-z0-9]+/.exec(req.postData())?.[0] ?? "";
ok("a forged token is refused", (await replay(req.postData().replace(token, "forged-token"))).includes("security check"));
ok("a request with no token is refused", (await replay(req.postData().replace(token, ""))).includes("security check"));
ok("no security-policy violations on the front page, quick draft or help", page.violations.length === 0);
if (page.violations.length) console.log("   ", [...new Set(page.violations)].slice(0, 5));

// ---------- usage counts
await buildWeek(page);
await page.getByRole("tab", { name: "Try a real note" }).click();
await agree(page);
await page.getByPlaceholder("Paste the messy").fill("What time do you open?");
await page.getByRole("button", { name: "Draft it" }).click();
await page.getByLabel("Your draft").waitFor({ timeout: 15000 });
await page.getByLabel("Your draft").fill("We open at 9.");
await page.getByRole("link", { name: "Open in WhatsApp" }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
await page.getByRole("link", { name: "Open in WhatsApp" }).click();
await page.goto(BASE + "/pricing", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
let events = await mock("/__events");
const total = (name) => Object.entries(events).filter(([k]) => k.endsWith("|" + name)).reduce((n, [, v]) => n + v, 0);
ok("each step of the funnel is counted", ["visit", "quick_draft", "week_built", "draft_created", "send_clicked", "pricing_view"].every((e) => total(e) >= 1));
// Two separate browser sessions have visited so far (the font check and the main flow), and the main one moved across many pages.
ok("a visit is counted once per session, not per page", total("visit") === 2);
await page.goto(BASE + "/learn", { waitUntil: "networkidle" });
await page.goto(BASE + "/help", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
events = await mock("/__events");
ok("moving between pages in one session adds no more visits", total("visit") === 2);
const dnt = await newPage(browser, { turnstile: "none" });
await dnt.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }));
const before = total("visit");
await dnt.goto(BASE + "/", { waitUntil: "networkidle" });
await dnt.waitForTimeout(600);
ok("Do Not Track is respected", total("visit") === before && Object.keys(await mock("/__events")).length === Object.keys(events).length);
const gpc = await newPage(browser, { turnstile: "none" });
await gpc.addInitScript(() => Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true }));
await gpc.goto(BASE + "/", { waitUntil: "networkidle" });
await gpc.waitForTimeout(600);
ok("Global Privacy Control is respected", total("visit") === before);
const post = (event, extra = {}) => fetch(BASE + "/api/event", { method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify({ event }) });
ok("an unknown event name is refused", (await post("buy_everything")).status === 400);
ok("a cross-site event is refused", (await post("visit", { origin: "https://evil.example" })).status === 403);
ok("stats need the secret", (await fetch(BASE + "/api/stats")).status === 401);
const stats = await (await fetch(BASE + "/api/stats?days=7", { headers: { authorization: "Bearer " + SECRET } })).json();
ok("stats show totals and a funnel", stats.totals.visit >= 1 && stats.funnel.length === 4 && stats.funnel[1].step === "week_built" && /%$/.test(stats.funnel[1].fromPrevious));
ok("stored counts carry no identifiers", Object.keys(events).every((k) => /^\d{4}-\d{2}-\d{2}\|[a-z_]+$/.test(k)));

// ---------- error reports
const err = await newPage(browser, { turnstile: "none" });
await err.goto(BASE + "/learn", { waitUntil: "networkidle" });
await err.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { error: new Error("boom for maria@shop.com at 0803 123 4567") })));
await err.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { error: new Error("boom for maria@shop.com at 0803 123 4567") })));
for (let i = 0; i < 8; i += 1) await err.evaluate((n) => window.dispatchEvent(new ErrorEvent("error", { error: new Error("different problem " + n) })), i);
await err.waitForTimeout(1200);
const hooks = (await mock("/__hooks", 9912)).filter((x) => x.path === "/error");
ok("a browser error reaches the alert channel", hooks.length >= 1 && hooks[0].body.text.includes("boom"));
ok("the same error is sent once", hooks.filter((x) => x.body.message.includes("boom for")).length === 1);
ok("no more than five reports per page load", hooks.length === 5);
ok("private details are masked in the report", !JSON.stringify(hooks).includes("maria@shop.com") && !JSON.stringify(hooks).includes("0803 123") && JSON.stringify(hooks).includes("[EMAIL]"));
ok("the report names the page", hooks[0].body.path === "/learn");
const report = (body, extra = {}) => fetch(BASE + "/api/client-error", { method: "POST", headers: { "content-type": "application/json", ...extra }, body });
ok("an oversized report is refused", (await report(JSON.stringify({ message: "x".repeat(6000) }))).status === 413);
ok("malformed input is refused", (await report("{nope")).status === 400);
ok("a cross-site report is refused", (await report(JSON.stringify({ message: "x" }), { origin: "https://evil.example" })).status === 403);

ok("no unexpected page errors", page.errors.length === 0 && err.errors.length === 0);
await browser.close();
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
