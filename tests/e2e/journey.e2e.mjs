// The main product flow in a real browser: build a week, shop facts, drafting, the locked send button, channels, languages,
// masking, the time log, house rules, lessons and sharing in. (AI is a stand-in that always answers with a bracket.)
import { BASE, agree, buildWeek, launch, mock, newPage, ok, results } from "./helpers.mjs";

const browser = await launch();
await fetch("http://127.0.0.1:9913/__reset");
const p = await newPage(browser);
const bodies = async () => (await mock("/__bodies", 9911)).map((b) => b.contents?.[0]?.parts?.[0]?.text ?? "");
const draft = async (note) => {
  const before = (await bodies()).length;
  await p.getByPlaceholder("Paste the messy").fill(note);
  await p.getByRole("button", { name: "Draft it" }).click();
  for (let i = 0; i < 60 && (await bodies()).length <= before; i += 1) await p.waitForTimeout(250);
  await p.waitForFunction(() => document.querySelector('textarea[aria-label="Your draft"]')?.value.includes("[CHECK: Sunday opening time]"), null, { timeout: 15000 });
  return (await bodies()).at(-1);
};

// ---------- build the week
await buildWeek(p, "Braid Bar");
ok("five questions lead to a plan for one job", (await p.locator("h1").first().innerText()).includes("The reply desk"));
ok("the plan shows hours back and no new tools", (await p.locator("main").innerText()).includes("New tools"));
for (const tab of ["Run it", "Prompt", "Shop facts", "Try a real note", "House rules", "Hours"]) ok(`the ${tab} tab exists`, (await p.getByRole("tab", { name: tab }).count()) === 1);

// ---------- shop facts, kept across a reload
await p.getByRole("tab", { name: "Shop facts" }).click();
await p.getByPlaceholder("Mon to Sat 9am to 6pm. Closed Sunday.").fill("Mon to Sat 9am to 6pm. Closed Sunday.");
await p.getByPlaceholder("Mon to Sat 9am to 6pm. Closed Sunday.").blur();
await p.reload({ waitUntil: "networkidle" });
await p.getByRole("tab", { name: "Shop facts" }).click();
ok("a saved fact survives a reload", (await p.getByPlaceholder("Mon to Sat 9am to 6pm. Closed Sunday.").inputValue()).startsWith("Mon to Sat"));
await p.getByRole("tab", { name: "Prompt" }).click();
ok("the copy-paste prompt carries the checked fact", (await p.locator("pre").first().innerText()).includes("Opening hours: Mon to Sat 9am to 6pm"));

// ---------- drafting and the locked send button
await p.getByRole("tab", { name: "Try a real note" }).click();
await p.getByRole("button", { name: "I agree, send my notes for drafting" }).waitFor({ timeout: 6000 });
ok("drafting waits for the person to agree to the AI notice", await p.getByRole("button", { name: "Draft it" }).isDisabled());
await agree(p);
const first = await draft("Hi, Maria here (maria@shop.com). What time are you open on Saturday? my card is 4111 1111 1111 1111");
ok("the AI request carries the shop facts", first.includes("<shop_facts>") && first.includes("Mon to Sat 9am to 6pm"));
ok("the AI never receives the email or the card number", !first.includes("maria@shop.com") && !first.includes("4111 1111") && first.includes("[EMAIL]"));
ok("the person was warned about it", (await p.locator("main").innerText()).includes("replaced with placeholders"));
ok("a draft with a bracket cannot be sent", await p.getByRole("button", { name: /Open in WhatsApp \(locked\)/ }).isDisabled());
ok("the bracket is listed so the person can fix it", (await p.locator("main").innerText()).includes("[CHECK: Sunday opening time]"));
const box = p.getByLabel("Your draft");
await box.fill("Hi Maria, we are open Mon to Sat 9am to 6pm.");
const link = p.getByRole("link", { name: "Open in WhatsApp" });
ok("fixing every bracket unlocks sending", (await link.getAttribute("href")).startsWith("https://wa.me/?text="));
ok("the link carries exactly the edited message", decodeURIComponent((await link.getAttribute("href")).split("text=")[1]) === "Hi Maria, we are open Mon to Sat 9am to 6pm.");
ok("it opens in a new tab safely", (await link.getAttribute("target")) === "_blank" && (await link.getAttribute("rel")).includes("noopener"));
ok("it says which of the person's facts it used", (await p.locator("main").innerText()).includes("came from your facts: Opening hours"));
await box.fill("Hi Maria, the total is $135 and it is free [CHECK: x]");
ok("typing a bracket locks it again", await p.getByRole("button", { name: /Open in WhatsApp \(locked\)/ }).isDisabled());
await box.fill("Hi Maria, the total is $135 and it is free to change.");
const flags = await p.getByLabel("Double-check these").innerText();
ok("invented amounts and promises are called out", flags.includes('"$135"') && flags.includes('"free"'));

