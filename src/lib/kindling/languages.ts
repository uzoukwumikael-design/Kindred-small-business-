/** Drafting language, and a small detector so "match the customer" can tell when to take extra care. */

export type LanguageId = "english" | "pidgin" | "yoruba" | "igbo" | "hausa" | "match";

export const LANGUAGES: { id: LanguageId; label: string; rules: string }[] = [
  { id: "english", label: "English", rules: "" },
  {
    id: "pidgin",
    label: "Pidgin",
    rules:
      "Write in everyday Nigerian Pidgin English, the way a friendly shop owner would chat. Keep it simple. Keep names, numbers, times, links and every [CHECK: ...] marker exactly as they are, in English.",
  },
  {
    id: "yoruba",
    label: "Yoruba",
    rules:
      "Write in simple, everyday Yoruba. Keep names, numbers, times, links and every [CHECK: ...] marker exactly as given. If you are not sure of a word, use the plain English word instead of guessing.",
  },
  {
    id: "igbo",
    label: "Igbo",
    rules:
      "Write in simple, everyday Igbo. Keep names, numbers, times, links and every [CHECK: ...] marker exactly as given. If you are not sure of a word, use the plain English word instead of guessing.",
  },
  {
    id: "hausa",
    label: "Hausa",
    rules:
      "Write in simple, everyday Hausa. Keep names, numbers, times, links and every [CHECK: ...] marker exactly as given. If you are not sure of a word, use the plain English word instead of guessing.",
  },
  {
    id: "match",
    label: "Match the customer",
    rules:
      "Reply in the language the customer wrote in. If it is Nigerian Pidgin, reply in Pidgin. If you are not sure which language it is, reply in simple English. Keep names, numbers, times, links and every [CHECK: ...] marker exactly as given.",
  },
];

export function isLanguage(value: unknown): value is LanguageId {
  return LANGUAGES.some((item) => item.id === value);
}

export function languageLabel(id: LanguageId | undefined): string {
  return (LANGUAGES.find((item) => item.id === id) ?? LANGUAGES[0]).label;
}

export function languageRules(id: LanguageId | undefined): string {
  return (LANGUAGES.find((item) => item.id === id) ?? LANGUAGES[0]).rules;
}

type Detected = Exclude<LanguageId, "match">;

const MARKERS: Record<Exclude<Detected, "english">, { strong: RegExp[]; weak: RegExp[] }> = {
  pidgin: {
    strong: [/\babeg\b/i, /\bwetin\b/i, /\bwahala\b/i, /\bdey\b/i, /\buna\b/i, /\bsabi\b/i, /\bpikin\b/i, /\bhow far\b/i, /\bno be\b/i, /\bwey\b/i],
    weak: [/\bna\b/i, /\boga\b/i, /\bwan\b/i, /\bdem\b/i, /\bsef\b/i, /\bjare\b/i, /\babi\b/i, /\bdon\b/i, /\bmake i\b/i],
  },
  yoruba: {
    strong: [/\bj[ọo]w[ọo]\b/i, /\bbawo\b/i, /\belo ni\b/i, /\b[eẹ] k(?:u|aaro|aasan|ale)\b/i, /\bmo f[ẹe]\b/i, /\b[ṣs]e [ẹe]\b/i, /[ẹọṣ]/i],
    weak: [/\bni\b/i, /\bowo\b/i, /\bose\b/i],
  },
  igbo: {
    strong: [/\bbiko\b/i, /\bkedu\b/i, /\bndewo\b/i, /\bego ole\b/i, /\bdaal[ụu]\b/i, /\bebee\b/i, /\b[ọo] b[ụu]\b/i],
    weak: [/\bnna\b/i, /\bnne\b/i, /\bunu\b/i, /\bgi\b/i],
  },
  hausa: {
    strong: [/\bsannu\b/i, /\bdon allah\b/i, /\bnawa\b/i, /\bna gode\b/i, /\bina kwana\b/i, /\byaushe\b/i, /\bina so\b/i],
    weak: [/\bkudi\b/i, /\byaya\b/i, /\bka\b/i, /\bki\b/i],
  },
};

/** A quick guess from common words. It is a hint to show the right notice, never a promise. */
export function detectLanguage(text: string): Detected {
  let best: Detected = "english";
  let bestScore = 0;
  for (const [lang, { strong, weak }] of Object.entries(MARKERS) as [Exclude<Detected, "english">, (typeof MARKERS)["pidgin"]][]) {
    const s = strong.filter((rx) => rx.test(text)).length;
    const w = weak.filter((rx) => rx.test(text)).length;
    const score = s * 2 + w;
    // one strong marker, or at least two weak ones, is enough to call it
    if ((s >= 1 || w >= 2) && score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

/** What language the draft will really be in, once "match the customer" is resolved against the note. */
export function effectiveLanguage(choice: LanguageId | undefined, note: string): Detected {
  const id = choice ?? "english";
  if (id === "match") return detectLanguage(note);
  return id;
}

export function needsNativeCheck(language: Detected): boolean {
  return language !== "english";
}
