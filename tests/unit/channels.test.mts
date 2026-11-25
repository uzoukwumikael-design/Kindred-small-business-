const { findChecks, sendTarget, splitEmail, usesChannel, channelRules } = await import("../../src/lib/kindling/channels.ts");
const { offlineDraft } = await import("../../src/lib/kindling/offline.ts");
const { fillPrompt, promptFor, WORKFLOWS, DEFAULT_SHOP } = await import("../../src/lib/kindling/catalog.ts");
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };

t("finds every bracket", findChecks("Hi [CHECK: name], total [CHECK: price] ok [check: x]").length === 3);
t("ignores normal square brackets", findChecks("see [1] and [note]").length === 0);
t("no brackets means none", findChecks("All fixed.").length === 0);

const msg = "Hi Tola,\nSunday 2pm works & I'll bring N15,000 change?";
const wa = sendTarget("whatsapp", msg);
t("whatsapp link points at wa.me", wa.href!.startsWith("https://wa.me/?text="));
t("whatsapp link round-trips the exact text", decodeURIComponent(wa.href!.split("text=")[1]) === msg);
t("whatsapp link keeps the ampersand safe", !wa.href!.slice(20).includes("&") );
const sms = sendTarget("text", msg);
t("sms link uses the sms scheme and body", sms.href!.startsWith("sms:?&body=") && decodeURIComponent(sms.href!.split("body=")[1]) === msg);
const mail = sendTarget("email", "Subject: Your booking\n\nHi Tola,\nSee you Sunday.");
t("email link has the subject and body split", mail.href!.startsWith("mailto:?subject=Your%20booking&body=") && decodeURIComponent(mail.href!.split("&body=")[1]) === "Hi Tola,\nSee you Sunday.");
t("email without a subject still works", sendTarget("email", "Hi").href!.startsWith("mailto:?subject=&body="));
t("dm has no link, copy only", sendTarget("dm", "x").href === null);
t("long whatsapp message is flagged", sendTarget("whatsapp", "a".repeat(2000)).tooLong && !sendTarget("whatsapp", "short").tooLong);
t("splitEmail handles upper case and no subject", splitEmail("SUBJECT: Hi\nbody").subject === "Hi" && splitEmail("just body").subject === "");
t("javascript links cannot be made from text", !sendTarget("whatsapp", "javascript:alert(1)").href!.startsWith("javascript"));

t("message jobs use a channel", ["replies", "schedule", "money", "quotes"].every(usesChannel));
t("posts, lists, ads do not", ["marketing", "paperwork", "stock", "hiring"].every((p) => !usesChannel(p)));

const base = { mode: "draft" as const, businessName: "Braid Bar", offer: "braids", toneLine: "warm", tradeLabel: "Salon", workflowTitle: "The reply desk", workflowIntent: "", outputShape: "", promptTemplate: "", sourceText: "Tola here, can I move my Saturday 10am to Sunday?", extraRules: "", voiceSample: "", channel: "whatsapp" as const, useChannel: true };
const w = offlineDraft(base);
t("whatsapp draft has no formal sign-off", !w.text.includes("Best,") && !w.text.includes("Subject:"));
t("whatsapp draft keeps its brackets", findChecks(w.text).length >= 1);
t("template notes are kept out of the message", !w.text.includes("Template draft") && w.notes.some((n) => n.startsWith("Template draft")));
const e = offlineDraft({ ...base, channel: "email" });
t("email draft starts with a subject placeholder", e.text.startsWith("Subject: [CHECK: subject line]"));
t("email draft has a sign-off with the business name", e.text.includes("Best,\nBraid Bar"));
const off = offlineDraft({ ...base, channel: "email", useChannel: false });
t("channel is ignored when the job is not a message", !off.text.startsWith("Subject:"));
const chase = offlineDraft({ ...base, workflowTitle: "The kind chase", channel: "dm" });
t("dm chase has no sign-off", !chase.text.includes("Best,"));

const reply = WORKFLOWS.find((x) => x.pain === "replies")!;
const post = WORKFLOWS.find((x) => x.pain === "marketing")!;
const rp = fillPrompt(promptFor(reply, "salon"), { ...DEFAULT_SHOP, name: "Braid Bar", channel: "email" });
t("reply prompt carries the channel rules", rp.includes("Where it will be sent: ") && rp.includes(channelRules("email")));
const pp = fillPrompt(promptFor(post, "salon"), { ...DEFAULT_SHOP, name: "Braid Bar", channel: "email" });
t("post prompt does not mention a channel", !pp.includes("Where it will be sent"));
t("no leftover placeholders", !rp.includes("{{") && !pp.includes("{{"));
t("no em dashes in channel rules", !JSON.stringify(["whatsapp","text","email","dm"].map(channelRules)).includes("\u2014"));
process.exit(bad ? 1 : 0);
