/**
 * Exports the examples people chose to share into files for training. Run it yourself, on your own machine.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npm run export-training
 *
 * It needs the service role key, which can read every row, so keep that key private.
 * What it does:
 *   - keeps only rows from people whose consent is still on
 *   - masks again, and drops any row where something private-looking is still left
 *   - replaces user ids with a salted, one-way cohort code, so one person's examples stay together in a split
 *     but nobody can be identified from the files
 *   - writes data/exports/needs.jsonl (for npm run train), finetune-train.jsonl and finetune-val.jsonl (chat format)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { channelRules } from "../src/lib/kindling/channels";
import { languageRules } from "../src/lib/kindling/languages";
import { redact } from "../src/lib/kindling/redact";

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outDir = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "data/exports";
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(2);
}

async function rest<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

type Example = {
  user_id: string;
  workflow: string;
  channel: string;
  language: string;
  note: string;
  draft: string;
  final: string;
  facts_used: string[];
  needs: string[];
  brackets_before: number;
  issues: number;
  edit_ratio: number | null;
  source: string;
};

const consented = new Set((await rest<{ user_id: string }>("kindling_training_consent?consented=eq.true&select=user_id")).map((r) => r.user_id));
const all = await rest<Example>("kindling_training_examples?select=*&order=created_at");

const salt = process.env.EXPORT_SALT || crypto.randomBytes(16).toString("hex");
const cohort = (id: string) => crypto.createHash("sha256").update(salt + id).digest("hex").slice(0, 10);
const intentOf = (workflow: string) => (/confirm/i.test(workflow) ? "schedule" : /quote|scaffold/i.test(workflow) ? "quote" : "reply");

let dropped = 0;
let notConsented = 0;
const needsRows: string[] = [];
const train: string[] = [];
const val: string[] = [];

for (const ex of all) {
  if (!consented.has(ex.user_id)) {
    notConsented += 1;
    continue;
  }
  // defence in depth: if masking would still change anything, the row is not safe to export
  if (redact(ex.note).count > 0 || redact(ex.final).count > 0 || redact(ex.draft).count > 0) {
    dropped += 1;
    continue;
  }
  const c = cohort(ex.user_id);
  needsRows.push(JSON.stringify({ text: ex.note, needs: ex.needs, intent: intentOf(ex.workflow), cohort: c }));
  const system = [
    "You write short replies for the owner of a small shop. Use only facts that appear in the note. Mark anything missing as [CHECK: what is missing]. Never invent prices, times or promises.",
    ex.channel ? `Channel: ${channelRules(ex.channel as never)}` : "",
    ex.language && ex.language !== "english" ? `Language: ${languageRules(ex.language as never)}` : "",
  ].filter(Boolean).join("\n");
  const line = JSON.stringify({
    messages: [
      { role: "system", content: system },
      { role: "user", content: ex.note },
      { role: "assistant", content: ex.final },
    ],
    meta: { cohort: c, workflow: ex.workflow, language: ex.language, edit_ratio: ex.edit_ratio },
  });
  (parseInt(c.slice(0, 4), 16) % 10 === 0 ? val : train).push(line);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/needs.jsonl`, needsRows.join("\n") + (needsRows.length ? "\n" : ""));
fs.writeFileSync(`${outDir}/finetune-train.jsonl`, train.join("\n") + (train.length ? "\n" : ""));
fs.writeFileSync(`${outDir}/finetune-val.jsonl`, val.join("\n") + (val.length ? "\n" : ""));
const stats = { exportedAt: new Date().toISOString(), rows: all.length, exported: needsRows.length, droppedAsUnsafe: dropped, skippedNoConsent: notConsented, cohorts: new Set(needsRows.map((r) => JSON.parse(r).cohort)).size, trainChat: train.length, valChat: val.length };
fs.writeFileSync(`${outDir}/stats.json`, JSON.stringify(stats, null, 2));
console.log(stats);
if (needsRows.length < 300) console.log("Note: fewer than 300 examples. That is too few to fine-tune a language model, and still thin for the need model.");
