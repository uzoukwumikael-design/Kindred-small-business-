/** The original keyword rules for which shop fact a message needs. Kept as the fallback and as the baseline the model must beat. */
export const FACT_WORDS: Record<string, RegExp> = {
  hours: /\b(open|opens|close|closing|closed|hours|what time|when)\b/i,
  location: /\b(where|address|located|location|direction|find you)\b/i,
  payment: /\b(pay|paying|payment|transfer|how do i pay|invoice)\b/i,
  delivery: /\b(deliver|delivery|pick ?up|collect|ship)/i,
  prices: /\b(price|prices|cost|how much|rate)\b/i,
  booking: /\b(book|booking|appointment|cancel|reschedule|deposit)/i,
  returns: /\b(refund|return|exchange)/i,
  contact: /\b(call|phone|reach|contact|whatsapp)\b/i,
};

export const NEED_KEYS = Object.keys(FACT_WORDS);

export function regexNeeds(text: string): string[] {
  return Object.entries(FACT_WORDS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([key]) => key);
}
