import type { Fact, Learned } from "@/lib/kindling/types";

/** The facts a shop is asked for. Every one is optional. */
export const FACT_KEYS: { key: string; label: string; placeholder: string; hint: string }[] = [
  { key: "hours", label: "Opening hours", placeholder: "Mon to Sat 9am to 6pm. Closed Sunday.", hint: "Include any holiday changes." },
  { key: "location", label: "Where to find you", placeholder: "12 Example Road, behind the market. Yellow gate.", hint: "An address or simple directions." },
  { key: "payment", label: "Payment link", placeholder: "https://paystack.shop/yourshop", hint: "Use a payment link, never a bank account number." },
  { key: "delivery", label: "Delivery or pickup", placeholder: "Pickup free. Delivery within the city, ordered by 2pm for same day.", hint: "Areas, cut-off times, fees you have decided." },
  { key: "prices", label: "Prices you stand behind", placeholder: "Plain braids from 15,000. Prices confirmed on booking.", hint: "Only prices that are true today." },
  { key: "booking", label: "Booking and cancelling", placeholder: "Deposit holds your slot. Free changes up to 24 hours before.", hint: "Your policy in a sentence or two." },
  { key: "returns", label: "Refunds and returns", placeholder: "Exchanges within 7 days with the receipt. No cash refunds.", hint: "Never promise more than you will honour." },
  { key: "review-link", label: "Review link", placeholder: "https://g.page/r/your-review-link", hint: "Where customers leave a review." },
  { key: "contact", label: "How to reach you", placeholder: "WhatsApp this number, or call after 10am.", hint: "Which channel you answer fastest." },
];

/** A fact older than this waits until the owner confirms it again. */
export const STALE_DAYS = 90;

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000);
}

export function ageDays(checkedOn: string, today: string): number {
  return Math.max(0, dayNumber(today) - dayNumber(checkedOn));
}

export function isStale(fact: Pick<Fact, "checkedOn">, today: string): boolean {
  return ageDays(fact.checkedOn, today) > STALE_DAYS;
}

/** Facts that may be used in a draft: filled in and confirmed recently. */
export function usableFacts(facts: Fact[], today: string): Fact[] {
  return facts.filter((fact) => fact.value.trim().length > 0 && !isStale(fact, today));
}

export function factsForAi(facts: Fact[], today: string): { key: string; label: string; value: string; checkedOn: string }[] {
  return usableFacts(facts, today)
    .slice(0, 20)
    .map((fact) => ({ key: fact.key.slice(0, 20), label: fact.label.slice(0, 40), value: fact.value.slice(0, 300), checkedOn: fact.checkedOn }));
}

/** The block added to the copy-paste prompt. Empty when there is nothing usable. */
export function factsBlock(facts: Fact[], today: string): string {
  const list = usableFacts(facts, today);
  if (list.length === 0) return "";
  return [
    "",
    "Facts we have checked. These count as known. Nothing else does:",
    ...list.map((fact) => `- ${fact.label}: ${fact.value} (confirmed ${fact.checkedOn})`),
  ].join("\n");
}

const STOP = new Set("the and for with from that this you your are our was were will can not but have has all any out one".split(" "));

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9:.]*/g) ?? []).filter((word) => word.length > 2 && !STOP.has(word));
}

/** The same match, returning the whole facts so callers can use their keys. */
export function factsUsedDetailed(draft: string, facts: Fact[]): Fact[] {
  const labels = new Set(factsUsed(draft, facts));
  return facts.filter((fact) => labels.has(fact.label));
}

/** Which of the owner's facts appear to have been used in a draft. A guide, not a guarantee. */
export function factsUsed(draft: string, facts: Fact[]): string[] {
  const text = draft.toLowerCase();
  const used: string[] = [];
  for (const fact of facts) {
    const value = fact.value.trim();
    if (!value) continue;
    if (/^https?:\/\//i.test(value)) {
      if (text.includes(value.toLowerCase())) used.push(fact.label);
      continue;
    }
    const wanted = Array.from(new Set(tokens(value)));
    if (wanted.length === 0) continue;
    const hits = wanted.filter((word) => text.includes(word)).length;
    const enough = wanted.length === 1 ? hits === 1 : hits >= 2 && hits / wanted.length >= 0.5;
    if (enough) used.push(fact.label);
  }
  return used;
}

/* ------------------------------------------------------------------ */
/* Learning from kept messages                                         */
/* ------------------------------------------------------------------ */

export const MAX_LEARNED = 8;

