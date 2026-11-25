import { analyze } from "@/lib/kindling/needs";
import { FACT_WORDS } from "@/lib/kindling/needs/regex";
import type { AiInput } from "@/lib/kindling/ai";

/**
 * Template drafter used when no AI key is configured on the server.
 * It never invents facts: anything it cannot read from the note becomes a [CHECK] marker.
 */


function factFor(note: string, facts: AiInput["facts"] | undefined, key: string): string {
  return (facts ?? []).find((fact) => fact.key === key)?.value ?? "";
}

/** Picks the checked fact that answers what the customer seems to be asking, if there is one. */
function matchFact(note: string, facts: AiInput["facts"] | undefined): string {
  const list = facts ?? [];
  // The trained model reads the message first, strongest need first. The keyword rules are the fallback.
  for (const need of analyze(note).needs) {
    const fact = list.find((item) => item.key === need.key);
    if (fact) return fact.value;
  }
  for (const fact of list) {
    const words = FACT_WORDS[fact.key];
    if (words && words.test(note)) return fact.value;
  }
  return "";
}

const MONEY = /(?:[$€£₦]\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars|usd|naira|ngn)\b)/gi;
const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)\b/gi;
const DAY =
  /\b(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\b|\b(?:today|tomorrow|tonight|next week)\b/gi;


/** The booking sentence, using the day and time the owner wrote, and a bracket for whatever they did not. */
function confirmLine(note: string): string {
  const time = (note.match(TIME) ?? [])[0];
  const day = (note.match(DAY) ?? [])[0];
  const when = day && time ? `${day} at ${time}` : day || time || "";
  return when
    ? `This is a quick confirmation of your booking on ${when}.`
    : "This is a quick confirmation of your booking on [CHECK: day and time, copy from the book].";
}

/** The invoice sentence, using the number, amount and due date from the note, and brackets for the rest. */
function chaseLine(note: string): string {
  const number = note.match(/\binvoice\s*(?:no\.?|number|#)?\s*([A-Za-z0-9-]+)/i)?.[1];
  const amount =
    (note.match(MONEY) ?? [])[0] ||
    note.match(/\b\d[\d,]*(?:\.\d+)?\s?(?:naira|dollars|usd|ngn)\b/i)?.[0] ||
    "";
  const due = note.match(/\bdue\s+(?:on\s+)?([^.,;\n]{3,30})/i)?.[1]?.trim();
  return `A friendly note about invoice ${number ?? "[CHECK: invoice number]"} for ${amount || "[CHECK: amount from the invoice]"}, which was due ${due ?? "[CHECK: due date]"}.`;
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list.map((item) => item.trim()))).filter(Boolean);
}

function firstName(note: string): string {
  const named = note.match(
    /(?:\b[Ff]rom|\b[Nn]ame is|\b[Tt]his is|\b[Ii]'m|\b[Ii] am|\b[Ii]t's)\s+([A-Z][a-z]{1,20})\b/,
  );
  if (named) return named[1];
  const start = note.match(/^\s*(?:[Hh]i|[Hh]ey|[Hh]ello)[, ]+([A-Z][a-z]{1,20})\b/);
  if (start) return start[1];
  // "Tola loved her braids": a capitalised first word followed by a common verb is a name.
  const lead = note.match(
    /^\s*([A-Z][a-z]{1,20})\s+(?:loved|liked|enjoyed|asked|asks|wants|wanted|came|booked|paid|ordered|collected|picked|said|called|is|was|has|had|needs|would|will|can|could)\b/,
  );
  return lead ? lead[1] : "";
}

function sign(name: string): string {
  return name.trim() ? `${name.trim()}` : "[CHECK: your name]";
}

function toneOpen(toneLine: string, who: string): string {
  const greeting = who ? `Hi ${who},` : "Hi [CHECK: customer name],";
  if (/formal|polite and precise/i.test(toneLine)) return who ? `Hello ${who},` : "Hello [CHECK: customer name],";
  if (/plain/i.test(toneLine)) return greeting;
  return greeting;
}

function factsBlock(note: string): string[] {
  const money = unique(note.match(MONEY) ?? []);
  const times = unique(note.match(TIME) ?? []);
  const days = unique(note.match(DAY) ?? []);
  const out: string[] = [];
  if (money.length) out.push(`Amounts in the note: ${money.join(", ")}. Check each against the invoice or price list.`);
  if (times.length || days.length) {
    out.push(`Times in the note: ${[...days, ...times].join(", ")}. Check each against the book.`);
  }
  return out;
}

export function offlineSharpen(data: AiInput): string {
  const lines = [
    data.promptTemplate.trim(),
    "",
    "Extra context for this business:",
    `- Business: ${data.businessName || "[CHECK: business name]"}`,
    `- What we do: ${data.offer || "[CHECK: one sentence on what you sell]"}`,
    `- Words we use for our own things: [ADD: three words you always use, for example what you call a booking or an order]`,
    `- Words we never use: [ADD: anything that sounds like a chain store or a slogan]`,
    `- A real message of ours that sounds right (paste one): [ADD: paste a past reply you liked]`,
    "",
    "Match the voice of the real message above. If it is missing, stay with the voice line at the top.",
  ];
  return lines.join("\n");
}

export function offlineDraft(data: AiInput): { text: string; notes: string[] } {
  const note = data.sourceText.trim();
  const who = firstName(note);
  const open = toneOpen(data.toneLine, who);
  const biz = data.businessName.trim();
  const closeName = biz ? `${biz}` : "[CHECK: your name or shop name]";
  const checks = factsBlock(note);
  const title = data.workflowTitle.toLowerCase();
  const email = data.useChannel && data.channel === "email";
  const messageKind = /reply|confirm|chase|quote|scaffold|review/.test(title);
  // Only an email gets a formal sign-off. WhatsApp, texts and DMs end when the message does.
  const signoff = email ? ["", "Best,", closeName] : [];

  let body: string[];
  if (title.includes("reply")) {
    const answer = matchFact(note, data.facts);
    body = [
      open,
      "",
      `Thanks for getting in touch. ${answer || "[CHECK: answer the actual question using a fact you have confirmed]"}`,
      "",
      // When one of the owner's confirmed facts answered the question, there is nothing left to bracket.
      answer ? "Let me know if there is anything else." : "[CHECK: next step, for example when you will follow up or what they need to bring]",
      ...signoff,
    ];
  } else if (title.includes("confirm")) {
    body = [
      open,
      "",
      confirmLine(note),
      "",
      factFor(note, data.facts, "booking") || "[CHECK: your hold or late policy in one sentence]",
      "",
      "Reply here if anything needs to change.",
      ...signoff,
    ];
  } else if (title.includes("chase")) {
    body = [
      open,
      "",
      chaseLine(note),
      "",
      `If it has already gone out, thank you and please ignore this. If not, ${factFor(note, data.facts, "payment") || "[CHECK: how they can pay]"}.`,
      ...signoff,
    ];
  } else if (title.includes("post") || title.includes("true sentence") || title.includes("one post")) {
    body = [
      `${note.split(/[.!?\n]/)[0].trim().slice(0, 140)}.`,
      "",
      "[CHECK: add one specific detail only you know, such as a name, a number, or what happened this week]",
      "",
      "[CHECK: one line on how to book, order, or visit]",
    ];
  } else if (title.includes("review")) {
    body = [
      open,
      "",
      "Thank you for choosing us. If you have a minute, an honest review helps other people find us.",
      "",
      factFor(note, data.facts, "review-link") || "[CHECK: your review link]",
      ...signoff,
    ];
  } else if (title.includes("quote") || title.includes("scaffold")) {
    body = [
      open,
      "",
      "Thanks for having us out. Here is what we agreed to look at:",
      "- Scope: [CHECK: what the job includes, in plain words]",
      "- Not included: [CHECK: anything you will not cover]",
      "- Price: [CHECK: your number, never the tool's]",
      "- Timing: [CHECK: start and finish window]",
      ...signoff,
    ];
  } else if (title.includes("stock") || title.includes("reorder")) {
    body = [
      "Reorder list",
      "",
      ...note
        .split(/\n|,|;/)
        .map((line) => line.trim())
        .filter((line) => line.length > 1)
        .slice(0, 12)
        .map((line) => `- ${line} [CHECK: quantity]`),
      "",
      "Anything marked [CHECK] needs a real count before this goes to the supplier.",
    ];
  } else if (title.includes("hire") || title.includes("job") || title.includes("honest")) {
    body = [
      `Job: [CHECK: role title]`,
      "Hours: [CHECK: days and hours]",
      "Pay: [CHECK: rate or range]",
      "The actual work:",
      ...note
        .split(/\n|\./)
        .map((line) => line.trim())
        .filter((line) => line.length > 6)
        .slice(0, 5)
        .map((line) => `- ${line}`),
      "",
      "To apply: [CHECK: how to apply]",
    ];
  } else {
    body = [
      "Today",
      ...note
        .split(/\n|\./)
        .map((line) => line.trim())
        .filter((line) => line.length > 3)
        .slice(0, 8)
        .map((line) => `- ${line}`),
      "",
      "Tomorrow",
      "- [CHECK: what has to happen first thing]",
    ];
  }

  const lines = email && messageKind ? [`Subject: [CHECK: subject line]`, "", ...body] : body;
  const notes = [
    "Template draft. No AI is connected on this site, so this only reshapes your note and marks what is missing.",
    ...(data.language && data.language !== "english"
      ? ["Template drafts are in English only. Connect an AI service to draft in Pidgin, Yoruba, Igbo or Hausa."]
      : []),
    ...checks,
  ];
  return { text: lines.join("\n").trim(), notes };
}
