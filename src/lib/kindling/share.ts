export type SharedRules = {
  name: string;
  job: string;
  rules: string;
};

const LIMITS = { name: 80, job: 120, rules: 4000 };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeRules(data: SharedRules): string {
  return toBase64Url(
    JSON.stringify({
      name: data.name.slice(0, LIMITS.name),
      job: data.job.slice(0, LIMITS.job),
      rules: data.rules.slice(0, LIMITS.rules),
    }),
  );
}

export function decodeRules(value: string | undefined): SharedRules | null {
  if (!value || value.length > 9000) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value));
    if (!parsed || typeof parsed !== "object") return null;
    const { name, job, rules } = parsed as Record<string, unknown>;
    if (typeof name !== "string" || typeof job !== "string" || typeof rules !== "string") return null;
    if (!rules.trim()) return null;
    return {
      name: name.slice(0, LIMITS.name),
      job: job.slice(0, LIMITS.job),
      rules: rules.slice(0, LIMITS.rules),
    };
  } catch {
    return null;
  }
}

/** Splits the plain-text house rules into a title, an intro line and numbered rules. */
export function parseRules(text: string): { title: string; intro: string; items: string[] } {
  const lines = text.split("\n").map((line) => line.trim());
  const title = lines[0] ?? "";
  const items = lines.filter((line) => /^\d+\.\s/.test(line)).map((line) => line.replace(/^\d+\.\s*/, ""));
  const intro = lines.slice(1).find((line) => line && !/^\d+\.\s/.test(line)) ?? "";
  return { title, intro, items };
}
