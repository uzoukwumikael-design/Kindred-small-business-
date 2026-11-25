const { mergeSnapshots } = await import("../../src/lib/kindling/merge.ts");
let bad = 0;
const t = (name: string, cond: boolean) => { if (!cond) bad++; console.log((cond ? "PASS " : "FAIL ") + name); };
const shop = { name: "Braid Bar", offer: "", tone: "warm" as const, hourly: 40, voiceSample: "", channel: "whatsapp" as const };
const base = () => ({ shop, intake: null, checks: {}, sharpened: {}, drafts: {}, baselines: {}, log: [], facts: [], learned: [], deleted: [] as string[] });
const fact = (id: string, value = "v") => ({ id, key: "custom", label: id, value, checkedOn: "2026-10-12" });
const run = (id: string, minutes = 5) => ({ id, day: "2026-10-12", workflowId: "reply-desk", minutes });
const ex = (id: string) => ({ id, text: "Hi there, thanks " + id, workflowId: "reply-desk", channel: "whatsapp" as const, day: "2026-10-12" });

// device A deleted fact f1; stale device B still has it and saves something else
const A = { ...base(), facts: [fact("f2")], deleted: ["f1"] };
const B = { ...base(), facts: [fact("f1"), fact("f2"), fact("f3")] };
const m1 = mergeSnapshots(B, A);
t("a deleted fact does not come back when the stale device merges", !m1.facts.some((f) => f.id === "f1"));
t("other facts survive", m1.facts.map((f) => f.id).sort().join() === "f2,f3");
t("the deletion is remembered", m1.deleted.includes("f1"));
const m2 = mergeSnapshots(A, B);
t("it also holds when the up-to-date device does the merge", !m2.facts.some((f) => f.id === "f1") && m2.facts.some((f) => f.id === "f3"));

const A2 = { ...base(), log: [run("r2")], deleted: ["r1"] };
const B2 = { ...base(), log: [run("r1"), run("r2"), run("r3", 8)] };
const m3 = mergeSnapshots(B2, A2);
t("a deleted run stays deleted", m3.log.map((r) => r.id).sort().join() === "r2,r3");

const A3 = { ...base(), learned: [ex("e2")], deleted: ["e1"] };
const B3 = { ...base(), learned: [ex("e1"), ex("e2")] };
t("a forgotten example stays forgotten", mergeSnapshots(B3, A3).learned.map((l) => l.id).join() === "e2");

t("additions from both devices are kept", mergeSnapshots({ ...base(), facts: [fact("x")] }, { ...base(), facts: [fact("y")] }).facts.length === 2);
t("the same fact edited locally keeps the local value", mergeSnapshots({ ...base(), facts: [fact("x", "new")] }, { ...base(), facts: [fact("x", "old")] }).facts[0].value === "new");
t("deleted lists from both sides are combined", mergeSnapshots({ ...base(), deleted: ["a"] }, { ...base(), deleted: ["b"] }).deleted.sort().join() === "a,b");
t("the deleted list is capped", mergeSnapshots({ ...base(), deleted: Array.from({ length: 400 }, (_, i) => "d" + i) }, base()).deleted.length === 300);
t("ticks are combined and the local shop wins", mergeSnapshots({ ...base(), checks: { a: true } }, { ...base(), checks: { b: true }, shop: { ...shop, name: "Old" } }).shop.name === "Braid Bar");
t("merging with nothing changes nothing", JSON.stringify(mergeSnapshots(base(), base()).facts) === "[]");
process.exit(bad ? 1 : 0);
