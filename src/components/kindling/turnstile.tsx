import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Cloudflare Turnstile, the "are you a person" check. Off unless VITE_TURNSTILE_SITE_KEY is set.
 * The script must be loaded from Cloudflare. The token it produces works once, so reset() after each use.
 * Tokens are verified on the server (for our own forms) or by Supabase (for sign-in), never trusted here.
 */

const SITE_KEY = (import.meta.env?.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function useTurnstile(): { token: string; reset: () => void; widget: ReactNode } {
  // The container may appear after the page loads (for example once a form is allowed to show), so it is tracked in state
  // and the check is attached whenever the container exists.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const id = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_ENABLED || !box) return;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(box, {
          sitekey: SITE_KEY,
          callback: (value: string) => setToken(value),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
      setToken("");
    };
  }, [box]);

  const reset = useCallback(() => {
    setToken("");
    if (id.current && window.turnstile) window.turnstile.reset(id.current);
  }, []);

  const widget: ReactNode = TURNSTILE_ENABLED ? (
    <div>
      <div ref={setBox} data-testid="turnstile" />
      {failed ? (
        <p className="mt-2 text-sm text-ember" role="alert">
          The security check could not load. Turn off any blocker for this site, or try another browser.
        </p>
      ) : !token ? (
        <p className="mt-1 text-sm text-muted">Checking that you are a person…</p>
      ) : null}
    </div>
  ) : null;

  return { token, reset, widget };
}
