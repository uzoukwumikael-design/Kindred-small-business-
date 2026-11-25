const F = await import("../../src/lib/kindling/facts.ts");
const { offlineDraft } = await import("../../src/lib/kindling/offline.ts");
const { fillPrompt, promptFor, WORKFLOWS, DEFAULT_SHOP, PAINS, workflowFor } = await import("../../src/lib/kindling/catalog.ts");
const { usesChannel } = await import("../../src/lib/kindling/channels.ts");
const { redact } = await import("../../src/lib/kindling/redact.ts");
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };

const today = "2026-10-12";
const mk = (key: string, label: string, value: string, checkedOn = today) => ({ id: key + checkedOn, key, label, value, checkedOn });
const hours = mk("hours", "Opening hours", "Mon to Sat 9am to 6pm. Closed Sunday.");
const old = mk("prices", "Prices", "Plain braids from 15,000", "2026-06-01");
const blank = mk("location", "Where", "   ");

t("fresh fact is usable", F.usableFacts([hours], today).length === 1);
t("fact older than 90 days is stale", F.isStale(old, today));
t("exactly 90 days is still fresh", !F.isStale(mk("a", "A", "x", "2026-07-14"), today));
t("91 days is stale", F.isStale(mk("a", "A", "x", "2026-07-13"), today));
t("stale and blank facts are not usable", F.usableFacts([hours, old, blank], today).length === 1);
t("ai payload carries key, label, value, date", JSON.stringify(F.factsForAi([hours], today)[0]) === JSON.stringify({ key: "hours", label: "Opening hours", value: hours.value, checkedOn: today }));
t("ai payload drops stale facts", F.factsForAi([old], today).length === 0);
t("ai payload caps at 20", F.factsForAi(Array.from({ length: 30 }, (_, i) => mk("custom", "L" + i, "v" + i)), today).length === 20);
t("prompt block lists fresh facts with dates", F.factsBlock([hours], today).includes("- Opening hours: Mon to Sat 9am to 6pm. Closed Sunday. (confirmed 2026-10-12)"));
t("prompt block is empty with no usable facts", F.factsBlock([old, blank], today) === "");

t("detects an hours fact used in a draft", F.factsUsed("Hi Tola, we are open Mon to Sat 9am to 6pm.", [hours]).join() === "Opening hours");
t("does not claim an unused fact", F.factsUsed("Hi Tola, Sunday at 2pm works.", [mk("prices", "Prices", "Plain braids from 15,000")]).length === 0);
t("detects a link exactly", F.factsUsed("Leave one here: https://g.page/r/abc", [mk("review-link", "Review link", "https://g.page/r/abc")]).length === 1);
t("a different link is not a match", F.factsUsed("Leave one here: https://g.page/r/zzz", [mk("review-link", "Review link", "https://g.page/r/abc")]).length === 0);

// style learning
const L = (text: string, id = text) => ({ id, text, workflowId: "reply-desk", channel: "whatsapp" as const, day: today });
t("no notes with only two examples", F.styleProfile([L("Hi Tola, yes Sunday works. Thanks", "a"), L("Hi Sam, ready. Thanks", "b")]).confidence === "none");
t("and nothing is sent to the AI as style", F.styleForAi([L("Hi Tola, yes. Thanks", "a"), L("Hi Sam, ready. Thanks", "b")]) === "");
const three = [
  L("Hi Tola, yes Sunday works. I'll see you at 2.\nThanks", "a"),
  L("Hi Sam, it's ready for pickup.\nThanks", "b"),
  L("Hi Ada, we don't have blue today.\nThanks", "c"),
];
const prof = F.styleProfile(three);
console.log("   notes:", prof.notes.join(" | "));
t("three examples give an early guess", prof.confidence === "early" && prof.count === 3);
t("notes say how many messages back them", prof.notes.some((n) => n.includes('open with "Hi" in 3 of 3 messages')));
t("notes spot the repeated sign-off with a count", prof.notes.some((n) => n.includes('finish with "Thanks" in 3 of 3 messages')));
t("notes spot no exclamation marks with a count", prof.notes.some((n) => n.includes("do not use exclamation marks (0 of 3 messages)")));
t("notes spot contractions with a count", prof.notes.some((n) => n.includes("short forms") && n.includes("3 of 3")));
t("notes spot no emoji", prof.notes.some((n) => n.includes("do not use emoji")));
t("the AI summary is labelled as an early guess", F.styleForAi(three).startsWith("Early guess from 3 messages: "));
const five = [...three, L("Hi Bola, see you then.\nThanks", "d"), L("Hi Kemi, it's done.\nThanks", "e")];
t("five examples are no longer called a guess", F.styleProfile(five).confidence === "good" && F.styleForAi(five).startsWith("From 5 messages: "));
const mixed = F.styleProfile([L("Hey! Great news", "a"), L("Hello there. Ready", "b"), L("Done", "c")]);
t("mixed greetings claim no pattern either way", !mixed.notes.some((n) => n.includes("open with") || n.includes("skip the greeting")));
const skip = F.styleProfile([L("Ready now", "a"), L("See you at 2", "b"), L("Hi Ada, done", "c")]);
t("mostly skipping the greeting is noticed with a count", skip.notes.some((n) => n.includes("skip the greeting (2 of 3 messages)")));
const loud = F.styleProfile([L("Hey! Great news \ud83c\udf89", "a"), L("Hey! See you soon \ud83d\ude0a", "b"), L("Hey! All set", "c")]);
t("notes spot exclamations and emoji with counts", loud.notes.some((n) => n.includes("exclamation marks often (3 of 3")) && loud.notes.some((n) => n.includes("often use emoji (2 of 3")));
t("only the latest three examples go to the AI", F.learnedForAi(Array.from({ length: 6 }, (_, i) => L("message number " + i, "id" + i))).join("|") === "message number 3|message number 4|message number 5");

