import { findChecks, type ChannelId } from "@/lib/kindling/channels";
import { checkDraft } from "@/lib/kindling/checks";
import { factsUsedDetailed, usableFacts } from "@/lib/kindling/facts";
import type { LanguageId } from "@/lib/kindling/languages";
import { regexNeeds } from "@/lib/kindling/needs/regex";
import { redact } from "@/lib/kindling/redact";
import type { Fact } from "@/lib/kindling/types";

/**
 * Preparing one example for the optional training data layer. Everything here runs in the browser, before
 * anything is sent: private details and names are masked, the person sees the result and can edit it.
 */

const NOT_NAMES = new Set(
  "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December The We Can Please Hello Hey Customer Someone Our My She He They Her His This That There Could Would Need Want Hi When Where How What Thanks Thank Good Morning Afternoon Evening Sorry Yes Okay Ok Ma Sir".split(" "),
);

const NAME = "[A-Z][a-z]{2,20}";

/** Words in the text that look like a person's name. A guess: the person reviews the result before sending. */
export function nameHints(...texts: string[]): string[] {
  const found = new Set<string>();
  const add = (word: string | undefined) => {
    if (word && !NOT_NAMES.has(word)) found.add(word);
  };
  for (const text of texts) {
    for (const m of text.matchAll(new RegExp(`\\b(?:hi|hello|hey|dear)[,\\s]+(?:ma,?\\s+|sir,?\\s+)?(${NAME})\\b`, "gi"))) if (/^[A-Z]/.test(m[1])) add(m[1]);
    for (const m of text.matchAll(new RegExp(`\\b(?:it's|its|this is|i'm|i am|my name is|name is|from)\\s+(${NAME})\\b`, "gi"))) if (/^[A-Z]/.test(m[1])) add(m[1]);
    for (const m of text.matchAll(new RegExp(`\\b(${NAME})\\s+here\\b`, "g"))) add(m[1]);
    for (const m of text.matchAll(new RegExp(`\\b(?:Mr|Mrs|Miss|Ms|Oga|Aunty|Auntie|Uncle|Sister|Brother|Mama|Papa|Madam)\\.?\\s+(${NAME})\\b`, "g"))) add(m[1]);
    const lead = text.match(new RegExp(`^\\s*(${NAME})\\s+(?:loved|liked|asked|asks|wants|wanted|came|booked|paid|ordered|collected|said|called|is|was|has|had|needs|would|will|can|could)\\b`));
    add(lead?.[1]);
  }
  return [...found];
}

export function maskNames(text: string, names: string[]): string {
  let out = text;
  for (const name of names) out = out.replace(new RegExp(`\\b${name}\\b`, "gi"), "[NAME]");
  return out;
}

/** How much the person changed the draft, from 0 (not at all) to 1 (rewrote everything). */
export function editRatio(draft: string, final: string): number {
  const a = draft.slice(0, 1500);
  const b = final.slice(0, 1500);
  if (a === b) return 0;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return Math.round((prev[b.length] / longest) * 1000) / 1000;
}

export type Contribution = {
  workflow: string;
  channel: ChannelId;
  language: LanguageId;
  note: string;
  draft: string;
  final: string;
  facts_used: string[];
  needs: string[];
  brackets_before: number;
  issues: number;
  edit_ratio: number;
  source: "live" | "template";
};

/**
 * Builds the example that would be shared. The needs are weak labels: the fact types the final message used, plus
 * what the keyword rules see in the note. They are good enough to start a model and are corrected as real data grows.
 */
export function prepareContribution(args: {
  note: string;
  draft: string;
  final: string;
  workflow: string;
  channel: ChannelId;
  language: LanguageId;
  facts: Fact[];
  source: "live" | "template";
  today: string;
}): { contribution: Contribution; masked: number } {
  const names = nameHints(args.note, args.draft, args.final);
  let masked = 0;
  const clean = (text: string) => {
    const r = redact(text);
    masked += r.count;
    const named = maskNames(r.text, names);
    if (named !== r.text) masked += 1;
    return named.slice(0, 6000);
  };
  const usable = usableFacts(args.facts, args.today);
  const used = factsUsedDetailed(args.final, usable);
  const keys = new Set<string>(used.map((fact) => fact.key).filter((key) => key !== "custom"));
  for (const key of regexNeeds(args.note)) keys.add(key);
  const issues = checkDraft({ draft: args.final, note: args.note, facts: usable, channel: args.channel, useChannel: true }).length;
  // Build the example first: the masking counter only has its final value after every field has been cleaned.
  const contribution: Contribution = {
    workflow: args.workflow.slice(0, 40),
    channel: args.channel,
    language: args.language,
    note: clean(args.note).slice(0, 1500),
    draft: clean(args.draft),
    final: clean(args.final),
    facts_used: used.map((fact) => fact.key).slice(0, 12),
    needs: [...keys].slice(0, 12),
    brackets_before: Math.min(50, findChecks(args.draft).length),
    issues: Math.min(50, issues),
    edit_ratio: editRatio(args.draft, args.final),
    source: args.source,
  };
  return { contribution, masked };
}
