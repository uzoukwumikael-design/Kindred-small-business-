import fs from "node:fs";
const L = await import(new URL("../../src/lib/kindling/languages.ts", import.meta.url).pathname);
const T = await import(new URL("../../src/lib/kindling/training.ts", import.meta.url).pathname);
const { analyze, modelInfo } = await import(new URL("../../src/lib/kindling/needs/index.ts", import.meta.url).pathname);
const { trainNeedModel, modelPredictor, score } = await import(new URL("../../src/lib/kindling/needs/train.ts", import.meta.url).pathname);
const { predict } = await import(new URL("../../src/lib/kindling/needs/model.ts", import.meta.url).pathname);
const { NEED_KEYS, regexNeeds } = await import(new URL("../../src/lib/kindling/needs/regex.ts", import.meta.url).pathname);
const { fillPrompt, promptFor, WORKFLOWS, DEFAULT_SHOP } = await import(new URL("../../src/lib/kindling/catalog.ts", import.meta.url).pathname);
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };

// ---------- languages
t("plain English is English", L.detectLanguage("Hi, what time are you open on Saturday?") === "english");
t("Pidgin is spotted", L.detectLanguage("abeg wetin be the price, una dey open tomorrow?") === "pidgin");
t("one strong Pidgin word is enough", L.detectLanguage("how far, I wan book") === "pidgin");
t("Hausa is spotted", L.detectLanguage("Sannu, nawa ne kudin?") === "hausa");
t("Igbo is spotted", L.detectLanguage("Ndewo, biko ego ole ka o bu?") === "igbo");
t("Yoruba is spotted", L.detectLanguage("E kaaro, jowo elo ni?") === "yoruba");
t("an everyday English word is not mistaken for a language", L.detectLanguage("I don't know if she will come, na") === "english" || L.detectLanguage("I don't know if she will come, na") === "pidgin");
t("empty text is English", L.detectLanguage("") === "english");
t("match resolves against the note", L.effectiveLanguage("match", "abeg una dey open?") === "pidgin" && L.effectiveLanguage("match", "Are you open?") === "english");
t("a fixed choice ignores the note", L.effectiveLanguage("yoruba", "Are you open?") === "yoruba");
t("English needs no native check; others do", !L.needsNativeCheck("english") && L.needsNativeCheck("pidgin") && L.needsNativeCheck("hausa"));
t("every language has a label and non-English has rules", L.LANGUAGES.every((l) => l.label) && L.LANGUAGES.filter((l) => l.id !== "english").every((l) => l.rules.includes("[CHECK")));
const reply = WORKFLOWS.find((w) => w.pain === "replies")!;
const withPidgin = fillPrompt(promptFor(reply, "salon"), { ...DEFAULT_SHOP, language: "pidgin" });
t("the copy-paste prompt carries the language rule", withPidgin.includes("Language: Write in everyday Nigerian Pidgin"));
t("English adds no language line", !fillPrompt(promptFor(reply, "salon"), DEFAULT_SHOP).includes("Language:"));
t("no leftover placeholders", !withPidgin.includes("{{"));

// ---------- masking and contributions
const hints = T.nameHints("Hi Maria, it's Tola here. Order for Mr Okafor", "Maria wants to move her order");
t("names are found in greetings, intros and titles", ["Maria", "Tola", "Okafor"].every((n) => hints.includes(n)));
t("days and common words are not names", T.nameHints("Hi Saturday, hello Thanks, Good Morning").length === 0);
t("names are masked case-insensitively", T.maskNames("Hi Maria, maria paid. MARIA!", ["Maria"]) === "Hi [NAME], [NAME] paid. [NAME]!");
t("only whole words are masked", T.maskNames("Mariana and Maria", ["Maria"]) === "Mariana and [NAME]");
t("no edits is a ratio of 0", T.editRatio("same text", "same text") === 0);
t("a total rewrite is near 1", T.editRatio("abcdefghij", "zyxwvutsrq") > 0.9);
t("a small edit is small", T.editRatio("Sunday works at 2", "Sunday works at 3") < 0.1);
const facts = [
  { id: "1", key: "hours", label: "Opening hours", value: "Mon to Sat 9am to 6pm. Closed Sunday.", checkedOn: "2026-10-12" },
  { id: "2", key: "payment", label: "Payment link", value: "https://paystack.shop/braid", checkedOn: "2026-10-12" },
];
const note = "Hi, Maria here (maria@shop.com, 0803 123 4567). What time are you open? my card is 4111 1111 1111 1111";
const original = "Hi Maria, [CHECK: opening hours]. Thanks";
const final = "Hi Maria, we are open Mon to Sat 9am to 6pm. Thanks";
const { contribution: c, masked } = T.prepareContribution({ note, draft: original, final, workflow: "reply-desk", channel: "whatsapp", language: "english", facts, source: "live", today: "2026-10-13" });
const flat = JSON.stringify(c);
t("the email, phone and card are gone", !/maria@shop|0803 123|4111/.test(flat));
t("the name is gone from every field", !/Maria/.test(c.note + c.draft + c.final) && c.final.includes("[NAME]"));
t("masking is counted for the preview", masked >= 4);
t("the facts used are recorded by type", c.facts_used.join() === "hours");
t("needs combine the fact used and what the keyword rules see", c.needs.includes("hours"));
t("brackets in the first draft are counted", c.brackets_before === 1);
t("the edit amount is recorded", c.edit_ratio > 0 && c.edit_ratio <= 1);
t("nothing about the shop or account is included", !("user_id" in c) && !/Braid|owner/.test(flat));

