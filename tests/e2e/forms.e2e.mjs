// The help form and the update list: delivery, consent, the security check, the honeypot and the rate limit.
import { BASE, agree, launch, mock, newPage, ok, results } from "./helpers.mjs";

const browser = await launch();
await fetch("http://127.0.0.1:9912/__reset");
await fetch("http://127.0.0.1:9915/__reset");
await fetch("http://127.0.0.1:9913/__reset");
const waitCheck = (p) => p.getByText("Checking that you are a person").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
const hooks = async (path) => (await mock("/__hooks", 9912)).filter((h) => h.path === path);

// ---------- help form
const help = await newPage(browser);
await help.goto(BASE + "/help", { waitUntil: "networkidle" });
ok("the help page has the FAQ", (await help.locator("details").count()) === 8);
ok("and the contact form", await help.getByRole("heading", { name: "Still stuck? Tell us." }).isVisible());
await help.getByRole("button", { name: "Send", exact: true }).click();
ok("an empty message is refused", (await help.locator("main").innerText()).includes("write a little more"));
await help.getByLabel("What is on your mind?").fill("The send button stays grey after I fixed every bracket.");
await help.getByRole("button", { name: "Something is wrong" }).click();
await help.getByLabel("Where can we reply? (optional)").fill("not-an-email");
await waitCheck(help);
await help.getByRole("button", { name: "Send", exact: true }).click();
await help.getByText("reply address does not look right").waitFor({ timeout: 6000 });
ok("a bad reply address is refused by the server", (await hooks("/feedback")).length === 0);
await help.getByLabel("Where can we reply? (optional)").fill("owner@shop.com");
await waitCheck(help);
await help.getByRole("button", { name: "Send", exact: true }).click();
await help.getByText("Thank you. We read every message.").waitFor({ timeout: 8000 });
let sent = await hooks("/feedback");
ok("a valid message reaches the webhook", sent.length === 1 && sent[0].body.kind === "problem" && sent[0].body.replyTo === "owner@shop.com" && sent[0].body.page === "/help");
ok("it reads well in a chat tool", sent[0].body.text.startsWith("[problem] The send button") && sent[0].body.text.includes("Reply to: owner@shop.com"));
ok("the security check was verified server-side", (await mock("/__calls", 9915)).some((c) => c.success));
await help.waitForTimeout(900);
ok("the send is counted without identifying anyone", Object.keys(await mock("/__events")).some((k) => k.endsWith("|feedback_sent")));
ok("the reply promise matches what was given", (await help.locator("main").innerText()).includes("We will reply to the address you gave"));

// honeypot: a bot fills the hidden field and is told it worked, but nothing is sent
const bot = await newPage(browser);
await bot.goto(BASE + "/help", { waitUntil: "networkidle" });
await bot.getByLabel("What is on your mind?").fill("Buy cheap watches at example dot com right now friend.");
await bot.locator('input[name="company"]').evaluate((el) => {
  // React only notices a change made through the native setter, which is what a real browser autofill or bot does.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "Spam Ltd");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await waitCheck(bot);
await bot.getByRole("button", { name: "Send", exact: true }).click();
await bot.waitForTimeout(1500);
ok("a bot is not told it was caught", (await bot.locator("main").innerText()).includes("Thank you"));
ok("and nothing reaches the webhook", (await hooks("/feedback")).length === 1);

// rate limit: five an hour from one connection
let refused = false;
for (let i = 0; i < 8 && !refused; i += 1) {
  const p = await newPage(browser);
  await p.goto(BASE + "/help", { waitUntil: "networkidle" });
  await p.getByLabel("What is on your mind?").fill(`Another genuine message number ${i} about the product.`);
  await waitCheck(p);
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.waitForTimeout(700);
  refused = (await p.locator("main").innerText()).includes("Too many messages");
}
ok("a flood from one connection is stopped", refused);
ok("at most five messages got through", (await hooks("/feedback")).length <= 5);

// ---------- update list
const land = await newPage(browser);
await land.goto(BASE + "/", { waitUntil: "networkidle" });
await land.getByPlaceholder("you@yourshop.com").fill("fan@shop.com");
await waitCheck(land);
await land.getByRole("button", { name: "Tell me" }).click();
ok("the update list refuses without the consent box", (await land.locator("main").innerText()).includes("Tick the box to say you want these emails"));
await land.getByRole("checkbox").check();
await land.getByRole("button", { name: "Tell me" }).click();
await land.getByText("You are on the list").waitFor({ timeout: 8000 });
const wl = await hooks("/waitlist");
ok("the sign-up and its consent record reach the webhook", wl.length === 1 && wl[0].body.email === "fan@shop.com" && wl[0].body.consent?.given === true);
const calls = await mock("/__calls", 9915);
ok("every public form is behind the security check", calls.filter((c) => c.success).length >= 2);
ok("no tokens were reused", new Set(calls.map((c) => c.token)).size === calls.length);
ok("no security-policy violations on the forms", [help, bot, land].every((p) => p.violations.length === 0));
ok("no unexpected page errors", [help, bot, land].every((p) => p.errors.length === 0));
await browser.close();
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
