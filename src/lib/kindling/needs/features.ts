/**
 * Turns a customer message into features for the need model.
 * Words, word pairs and short character pieces. The character pieces make it tolerant of the typos and
 * spelling variants that are normal in chat ("wat time u open", "abeg", "pls").
 */

const SHORT: Record<string, string> = { u: "you", ur: "your", r: "are", pls: "please", plz: "please", abeg: "abeg", wat: "what", hw: "how", ya: "you" };

export function tokens(text: string): string[] {
  const clean = text
    .toLowerCase()
    .replace(/[\u2019\u2018`]/g, "'")
    .replace(/\d+/g, "0")
    .replace(/[^a-z0'\u20a6$\s]/g, " ");
  return clean
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .map((word) => SHORT[word] ?? word);
}

export function featuresOf(text: string): string[] {
  const words = tokens(text);
  const out: string[] = [];
  for (const word of words) out.push(`w:${word}`);
  for (let i = 0; i + 1 < words.length; i += 1) out.push(`b:${words[i]}_${words[i + 1]}`);
  for (const word of words) {
    if (word.length < 4) continue;
    const padded = `#${word}#`;
    for (let i = 0; i + 3 <= padded.length; i += 1) out.push(`c:${padded.slice(i, i + 3)}`);
  }
  return out;
}