// ---------- channels and languages
await p.getByRole("button", { name: "Email" }).click();
await box.fill("Subject: Booking\n\nHi Maria, see you Saturday.");
ok("email gets a mail link with a subject", (await p.getByRole("link", { name: "Open in email" }).getAttribute("href")).startsWith("mailto:?subject=Booking&body="));
await p.getByRole("button", { name: "Text (SMS)" }).click();
ok("text gets an sms link", (await p.getByRole("link", { name: "Open in Messages" }).getAttribute("href")).startsWith("sms:?&body="));
await p.getByRole("button", { name: "Instagram or Facebook DM" }).click();
ok("a DM is copy only", (await p.getByRole("button", { name: "Copy for your DM" }).count()) === 1 && (await p.getByRole("link", { name: /Open in/ }).count()) === 0);
await p.getByRole("button", { name: "WhatsApp" }).click();
await p.getByRole("button", { name: "Pidgin" }).click();
const pidgin = await draft("abeg una dey open tomorrow?");
ok("a local language is passed to the AI", pidgin.includes("<language>") && pidgin.includes("Pidgin"));
ok("and brings a reminder to have a speaker read it", (await p.locator("main").innerText()).includes("Ask someone who speaks the language"));
await p.getByRole("button", { name: "English" }).click();

// ---------- the time log and the weekly summary
await p.getByRole("tab", { name: "Hours" }).click();
await p.getByPlaceholder("15").fill("20");
for (const m of ["6", "8"]) { await p.getByPlaceholder("6").fill(m); await p.getByRole("button", { name: "Add run" }).click(); }
ok("two timed runs add up to the minutes saved", /Saved so far\s*26 min/.test(await p.locator("main").innerText()));
ok("the weekly summary says it in one line", (await p.locator("main").innerText()).includes("you ran it 2 times and got back 26 minutes"));

// ---------- house rules as a shareable page
await p.getByRole("tab", { name: "House rules" }).click();
await p.getByRole("button", { name: "Copy a link for the crew" }).click();
const shared = await p.evaluate(() => navigator.clipboard.readText());
const q = await newPage(browser, { turnstile: "none" });
await q.goto(shared.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
ok("the shared rules page shows the rules, for anyone with the link", (await q.locator("ol li").count()) >= 5 && (await q.locator("h1").innerText()).length > 5);
await q.goto(BASE + "/rules?d=garbage", { waitUntil: "networkidle" });
ok("a damaged link says so plainly", (await q.locator("h1").innerText()).includes("full link"));

// ---------- lessons
const l = await newPage(browser, { turnstile: "none" });
await l.goto(BASE + "/learn", { waitUntil: "networkidle" });
for (let i = 0; i < 6; i += 1) await l.getByRole("button", { name: "Hand it over" }).nth(i).click();
await l.waitForTimeout(500);
ok("a lesson marks itself done after the practice", (await l.getByText("Done", { exact: true }).count()) === 1);
await l.reload({ waitUntil: "networkidle" });
ok("lesson progress survives a reload", (await l.getByText("Done", { exact: true }).count()) === 1);

// ---------- sharing in from another app
const s = await newPage(browser, { turnstile: "none" });
await s.goto(BASE + "/share?text=" + encodeURIComponent("Can I move my Saturday 2pm to Sunday? Tola"), { waitUntil: "networkidle" });
await s.waitForURL("**/bench");
ok("sharing before a week exists leads to building one", true);
for (let i = 0; i < 5; i += 1) { await s.getByRole("option").first().click(); await s.getByRole("button", { name: "Next" }).click(); }
await s.getByRole("button", { name: /Show my week/ }).click();
await s.getByPlaceholder("Paste the messy").waitFor({ timeout: 10000 });
ok("the shared message is waiting in the note box", (await s.getByPlaceholder("Paste the messy").inputValue()).startsWith("Can I move my Saturday 2pm"));

// ---------- the privacy page tells the truth about this setup
const pr = await newPage(browser, { turnstile: "none" });
await pr.goto(BASE + "/privacy", { waitUntil: "networkidle" });
const pt = await pr.locator("main").innerText();
ok("it names the AI service in use", pt.includes("Google Gemini"));
ok("it covers counting, error reports and the security check", pt.includes("Counting which features get used") && pt.includes("Finding and fixing errors") && pt.includes("Cloudflare"));
ok("it names the operator and the contact", pt.includes("Test Operator Ltd") && pt.includes("hi@example.com"));
ok("no em dashes in the pages tested", ![pt, await p.locator("main").innerText()].some((t) => t.includes("\u2014")));
ok("Start over clears the week", await (async () => { await p.getByRole("button", { name: "Start over" }).click(); await p.getByRole("button", { name: "Yes, clear this week" }).click(); await p.waitForTimeout(500); return (await p.locator("body").innerText()).includes("hasn’t been built") || (await p.locator("body").innerText()).includes("built yet"); })());
ok("no security-policy violations anywhere", [p, q, l, s, pr].every((x) => x.violations.length === 0));
ok("no unexpected page errors", [p, q, l, s, pr].every((x) => x.errors.length === 0));
await browser.close();
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