export function learnedForAi(learned: Learned[], count = 3): string[] {
  return learned.slice(-count).map((item) => item.text.slice(0, 400));
}

const GREETING = /^(hi|hello|hey|dear|good morning|good afternoon|good evening)\b/i;

function share(list: boolean[]): number {
  return list.length === 0 ? 0 : list.filter(Boolean).length / list.length;
}

export type StyleProfile = { notes: string[]; confidence: "none" | "early" | "good"; count: number };

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Plain-language notes on how the owner writes, counted from their kept messages. No AI involved.
 * Every note says how many messages it is based on. Under three messages it says nothing, because two
 * messages cannot show a pattern, and under five it is labelled an early guess.
 */
export function styleProfile(learned: Learned[]): StyleProfile {
  const bodies = learned.map((item) => item.text.trim()).filter(Boolean);
  const n = bodies.length;
  if (n < 3) return { notes: [], confidence: "none", count: n };
  const half = Math.ceil(n / 2);
  const notes: string[] = [];

  const lineCounts = bodies.map((text) => text.split("\n").filter((line) => line.trim()).length);
  const words = bodies.map((text) => (text.match(/\S+/g) ?? []).length);
  const avgLines = Math.max(1, Math.round(lineCounts.reduce((a, b) => a + b, 0) / n));
  const avgWords = Math.round(words.reduce((a, b) => a + b, 0) / n);
  notes.push(`Your messages run about ${avgWords} words over ${avgLines} ${avgLines === 1 ? "line" : "lines"} (average of ${n}).`);

  const openers = bodies.map((text) => (text.split("\n")[0].match(GREETING)?.[1] ?? "").toLowerCase()).filter(Boolean);
  const openCounts = openers.reduce((map, word) => map.set(word, (map.get(word) ?? 0) + 1), new Map<string, number>());
  const topOpen = [...openCounts].sort((a, b) => b[1] - a[1])[0];
  if (topOpen && topOpen[1] >= half) notes.push(`You open with "${cap(topOpen[0])}" in ${topOpen[1]} of ${n} messages.`);
  else if (openers.length < half) notes.push(`You often skip the greeting (${n - openers.length} of ${n} messages).`);

  const closers = bodies
    .map((text) => (text.split("\n").filter((line) => line.trim()).slice(-1)[0] ?? "").trim().toLowerCase())
    .filter((line) => line.length > 0 && line.length <= 30);
  const closeCounts = closers.reduce((map, line) => map.set(line, (map.get(line) ?? 0) + 1), new Map<string, number>());
  const repeated = [...closeCounts].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])[0];
  if (repeated) notes.push(`You finish with "${cap(repeated[0])}" in ${repeated[1]} of ${n} messages.`);

  const bangs = bodies.filter((text) => text.includes("!")).length;
  notes.push(
    bangs === 0
      ? `You do not use exclamation marks (0 of ${n} messages).`
      : bangs >= half
        ? `You use exclamation marks often (${bangs} of ${n} messages).`
        : `You use exclamation marks sparingly (${bangs} of ${n} messages).`,
  );

  const emoji = bodies.filter((text) => /\p{Extended_Pictographic}/u.test(text)).length;
  if (emoji === 0) notes.push(`You do not use emoji (0 of ${n} messages).`);
  else if (emoji >= half) notes.push(`You often use emoji (${emoji} of ${n} messages).`);

  const contractions = bodies.filter((text) => /\b\w+'(?:ll|re|ve|d|t|s|m)\b/i.test(text)).length;
  if (contractions >= half) notes.push(`You write the way you speak, with short forms like I'll and don't (${contractions} of ${n} messages).`);

  return { notes, confidence: n >= 5 ? "good" : "early", count: n };
}

export function styleNotes(learned: Learned[]): string[] {
  return styleProfile(learned).notes;
}

/** The style guidance sent to the AI, with an honest label for how much it is based on. */
export function styleForAi(learned: Learned[]): string {
  const profile = styleProfile(learned);
  if (profile.notes.length === 0) return "";
  const label = profile.confidence === "early" ? `Early guess from ${profile.count} messages: ` : `From ${profile.count} messages: `;
  return (label + profile.notes.join(" ")).slice(0, 500);
}

/** Turns text shared from another app into one note. */
export function composeSharedNote(input: { title?: string; text?: string; url?: string }): string {
  const text = (input.text ?? "").trim();
  const title = (input.title ?? "").trim();
  const url = (input.url ?? "").trim();
  const parts = [text || title];
  if (url && !parts[0].includes(url)) parts.push(url);
  return parts.filter(Boolean).join("\n").slice(0, 1500);
}
