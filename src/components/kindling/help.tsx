import { useEffect, useState } from "react";
import { FaqList } from "@/components/kindling/faq";
import { TURNSTILE_ENABLED, useTurnstile } from "@/components/kindling/turnstile";
import { fieldClass, primaryClass } from "@/components/kindling/shell";
import { serviceInfo } from "@/lib/kindling/account-server";
import { track } from "@/lib/kindling/events";
import { sendFeedback } from "@/lib/kindling/feedback";

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
const KINDS = [
  { id: "question", label: "A question" },
  { id: "problem", label: "Something is wrong" },
  { id: "idea", label: "An idea" },
] as const;

export function Help() {
  const [enabled, setEnabled] = useState(false);
  const [kind, setKind] = useState<"question" | "problem" | "idea">("question");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const captcha = useTurnstile();

  useEffect(() => {
    let alive = true;
    serviceInfo()
      .then((info) => {
        if (alive) setEnabled(info.feedback);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function send() {
    setError("");
    if (message.trim().length < 10) {
      setError("Please write a little more, at least a sentence.");
      return;
    }
    if (TURNSTILE_ENABLED && !captcha.token) {
      setError("Wait for the security check to finish, then try again.");
      return;
    }
    setState("sending");
    try {
      const result = await sendFeedback({ data: { kind, message, replyTo, page: window.location.pathname, company: trap, turnstile: captcha.token } });
      captcha.reset();
      if (result.ok) {
        track("feedback_sent");
        setState("done");
      } else {
        setError(result.error);
        setState("idle");
      }
    } catch {
      setError("That did not go through. Please try again, or email us.");
      setState("idle");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Help</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">Answers, and a person to ask.</h1>
      <FaqList />

      <section id="contact" className="mt-12 border-t border-line pt-8" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="font-display text-3xl font-medium text-ink">
          Still stuck? Tell us.
        </h2>
        {state === "done" ? (
          <p className="mt-4 rounded-xl border border-line bg-surface p-5 text-base text-ink" role="status">
            Thank you. We read every message. {replyTo ? "We will reply to the address you gave." : "You did not leave an address, so we cannot reply, but we will use what you said."}
          </p>
        ) : enabled ? (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="What is it about?">
              {KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={kind === item.id}
                  onClick={() => setKind(item.id)}
                  className={"h-11 rounded-lg border px-4 text-sm font-medium " + (kind === item.id ? "border-ember bg-ember-soft text-ink" : "border-line bg-surface text-ink hover:border-ink")}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-ink">What is on your mind?</span>
              <textarea
                className="mt-2 w-full rounded-lg border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
                rows={5}
                maxLength={1500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please leave out card numbers, passwords and customer details."
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Where can we reply? (optional)</span>
              <input className={`${fieldClass} mt-2`} type="email" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="you@yourshop.com" />
            </label>
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="company" />
            {captcha.widget}
            <div>
              <button type="button" className={primaryClass} disabled={state === "sending"} onClick={() => void send()}>
                {state === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
            {error ? (
              <p className="text-sm leading-relaxed text-ember" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : CONTACT ? (
          <p className="mt-4 text-base leading-relaxed text-ink">
            Email us at{" "}
            <a className="font-medium text-ember underline underline-offset-2" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            . Please leave out card numbers and customer details.
          </p>
        ) : (
          <p className="mt-4 text-base text-muted">Contact details will appear here once the site owner adds them.</p>
        )}
      </section>
    </main>
  );
}