// shared notes
t("shared text is used", F.composeSharedNote({ text: "can I move my 2pm?" }) === "can I move my 2pm?");
t("title is used when there is no text", F.composeSharedNote({ title: "Order question" }) === "Order question");
t("url is appended once", F.composeSharedNote({ text: "see this", url: "https://x.com/a" }) === "see this\nhttps://x.com/a" && F.composeSharedNote({ text: "see https://x.com/a", url: "https://x.com/a" }) === "see https://x.com/a");
t("shared note is capped", F.composeSharedNote({ text: "a".repeat(5000) }).length === 1500);
t("empty share gives an empty note", F.composeSharedNote({}) === "");

// offline drafter uses facts
const base = { mode: "draft" as const, businessName: "Braid Bar", offer: "braids", toneLine: "warm", tradeLabel: "Salon", workflowTitle: "The reply desk", workflowIntent: "", outputShape: "", promptTemplate: "", sourceText: "Hi, what time are you open on Saturday?", extraRules: "", voiceSample: "", channel: "whatsapp" as const, useChannel: true, facts: F.factsForAi([hours], today), learned: [], styleNotes: "" };
const d = offlineDraft(base);
t("offline reply answers from the hours fact", d.text.includes("Mon to Sat 9am to 6pm") && !d.text.includes("[CHECK: answer the actual question"));
const d2 = offlineDraft({ ...base, sourceText: "Do you do refunds?" });
t("offline reply still brackets what it was not told", d2.text.includes("[CHECK: answer the actual question"));
const rev = offlineDraft({ ...base, workflowTitle: "The review ask", sourceText: "Tola loved her braids", facts: F.factsForAi([mk("review-link", "Review link", "https://g.page/r/abc")], today) });
t("review ask uses the saved review link", rev.text.includes("https://g.page/r/abc") && !rev.text.includes("[CHECK: your review link]"));
const rev2 = offlineDraft({ ...base, workflowTitle: "The review ask", sourceText: "Tola loved her braids", facts: [] });
t("review ask brackets the link when missing", rev2.text.includes("[CHECK: your review link]"));
t("review ask offers nothing in return", !/discount|free|gift/i.test(rev.text));
const chase = offlineDraft({ ...base, workflowTitle: "The kind chase", sourceText: "invoice 204 overdue", facts: F.factsForAi([mk("payment", "Payment link", "https://paystack.shop/braid")], today) });
t("chase uses the payment link", chase.text.includes("https://paystack.shop/braid"));

const lead = offlineDraft({ ...base, workflowTitle: "The review ask", sourceText: "Tola loved her knotless braids today", facts: F.factsForAi([mk("review-link", "Review link", "https://g.page/r/abc")], today) });
t("a leading name before a verb is recognised", lead.text.startsWith("Hi Tola,") && !lead.text.includes("[CHECK"));
const notName = offlineDraft({ ...base, sourceText: "Order for 3 trays on Saturday", facts: [] });
t("a leading common noun is not mistaken for a name", notName.text.includes("[CHECK: customer name]"));
// review job exists and behaves like the others
const rj = WORKFLOWS.find((w) => w.id === "review-ask")!;
t("review job exists with steps and a Monday list", !!rj && rj.steps.length === 4 && rj.monday.length === 4);
t("review is a pain choice at the end of the list", PAINS[PAINS.length - 1].id === "reviews");
t("review job uses a channel", usesChannel("reviews"));
t("workflowFor finds it", workflowFor("reviews").id === "review-ask");
const pr = fillPrompt(promptFor(rj, "salon"), { ...DEFAULT_SHOP, name: "Braid Bar" }, [hours], today);
t("review prompt carries the no-incentive rule", pr.includes("Offer nothing in return"));
t("filled prompt carries facts", pr.includes("Facts we have checked. These count as known.") && pr.includes("Opening hours"));
t("stale facts stay out of the prompt", !fillPrompt(promptFor(rj, "salon"), DEFAULT_SHOP, [old], today).includes("Prices"));
t("no leftover placeholders", !pr.includes("{{"));

// masking keeps account numbers out of facts
t("an account number in a fact would be masked", redact("Pay to account number: 0123456789").count === 1);
t("a payment link is not masked", redact("https://paystack.shop/braid").count === 0);
t("no em dashes in facts copy", !JSON.stringify(F.FACT_KEYS).includes("\u2014"));
process.exit(bad ? 1 : 0);
