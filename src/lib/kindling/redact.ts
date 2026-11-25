/**
 * Masks private-looking details before text leaves the browser or is sent to an AI provider.
 * It is a safety net, not a guarantee: it catches card numbers, ID numbers, emails, phone numbers and
 * "password is ..." style secrets. It cannot recognise every private detail, so the page still tells people
 * not to paste sensitive things.
 */

export type Redaction = { text: string; count: number; kinds: string[] };

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

const RULES: { kind: string; label: string; pattern: RegExp; test?: (match: string) => boolean }[] = [
  { kind: "secret", label: "[SECRET REMOVED]", pattern: /\b(?:password|passcode|pin|otp|cvv)\s*(?:is|:|=)\s*\S+/gi },
  {
    kind: "card",
    label: "[CARD REMOVED]",
    pattern: /(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g,
    test: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhn(digits);
    },
  },
  { kind: "id", label: "[ID REMOVED]", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: "account",
    label: "[ACCOUNT REMOVED]",
    pattern: /\b(?:account|acct|iban)\s*(?:no\.?|number|num|#)?\s*[:-]?\s*[A-Z]{0,2}\d[\d ]{7,30}\d\b/gi,
  },
  { kind: "email", label: "[EMAIL]", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  // Nigerian mobile numbers are 11 digits, so they are masked before the 11-digit ID rule below.
  { kind: "phone", label: "[PHONE]", pattern: /(?<!\d)(?:\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g },
  { kind: "phone", label: "[PHONE]", pattern: /(?<!\d)(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/g },
  { kind: "id", label: "[ID REMOVED]", pattern: /(?<!\d)\d{11}(?!\d)/g },
];

export function redact(input: string): Redaction {
  let text = input;
  let count = 0;
  const kinds = new Set<string>();
  for (const rule of RULES) {
    text = text.replace(rule.pattern, (match) => {
      if (rule.test && !rule.test(match)) return match;
      count += 1;
      kinds.add(rule.kind);
      return rule.label;
    });
  }
  return { text, count, kinds: Array.from(kinds) };
}

const KIND_WORDS: Record<string, string> = {
  secret: "a password or code",
  card: "a card number",
  id: "an ID number",
  account: "an account number",
  email: "an email address",
  phone: "a phone number",
};

export function describeKinds(kinds: string[]): string {
  const words = kinds.map((kind) => KIND_WORDS[kind] ?? kind);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
