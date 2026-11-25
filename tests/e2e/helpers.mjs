import { chromium } from "playwright";

export const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:8090";
export const SECRET = "cronsecret-which-is-long-enough";
export const results = { pass: 0, fail: 0 };
export const ok = (name, cond) => {
  if (cond) results.pass += 1; else results.fail += 1;
  console.log((cond ? "PASS " : "FAIL ") + name);
};

const TURNSTILE_STUB = `
  (() => {
    const reg = {};
    const newToken = () => "tok-" + Math.random().toString(36).slice(2) + Date.now();
    window.turnstile = {
      render(el, o) { const id = "w" + Math.random().toString(36).slice(2); el.dataset.widget = id; reg[id] = o; setTimeout(() => o.callback(newToken()), 30); return id; },
      reset(id) { const o = reg[id]; if (o) setTimeout(() => o.callback(newToken()), 30); },
      remove(id) { delete reg[id]; },
    };
  })();
`;

export async function launch() {
  return chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
}

/** A fresh browser context with the Turnstile stand-in, security-policy and error collection. */
export async function newPage(browser, { turnstile = "stub", ...contextOptions } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...contextOptions });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  if (turnstile === "stub") {
    await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: TURNSTILE_STUB }),
    );
  } else if (turnstile === "blocked") {
    await context.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  }
  const page = await context.newPage();
  page.errors = [];
  page.violations = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.exposeFunction("__csp", (v) => page.violations.push(v));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => window.__csp(`${e.violatedDirective} blocked ${e.blockedURI}`)));
  return page;
}

export const mock = (path, port = 9913) => fetch(`http://127.0.0.1:${port}${path}`).then((r) => r.json());

export async function agree(page) {
  const button = page.getByRole("button", { name: "I agree, send my notes for drafting" });
  await button.waitFor({ timeout: 2500 }).then(() => button.click()).catch(() => {});
}

export async function buildWeek(page, shop = "Test Shop") {
  await page.goto(BASE + "/bench", { waitUntil: "networkidle" });
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByPlaceholder("North & Rye").fill(shop);
  await page.getByRole("button", { name: /Show my week/ }).click();
  await page.getByRole("tab", { name: "Run it" }).waitFor({ timeout: 10000 });
}

export function summary(page) {
  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  if (page?.errors?.length) console.log("PAGE ERRORS:", page.errors);
  process.exitCode = results.fail ? 1 : 0;
}
