/**
 * Runs sample customer messages through the real drafting engine and checks each result.
 *
 *   npx tsx scripts/eval-prompts.mts            uses whichever AI key is set in your environment
 *   GEMINI_API_KEY=... npx tsx scripts/eval-prompts.mts
 *
 * With no key it runs the built-in template drafter, so you can see the script work. Replace evals/samples.json
 * with real messages from your own shop (remove private details first) for a result that means something.
 * It writes evals/report.md and exits with an error if any case fails.
 */
import fs from "node:fs";
import path from "node:path";
import { channelRules, findChecks, usesChannel } from "../src/lib/kindling/channels";
import { checkDraft } from "../src/lib/kindling/checks";
import { generate } from "../src/lib/kindling/ai-core.server";
import type { AiInput } from "../src/lib/kindling/ai";

type Case = {
  id: string;
  title: string;
  workflowTitle: string;
  channel: "whatsapp" | "text" | "email" | "dm";
  note: string;
  mustInclude?: string[];
  mustNotMatch?: string[];
  mustMatch?: string[];
  brackets?: "required" | "forbidden" | "any";
  maxChars?: number;
};

const file = process.argv[2] ?? path.join("evals", "samples.json");
const spec = JSON.parse(fs.readFileSync(file, "utf8")) as {
  shop: { businessName: string; offer: string; toneLine: string; tradeLabel: string; facts: { key: string; label: string; value: string }[] };
  cases: Case[];
};

const today = new Date().toISOString().slice(0, 10);
let failed = 0;
const report: string[] = [`# Prompt evaluation`, "", `Run on ${today}. Source: ${file}.`, ""];

for (const item of spec.cases) {
  const input: AiInput = {
    mode: "draft",
    businessName: spec.shop.businessName,
    offer: spec.shop.offer,
    toneLine: spec.shop.toneLine,
    tradeLabel: spec.shop.tradeLabel,
    workflowTitle: item.workflowTitle,
    workflowIntent: "",
    outputShape: "Only the message, ready to paste. Keep every [CHECK] marker.",
    promptTemplate: "",
    sourceText: item.note,
    extraRules: "",
    voiceSample: "",
    channel: item.channel,
    useChannel: usesChannel(item.channel === "email" ? "replies" : "replies"),
    facts: spec.shop.facts.map((fact) => ({ ...fact, checkedOn: today })),
    learned: [],
    styleNotes: "",
  };
  const result = await generate(input);
  if (!result.ok) {
    failed += 1;
    console.log(`FAIL ${item.id}: ${result.error}`);
    report.push(`## ${item.id}: FAIL`, "", result.error, "");
    continue;
  }
  const text = result.text;
  const problems: string[] = [];
  for (const needle of item.mustInclude ?? []) if (!text.toLowerCase().includes(needle.toLowerCase())) problems.push(`missing "${needle}"`);
  for (const pattern of item.mustNotMatch ?? []) if (new RegExp(pattern, "i").test(text)) problems.push(`matches forbidden /${pattern}/`);
  for (const pattern of item.mustMatch ?? []) if (!new RegExp(pattern, "im").test(text)) problems.push(`does not match /${pattern}/`);
  const brackets = findChecks(text).length;
  if (item.brackets === "required" && brackets === 0) problems.push("needed a [CHECK] bracket but has none");
  if (item.brackets === "forbidden" && brackets > 0) problems.push(`has ${brackets} bracket(s) but the facts should cover it`);
  if (item.maxChars && text.length > item.maxChars) problems.push(`is ${text.length} characters, over ${item.maxChars}`);
  const flags = checkDraft({
    draft: text,
    note: item.note,
    facts: spec.shop.facts,
    channel: item.channel,
    useChannel: true,
  });
  for (const flag of flags) problems.push(`checker: ${flag.detail}`);

  const ok = problems.length === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${item.id} (${result.source})${ok ? "" : ": " + problems.join("; ")}`);
  report.push(`## ${item.id}: ${ok ? "PASS" : "FAIL"} (${result.source})`, "", `**${item.title}**`, "", "Note:", "", "```", item.note, "```", "", "Draft:", "", "```", text, "```", "");
  if (!ok) report.push("Problems:", "", ...problems.map((p) => `- ${p}`), "");
}

const total = spec.cases.length;
report.push("---", "", `${total - failed} of ${total} passed. Channel rules used: ${channelRules("whatsapp")}`);
fs.mkdirSync("evals", { recursive: true });
fs.writeFileSync(path.join("evals", "report.md"), report.join("\n"));
console.log(`\n${total - failed} of ${total} passed. Report written to evals/report.md`);
process.exit(failed ? 1 : 0);
