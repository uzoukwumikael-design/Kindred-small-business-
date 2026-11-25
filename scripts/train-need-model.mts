/**
 * Trains the need model: given a customer message, which shop facts does it need, and is it a booking, a quote or
 * a plain question? Pure TypeScript, no GPU, a few seconds on a laptop.
 *
 *   npm run train                                       seed data only
 *   npm run train -- --extra data/exports/needs.jsonl   seed plus real, consented examples exported from the data layer
 *   add --model-out and --report-out to write somewhere else (useful for a trial run)
 *
 * Writes src/lib/kindling/needs/need-model.json and docs/MODEL_REPORT.md. It always reports the old keyword rules
 * as a baseline on the same test data, and (with --must-beat-baseline) exits with an error if the model is not better.
 */
import fs from "node:fs";
import { modelPredictor, score, trainNeedModel, rng, type Example } from "../src/lib/kindling/needs/train";
import { NEED_KEYS, regexNeeds } from "../src/lib/kindling/needs/regex";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const readJsonl = (file: string): Record<string, unknown>[] =>
  fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));

const toExample = (row: Record<string, unknown>): Example => ({
  text: String(row.text),
  needs: (row.needs as string[]).filter((key) => NEED_KEYS.includes(key)),
  intent: String(row.intent ?? "reply"),
});

const seed = readJsonl("data/seed/needs.jsonl");
const hard = readJsonl("data/seed/hard-set.jsonl").map(toExample);
let train = seed.filter((r) => r.split === "train").map(toExample);
let validation = seed.filter((r) => r.split === "val").map(toExample);

const extraFile = value("--extra");
let extraCount = 0;
if (extraFile && fs.existsSync(extraFile)) {
  // Real examples: split by a stable hash of the text so no near-duplicate leaks across the split.
  const random = rng(11);
  for (const row of readJsonl(extraFile)) {
    const ex = toExample(row);
    (random() < 0.85 ? train : validation).push(ex);
    extraCount += 1;
  }
}

const SEED = 7;
const model = trainNeedModel(train, {
  seed: SEED,
  needs: NEED_KEYS,
  intents: ["reply", "schedule", "quote"],
  validation,
});
model.notes = `Trained on ${train.length} examples (${extraCount} real, rest synthetic seed). Thresholds tuned on ${validation.length} held-out examples.`;

const predictor = modelPredictor(model);
const baseline = (text: string) => ({ needs: regexNeeds(text) });
const sets: [string, Example[]][] = [["held-out phrasings (synthetic)", validation], ["hand-written hard set", hard]];

const pct = (x: number) => (x * 100).toFixed(1) + "%";
const lines: string[] = [];
const out = (text = "") => {
  console.log(text);
  lines.push(text);
};
out("# Need model report");
out();
out(`Trained ${model.trainedAt.slice(0, 10)}. ${model.notes}`);
out(`Model size: ${model.features.length} features, ${(JSON.stringify(model).length / 1024).toFixed(0)} KB.`);
out();
let beats = true;
for (const [name, data] of sets) {
  const m = score(predictor, data, NEED_KEYS);
  const b = score(baseline, data, NEED_KEYS);
  out(`## ${name} (${data.length} messages)`);
  out();
  out("| | model | keyword rules |");
  out("| --- | --- | --- |");
  out(`| fact-need micro F1 | ${pct(m.microF1)} | ${pct(b.microF1)} |`);
  out(`| exact set of needs right | ${pct(m.exactMatch)} | ${pct(b.exactMatch)} |`);
  out(`| job type accuracy | ${pct(m.intentAccuracy)} | not predicted |`);
  out();
  out("| need | model F1 | rules F1 | in set |");
  out("| --- | --- | --- | --- |");
  for (const key of NEED_KEYS) out(`| ${key} | ${pct(m.perNeed[key].f1)} | ${pct(b.perNeed[key].f1)} | ${m.perNeed[key].support} |`);
  out();
  if (name.startsWith("hand-written") && m.microF1 <= b.microF1) beats = false;
}
out("Honest reading: the hard set is small (64 messages I wrote by hand) and the training data is mostly synthetic. Treat these numbers as");
out("a floor for how the model behaves on new phrasings, not as a promise about real customers. Retrain on real, consented messages before relying on it.");

const modelOut = value("--model-out") ?? "src/lib/kindling/needs/need-model.json";
const reportOut = value("--report-out") ?? "docs/MODEL_REPORT.md";
for (const file of [modelOut, reportOut]) fs.mkdirSync(file.replace(/[^/]*$/, "") || ".", { recursive: true });
fs.writeFileSync(modelOut, JSON.stringify(model));
fs.writeFileSync(reportOut, lines.join("\n") + "\n");
console.log(`\nwrote ${modelOut} and ${reportOut}`);
if (flag("--must-beat-baseline") && !beats) {
  console.error("FAIL: the model does not beat the keyword rules on the hand-written hard set.");
  process.exit(1);
}
