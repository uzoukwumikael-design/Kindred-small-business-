// Password reset end to end, the security check on sign-in, and no account enumeration.
import { BASE, launch, mock, newPage, ok, results } from "./helpers.mjs";

const browser = await launch();
await fetch("http://127.0.0.1:9913/__reset");
const OLD = "oldpassword1";
const NEW = "brandnewpass2";
const email = "owner@shop.com";
const supa = (path, body) => fetch("http://127.0.0.1:9913" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
await supa("/auth/v1/signup", { email, password: OLD });
await fetch("http://127.0.0.1:9913/__captcha?on=1");

const page = await newPage(browser);
// ---------- asking for the link
await page.goto(BASE + "/reset-password", { waitUntil: "networkidle" });
ok("the reset page asks for an email first", await page.getByRole("heading", { name: "Reset your password." }).isVisible());
await page.getByPlaceholder("you@yourshop.com").fill("not an email");
await page.getByRole("button", { name: "Send me a reset link" }).click();
ok("a bad address is caught", (await page.locator("main").innerText()).includes("Enter the email address you signed up with"));
await page.getByPlaceholder("you@yourshop.com").fill(email);
await page.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await page.getByRole("button", { name: "Send me a reset link" }).click();
await page.getByText("If that address has an account").waitFor({ timeout: 8000 });
let recover = await mock("/__recover");
ok("the reset request carries the security check token", recover.length === 1 && recover[0].email === email && recover[0].captcha.startsWith("tok-"));
ok("the link is told to return to the reset page", (recover[0].redirect ?? "").endsWith("/reset-password"));
await page.getByPlaceholder("you@yourshop.com").fill("nobody@nowhere.com");
await page.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await page.getByRole("button", { name: "Send me a reset link" }).click();
await page.waitForTimeout(600);
ok("an address with no account gets exactly the same answer", (await page.locator("main").innerText()).includes("If that address has an account") && (await mock("/__recover")).length === 2);

// ---------- opening the link from the email
const session = await mock(`/__session?email=${email}`);
const hash = `#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`;
// A link in an email opens a brand new page, so the test uses one too.
const rec = await newPage(browser);
await rec.goto(BASE + "/reset-password" + hash, { waitUntil: "networkidle" });
await rec.getByRole("heading", { name: "Choose a new password." }).waitFor({ timeout: 8000 });
ok("the emailed link opens the new-password form", true);
const fill = async (a, b) => {
  await rec.getByLabel("New password").fill(a);
  await rec.getByLabel("Type it again").fill(b);
  await rec.getByRole("button", { name: "Change my password" }).click();
};
await fill("abc", "abc");
ok("a short password is refused", (await rec.locator("main").innerText()).includes("at least 8 characters"));
await fill("brandnewpass2", "different999");
ok("passwords that do not match are refused", (await rec.locator("main").innerText()).includes("do not match"));
await fill(OLD, OLD);
await rec.getByText("have not used for this account before").waitFor({ timeout: 6000 });
ok("the old password is refused as the new one", true);
await fill(NEW, NEW);
await rec.getByRole("heading", { name: "It is changed." }).waitFor({ timeout: 8000 });
ok("a good new password is accepted", (await rec.locator("main").innerText()).includes("You are signed in"));
const signIn = (password) => supa("/auth/v1/token?grant_type=password", { email, password, gotrue_meta_security: { captcha_token: "tok-check" } }).then((r) => r.status);
ok("the new password now works", (await signIn(NEW)) === 200);
ok("and the old one no longer does", (await signIn(OLD)) === 400);

// ---------- bad and missing links
const stale = await newPage(browser);
await stale.goto(BASE + "/reset-password#access_token=bad&refresh_token=bad&expires_in=3600&token_type=bearer&type=recovery", { waitUntil: "networkidle" });
await stale.waitForTimeout(800);
ok("an invalid link falls back to asking for a new one", await stale.getByRole("heading", { name: "Reset your password." }).isVisible());
ok("with no way to reach the new-password form", (await stale.getByRole("button", { name: "Change my password" }).count()) === 0);
const plain = await newPage(browser);
await plain.goto(BASE + "/reset-password", { waitUntil: "networkidle" });
ok("visiting with no link only offers the request form", (await plain.getByRole("button", { name: "Change my password" }).count()) === 0);

// ---------- signing in with the new password, through the form
const si = await newPage(browser);
await si.goto(BASE + "/account", { waitUntil: "networkidle" });
await si.getByRole("tab", { name: "Password" }).click();
ok("the sign-in form links to the reset page", (await si.getByRole("link", { name: "Forgot your password?" }).getAttribute("href")) === "/reset-password");
await si.getByPlaceholder("you@yourshop.com").fill(email);
await si.getByPlaceholder("At least 8 characters").fill(NEW);
await si.getByRole("checkbox").first().check();
await si.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await si.getByRole("button", { name: "Sign in" }).last().click();
await si.waitForURL("**/bench", { timeout: 8000 });
ok("signing in with the new password works and the check passes", true);

// ---------- the security check on sign-up, and what happens if it cannot load
const up = await newPage(browser);
await up.goto(BASE + "/account", { waitUntil: "networkidle" });
await up.getByRole("tab", { name: "Create account" }).click();
await up.getByPlaceholder("you@yourshop.com").fill("new@shop.com");
await up.getByPlaceholder("At least 8 characters").fill("hunter22pass");
await up.getByRole("checkbox").first().check();
await up.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await up.getByRole("button", { name: "Create account" }).last().click();
await up.waitForURL("**/bench", { timeout: 8000 });
ok("sign-up passes when the check passes", (await mock("/__users")).some((u) => u.email === "new@shop.com"));
const dup = await newPage(browser);
await dup.goto(BASE + "/account", { waitUntil: "networkidle" });
await dup.getByRole("tab", { name: "Create account" }).click();
await dup.getByPlaceholder("you@yourshop.com").fill("new@shop.com");
await dup.getByPlaceholder("At least 8 characters").fill("hunter22pass");
await dup.getByRole("checkbox").first().check();
await dup.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
await dup.getByRole("button", { name: "Create account" }).last().click();
await dup.waitForTimeout(1200);
const dupText = await dup.locator("main").innerText();
ok("an address that already has an account gets a neutral message", dupText.includes("If that address can be used") && !dupText.toLowerCase().includes("already"));
const blocked = await newPage(browser, { turnstile: "blocked" });
await blocked.goto(BASE + "/account", { waitUntil: "networkidle" });
await blocked.getByRole("tab", { name: "Create account" }).click();
await blocked.getByPlaceholder("you@yourshop.com").fill("blocked@shop.com");
await blocked.getByPlaceholder("At least 8 characters").fill("hunter22pass");
await blocked.getByRole("checkbox").first().check();
await blocked.getByRole("button", { name: "Create account" }).last().click();
await blocked.waitForTimeout(1000);
const bt = await blocked.locator("main").innerText();
ok("if the check cannot load, the person is told why", bt.includes("security check could not load"));
ok("and no account is created without it", bt.includes("Wait for the security check") && !(await mock("/__users")).some((u) => u.email === "blocked@shop.com"));
ok("no security-policy violations in any sign-in or reset page", [page, rec, stale, plain, si, up, dup].every((p) => p.violations.length === 0));
ok("no unexpected page errors", [page, rec, stale, plain, si, up, dup, blocked].every((p) => p.errors.length === 0));
await browser.close();
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
