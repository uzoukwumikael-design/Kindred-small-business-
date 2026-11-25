// Accessibility scan (axe) of every page and each studio tab. Fails on serious or critical problems.
import AxeBuilder from "@axe-core/playwright";
import { BASE, agree, buildWeek, launch, newPage, ok, results } from "./helpers.mjs";

const browser = await launch();
await fetch("http://127.0.0.1:9913/__reset");
const found = [];

async function scan(page, name) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of serious) console.log(`   [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.any[0]?.message ?? n.failureSummary ?? "").slice(0, 110)).join(" | ")}`);
  for (const v of violations) found.push({ page: name, id: v.id, impact: v.impact, nodes: v.nodes.length, target: (v.nodes[0]?.target ?? []).join(" "), help: v.help });
  ok(`${name}: no serious or critical accessibility problems${violations.length - serious.length ? ` (${violations.length - serious.length} minor)` : ""}`, serious.length === 0);
}

const p = await newPage(browser);
for (const path of ["/", "/pricing", "/learn", "/help", "/privacy", "/terms", "/reset-password", "/account", "/join?code=x", "/no-such-page"]) {
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await scan(p, path);
}
await p.goto(BASE + "/bench", { waitUntil: "networkidle" });
await scan(p, "/bench (first question)");
await buildWeek(p);
for (const tab of ["Run it", "Prompt", "Shop facts", "Try a real note", "House rules", "Hours"]) {
  await p.getByRole("tab", { name: tab }).click();
  await p.waitForTimeout(300);
  await scan(p, `/studio, ${tab}`);
}
await p.getByRole("tab", { name: "Try a real note" }).click();
await agree(p);
await p.getByPlaceholder("Paste the messy").fill("Hi, what time are you open on Saturday?");
await p.getByRole("button", { name: "Draft it" }).click();
await p.getByLabel("Your draft").waitFor({ timeout: 15000 });
await scan(p, "/studio, a draft with brackets");
await p.getByLabel("Your draft").fill("We open at 9.");
await scan(p, "/studio, a finished draft");
await p.goto(BASE + "/", { waitUntil: "networkidle" });
await scan(p, "/ (after visiting the app)");
const rules = Buffer.from(JSON.stringify({ name: "Test", job: "The reply desk", rules: "House rules\nOne short page.\n1. Read every draft.\n2. Fix every bracket." })).toString("base64url");
await p.goto(BASE + "/rules?d=" + rules, { waitUntil: "networkidle" });
await scan(p, "/rules (shared page)");
if (found.length) {
  console.log("\nAll findings (including minor):");
  const seen = new Set();
  for (const f of found) { const k = `${f.id}|${f.target}`; if (seen.has(k)) continue; seen.add(k); console.log(` - [${f.impact}] ${f.id} on ${f.page}: ${f.help} (${f.nodes} element${f.nodes === 1 ? "" : "s"}, e.g. ${f.target})`); }
}
await browser.close();
console.log(`\n${results.pass} passed, ${results.fail} failed`);
process.exitCode = results.fail ? 1 : 0;
