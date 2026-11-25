import type { ChannelId } from "@/lib/kindling/channels";

/**
 * A second pair of eyes on a draft. It looks for things a draft should not have made up: amounts,
 * times, links and promises that appear in neither the owner's note nor the checked facts. It cannot
 * judge meaning, so it only flags, never blocks. The [CHECK] brackets remain the hard lock.
 */

export type DraftIssue = { kind: "number" | "link" | "promise" | "phrase" | "length"; detail: string };

const MONEY = /(?:[$€£₦]|\bN(?=\d))\s?\d[\d,]*(?:\.\d+)?(?:\s?[kK])?|\b\d[\d,]*(?:\.\d+)?\s?(?:naira|dollars|usd|ngn|euros|pounds)\b/g;
const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi;
const PERCENT = /\b\d+(?:\.\d+)?\s?%/g;
const URL_ = /https?:\/\/[^\s)]+/gi;

const PROMISE = ["free", "discount", "refund", "guarantee", "guaranteed", "complimentary", "voucher", "cashback"];

const BANNED = [
  "hope this finds you well",
  "thank you for reaching out",
  "we are delighted",
  "do not hesitate",
  "don't hesitate",
  "valued customer",
  "as an ai",
  "i am an ai",
];

const LIMITS: Record<ChannelId, { chars: number; lines: number }> = {
  whatsapp: { chars: 700, lines: 8 },
  text: { chars: 480, lines: 5 },
  dm: { chars: 400, lines: 5 },
  email: { chars: 2500, lines: 30 },
};

function squash(text: string): string {
  return text.toLowerCase().replace(/[\s,]/g, "");
}

export function checkDraft(args: {
  draft: string;
  note: string;
  facts: { value: string }[];
  channel?: ChannelId;
  useChannel?: boolean;
}): DraftIssue[] {
  const issues: DraftIssue[] = [];
  // Brackets are the owner's to-do list, not claims. Leave them out.
  const draft = args.draft.replace(/\[CHECK[^\]]*\]/gi, " ");
  const source = [args.note, ...args.facts.map((fact) => fact.value)].join("\n");
  const sourceSquashed = squash(source);
  const sourceLower = source.toLowerCase();

  const seen = new Set<string>();
  for (const pattern of [MONEY, TIME, PERCENT]) {
    for (const match of draft.match(pattern) ?? []) {
      const key = squash(match);
      if (seen.has(key)) continue;
      seen.add(key);
      // "2pm" in the note supports "2 pm" in the draft; digits alone must also be present.
      const digits = key.replace(/[^\d.:]/g, "");
      if (!sourceSquashed.includes(key) && !(digits && sourceSquashed.includes(digits) && /^\d+$/.test(digits) && digits.length >= 3)) {
        issues.push({ kind: "number", detail: `"${match.trim()}" is not in your note or your shop facts.` });
      }
    }
  }

  for (const match of draft.match(URL_) ?? []) {
    const url = match.replace(/[.,]+$/, "");
    if (!sourceLower.includes(url.toLowerCase())) issues.push({ kind: "link", detail: `The link ${url} is not in your note or your shop facts.` });
  }

  const draftLower = draft.toLowerCase();
  for (const word of PROMISE) {
    const found = new RegExp(`\\b${word}\\b`, "i").test(draftLower);
    if (found && !new RegExp(`\\b${word}\\b`, "i").test(sourceLower)) {
      issues.push({ kind: "promise", detail: `It mentions "${word}", which your note and facts do not. Make sure you mean to offer that.` });
    }
  }

  for (const phrase of BANNED) {
    if (draftLower.includes(phrase)) issues.push({ kind: "phrase", detail: `"${phrase}" sounds like a template. Say it your own way.` });
  }
  if (args.draft.includes("\u2014")) issues.push({ kind: "phrase", detail: "It uses a long dash, which can look machine-written." });

  if (args.useChannel && args.channel) {
    const limit = LIMITS[args.channel];
    const lines = args.draft.split("\n").filter((line) => line.trim()).length;
    if (args.draft.trim().length > limit.chars || lines > limit.lines) {
      issues.push({ kind: "length", detail: "This is long for this channel. Shorter messages get read." });
    }
  }
  return issues;
}
