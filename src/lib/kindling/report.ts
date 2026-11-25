import { redact } from "@/lib/kindling/redact";

/**
 * Tells the site owner when something breaks in a visitor's browser, without any third-party service.
 * It sends the error message and a few lines of the stack, with web addresses cut down to paths and private-looking
 * details masked. No account, device or customer text. At most five reports a page load, once per distinct error.
 */

let installed = false;
let sent = 0;
const seen = new Set<string>();

function clean(text: string, max: number): string {
  const trimmed = text
    .replace(/https?:\/\/[^/\s)]+/g, "") // drop the site address, keep the file path
    .replace(/\?[^\s):]*/g, "") // drop query strings
    .slice(0, max);
  return redact(trimmed).text;
}

export function report(error: unknown, where = "window"): void {
  if (typeof window === "undefined" || sent >= 5) return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const message = clean(err.message || "Unknown error", 300);
  const stack = clean((err.stack ?? "").split("\n").slice(0, 6).join("\n"), 900);
  const key = `${message}|${stack.split("\n")[1] ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;
  try {
    void fetch("/api/client-error", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack, where, path: window.location.pathname.slice(0, 120) }),
    }).catch(() => undefined);
  } catch {
    // reporting must never cause another error
  }
}

export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => report(event.error ?? event.message, "window.onerror"));
  window.addEventListener("unhandledrejection", (event) => report(event.reason, "unhandledrejection"));
}