// ---------- the model
const rows = (f: string) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const seed = rows(new URL("../../data/seed/needs.jsonl", import.meta.url).pathname);
const hard = rows(new URL("../../data/seed/hard-set.jsonl", import.meta.url).pathname);
const small = seed.filter((r: any) => r.split === "train").slice(0, 400).map((r: any) => ({ text: r.text, needs: r.needs, intent: r.intent }));
const opts = { seed: 3, needs: NEED_KEYS, intents: ["reply", "schedule", "quote"], epochs: 8 };
const m1 = trainNeedModel(small, opts);
const m2 = trainNeedModel(small, opts);
m1.trainedAt = m2.trainedAt = "x";
t("training is reproducible: same data and seed give the same model", JSON.stringify(m1) === JSON.stringify(m2));
const m3 = trainNeedModel(small, { ...opts, seed: 4 });
m3.trainedAt = "x";
t("a different seed gives a different model", JSON.stringify(m1) !== JSON.stringify(m3));
t("a model trained on little data still learns something", score(modelPredictor(m1), small.slice(0, 200), NEED_KEYS).microF1 > 0.7);
t("probabilities are valid", predict(m1, "what time do you open").needs.every((n: any) => n.p >= 0 && n.p <= 1) && Math.abs(predict(m1, "x").intent.reduce((a: number, b: any) => a + b.p, 0) - 1) < 1e-9);
const withVal = trainNeedModel(small, { ...opts, validation: small.slice(0, 100) });
t("thresholds are tuned inside a sensible range", Object.values(withVal.thresholds).every((x: any) => x >= 0.2 && x <= 0.8));

const info = modelInfo();
t("the shipped model is trained", info.trained && info.examples > 1000);
t("the shipped model is small", fs.statSync(new URL("../../src/lib/kindling/needs/need-model.json", import.meta.url).pathname).size < 600_000);
const hardEx = hard.map((r: any) => ({ text: r.text, needs: r.needs, intent: r.intent }));
const real = score((x: string) => ({ needs: analyze(x).needs.map((n: any) => n.key), intent: analyze(x).intent }), hardEx, NEED_KEYS);
const rules = score((x: string) => ({ needs: regexNeeds(x) }), hardEx, NEED_KEYS);
console.log(`   hard set: model ${(real.microF1 * 100).toFixed(1)}%, rules ${(rules.microF1 * 100).toFixed(1)}%, job type ${(real.intentAccuracy * 100).toFixed(1)}%`);
t("the shipped model beats the keyword rules on the hand-written set", real.microF1 > rules.microF1 + 0.05);
t("it reads the job type well enough to use", real.intentAccuracy > 0.85);
for (const [text, want] of [["Hi, what time are you open on Saturday?", "hours"], ["abeg where una dey", "location"], ["how much for the black dress", "prices"], ["I wan book for Friday", "booking"], ["can I pay by transfer", "payment"]] as const) {
  t(`"${text}" needs ${want}`, analyze(text).needs.some((n: any) => n.key === want));
}
for (const text of ["Thank you so much!", "Good morning", "Hello", "ok noted", "God bless you", "see you soon"]) {
  t(`"${text}" needs nothing`, analyze(text).needs.length === 0);
}
t("a quote request is read as a quote", analyze("can you give me a quote for painting two rooms").intent === "quote");
t("a booking change is read as a booking", analyze("can I move my appointment to Friday").intent === "schedule");
t("empty and odd input is safe", analyze("").source === "none" && analyze("   ").needs.length === 0 && analyze("\u0000\u0001 ????").needs.length >= 0 && analyze("a".repeat(5000)).needs.length >= 0);
process.exit(bad ? 1 : 0);
