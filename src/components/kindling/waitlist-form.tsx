import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { joinWaitlist, waitlistStatus } from "@/lib/kindling/waitlist";
import { TURNSTILE_ENABLED, useTurnstile } from "@/components/kindling/turnstile";
import { fieldClass, primaryClass } from "@/components/kindling/shell";

export function WaitlistForm() {
  const status = useServerFn(waitlistStatus);
  const join = useServerFn(joinWaitlist);
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [consent, setConsent] = useState(false);
  const captcha = useTurnstile();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    status()
      .then((result) => {
        if (alive) setEnabled(result.enabled);
      })
      .catch(() => {
        if (alive) setEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, [status]);

  if (!enabled) return null;

  async function submit() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter an email address we can reach you at.");
      return;
    }
    if (!consent) {
      setError("Tick the box to say you want these emails.");
      return;
    }
    if (TURNSTILE_ENABLED && !captcha.token) {
      setError("Wait for the security check to finish, then try again.");
      return;
    }
    setState("sending");
    try {
      const result = await join({ data: { email, trade: "", consent: true as const, company: trap, turnstile: captcha.token } });
      captcha.reset();
      if (result.ok) {
        setState("done");
      } else {
        setError(result.error);
        setState("idle");
      }
    } catch {
      setError("That didn't go through. Please try again in a minute.");
      setState("idle");
    }
  }

  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6">
          <h2 className="font-display text-3xl font-medium text-ink">Get the next job when it is ready</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            One short email each time a new workflow is added. Nothing else, and it never gets sold or shared.
          </p>
        </div>
        <div className="lg:col-span-6">
          {state === "done" ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-base text-ink" role="status">
              You are on the list. The next email will be about a new workflow, not a newsletter.
            </p>
          ) : (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="block flex-1">
                  <span className="sr-only">Email address</span>
                  <input
                    className={fieldClass}
                    type="email"
                    autoComplete="email"
                    value={email}
                    placeholder="you@yourshop.com"
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submit();
                    }}
                  />
                </label>
                <button type="button" className={primaryClass} onClick={() => void submit()} disabled={state === "sending"}>
                  {state === "sending" ? "Sending…" : "Tell me"}
                </button>
              </div>
              <div className="mt-3">{captcha.widget}</div>
              <label className="mt-3 flex items-start gap-3 text-sm leading-relaxed text-ink">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[#9a3412]"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>Yes, email me when a new workflow is added. I can unsubscribe at any time.</span>
              </label>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={trap}
                onChange={(event) => setTrap(event.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="company"
              />
              {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
