/**
 * Counts how often features are used, with no identifier at all: no account, cookie, IP address or device id is
 * stored, only "this event happened today". It respects Do Not Track and Global Privacy Control. It exists so the owner
 * can see where people give up, not to follow anyone.
 */

export const EVENTS = [
  "visit",
  "pricing_view",
  "quick_draft",
  "week_built",
  "draft_created",
  "send_clicked",
  "example_kept",
  "account_created",
  "crew_created",
  "weekly_email_on",
  "install_accepted",
  "feedback_sent",
] as const;

export type EventName = (typeof EVENTS)[number];

/** Events counted once per browser session however often they happen. */
const ONCE = new Set<EventName>(["visit", "pricing_view"]);

function optedOut(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
  } catch {
    return false;
  }
}

export function track(event: EventName): void {
  if (typeof window === "undefined" || optedOut()) return;
  try {
    if (ONCE.has(event)) {
      const key = `kindling-seen:${event}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
  } catch {
    // without session storage the event is simply counted each time
  }
  try {
    void fetch("/api/event", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    }).catch(() => undefined);
  } catch {
    // counting must never cause an error
  }
}
