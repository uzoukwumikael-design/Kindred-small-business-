process.env.CRON_SECRET = "s3cret";
process.env.VITE_SUPABASE_URL = "http://x";
const { isDue, buildEmail, unsubscribeLink, unsubscribe } = await import("../../src/lib/kindling/weekly.server.ts");
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };

// 2026-10-12 is a Monday (weekday 1)
const mon = "2026-10-12", tue = "2026-10-13", nextMon = "2026-10-19", nextTue = "2026-10-20", wed2 = "2026-10-21";
t("off means never due", !isDue({ weekly_email: false, weekday: 1, last_sent_on: null }, mon));
t("new person gets it on their weekday", isDue({ weekly_email: true, weekday: 1, last_sent_on: null }, mon));
t("new person does not get it on another day", !isDue({ weekly_email: true, weekday: 1, last_sent_on: null }, tue));
t("not due again within seven days", !isDue({ weekly_email: true, weekday: 1, last_sent_on: mon }, tue));
t("due again a week later on their day", isDue({ weekly_email: true, weekday: 1, last_sent_on: mon }, nextMon));
t("eight days on, a different weekday still catches up", isDue({ weekly_email: true, weekday: 1, last_sent_on: mon }, nextTue));
t("six days on is never due", !isDue({ weekly_email: true, weekday: 1, last_sent_on: mon }, "2026-10-18"));
t("missed week catches up the next day", isDue({ weekly_email: true, weekday: 1, last_sent_on: mon }, "2026-10-20"));
t("catch-up never fires early", !isDue({ weekly_email: true, weekday: 1, last_sent_on: "2026-10-14" }, "2026-10-20"));

const baselines = { "reply-desk": 20 };
const personal = {
  shop: { name: "Braid Bar", hourly: 40 },
  intake: { trade: "salon", team: "solo", pain: "replies", maturity: "never", worry: "cost" },
  baselines,
  log: [
    { id: "a", day: "2026-10-12", workflowId: "reply-desk", minutes: 6 },
    { id: "b", day: "2026-10-11", workflowId: "reply-desk", minutes: 8 },
    { id: "c", day: "2026-10-03", workflowId: "reply-desk", minutes: 10 },
  ],
};
const crew = [{ id: "t1", name: "Salon crew", state: { baselines, log: [
  { id: "x", day: "2026-10-12", workflowId: "reply-desk", minutes: 5, by: "owner" },
  { id: "y", day: "2026-10-11", workflowId: "reply-desk", minutes: 9, by: "tola" } ] } }];
const link = await unsubscribeLink("https://kindling.example", "11111111-1111-1111-1111-111111111111");
const mail = buildEmail({ prefs: { email: "owner@x.com" }, personal, crews: crew, today: "2026-10-13", origin: "https://kindling.example", unsubscribeUrl: link });
console.log("---\n" + mail.subject + "\n" + mail.text + "\n---");
t("summary kind when there are runs", mail.kind === "summary");
t("personal week counted (2 runs, 26 min)", mail.text.includes("ran it 2 times") && mail.text.includes("26 minutes"));
t("older run outside the week not counted", !mail.text.includes("3 times"));
t("crew shows only my runs under my name", mail.text.includes("You ran it 1 time and got back 15 minutes"));
t("crew shows the whole crew total", mail.text.includes("whole crew ran it 2 times and got back 26 minutes"));
t("subject carries the total", mail.subject.includes("41 minutes"));
t("job title included", mail.text.includes("Your job:"));
t("unsubscribe link in text and html", mail.text.includes("/unsubscribe?u=") && mail.html.includes("/unsubscribe?u="));
t("html escapes shop names", !buildEmail({ prefs: { email: "a@b.c" }, personal: { ...personal, shop: { name: "<b>x</b>", hourly: 40 } }, crews: [], today: "2026-10-13", origin: "https://k", unsubscribeUrl: "https://k/u" }).html.includes("<b>x</b>"));
const empty = buildEmail({ prefs: { email: "owner@x.com" }, personal: { ...personal, log: [] }, crews: [], today: "2026-10-13", origin: "https://k.example", unsubscribeUrl: "https://k.example/unsubscribe?u=1&t=2" });
t("no runs gives a nudge", empty.kind === "nudge" && empty.subject === "Nothing logged this week");
t("no em dashes anywhere", !mail.text.includes("\u2014") && !mail.html.includes("\u2014") && !empty.text.includes("\u2014"));
t("signed link has a long hex signature", /t=[0-9a-f]{64}$/.test(link));
t("a tampered signature is refused", (await unsubscribe("11111111-1111-1111-1111-111111111111", "0".repeat(64))) === false);
t("a malformed user id is refused", (await unsubscribe("not-a-uuid", "00")) === false);
process.exit(bad ? 1 : 0);
