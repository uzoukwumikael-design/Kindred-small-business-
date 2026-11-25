import { useServerFn } from "@tanstack/react-start";
import { track } from "@/lib/kindling/events";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AiConsentNotice, useAiConsent } from "@/components/kindling/ai-consent";
import { DraftEditor } from "@/components/kindling/draft-editor";
import { checkDraft } from "@/lib/kindling/checks";
import { detectLanguage, needsNativeCheck } from "@/lib/kindling/languages";
import { describeKinds, redact } from "@/lib/kindling/redact";
import { stashSharedNote } from "@/lib/kindling/share-in";
import { quickDraft } from "@/lib/kindling/quick-draft";
import { TURNSTILE_ENABLED, useTurnstile } from "@/components/kindling/turnstile";
import { primaryClass } from "@/components/kindling/shell";

const LABELS: Record<string, string> = {
  hours: "your opening hours",
  location: "your address",
  payment: "how to pay",
  delivery: "delivery",
  prices: "your prices",
  booking: "your booking rules",
  returns: "your refund policy",
  contact: "how to reach you",
};

export function QuickDraft() {
  const run = useServerFn(quickDraft);
  const consent = useAiConsent();
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const found = redact(note);
  const captcha = useTurnstile();

  async function go() {
    if (consent.needed && !consent.given) return;
    setError("");
    if (note.trim().length < 8) {
      setError("Paste a real customer message first. A sentence is enough.");
      return;
    }
    if (TURNSTILE_ENABLED && !captcha.token) {
      setError("Wait for the security check to finish, then try again.");
      return;
    }
    setPending(true);
    try {
      const result = await run({ data: { note: note.trim(), turnstile: captcha.token } });
      if (!result.ok) {
        setError(result.error);
      } else {
        setText(result.text);
        setFrom(note.trim());
        setNeeds(result.needs);
        track("quick_draft");
      }
    } catch {
      setError("That did not work. Please try again in a moment.");
    } finally {
      setPending(false);
      captcha.reset();
    }
  }

  const language = detectLanguage(from || note);

  return (
    <section className="border-t border-line" aria-labelledby="quick-heading">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <h2 id="quick-heading" className="font-display text-3xl font-medium text-ink">
          Try it on one real message.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Paste a message a customer sent you. You get a first draft with a bracket wherever it does not know a fact. No
          sign-up, and nothing is kept.
        </p>
        <label className="mt-5 block">
          <span className="sr-only">A customer message</span>
          <textarea
            className="w-full rounded-lg border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
            rows={4}
            maxLength={600}
            value={note}
            placeholder="Hi, what time are you open on Saturday? And do you take transfer?"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {found.count > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink" role="status">
            This looks like it has {describeKinds(found.kinds)}. It will be replaced with a placeholder before anything is sent.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Leave out card numbers and private details.</p>
        )}
        <AiConsentNotice consent={consent} />
        <div className="mt-4">{captcha.widget}</div>
        <button type="button" className={`${primaryClass} mt-4`} disabled={pending || (consent.needed && !consent.given)} onClick={() => void go()}>
          {pending ? "Drafting…" : "Draft a reply"}
        </button>
        {error ? (
          <p className="mt-3 text-sm leading-relaxed text-ember" role="alert">
            {error}
          </p>
        ) : null}

        {text ? (
          <div className="mt-6">
            <DraftEditor
              text={text}
              onChange={setText}
              channel="whatsapp"
              languageNote={
                needsNativeCheck(language)
                  ? "This looks like it is not in English. Ask someone who speaks the language to read the draft before you send it."
                  : ""
              }
              sendable
              notes={[]}
              used={[]}
              issues={checkDraft({ draft: text, note: from, facts: [], channel: "whatsapp", useChannel: true })}
              onKeep={() => undefined}
              allowKeep={false}
            />
            {needs.length > 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
                It does not know {needs.map((key) => LABELS[key] ?? key).join(" or ")} yet, which is why there are brackets. Save
                those once and every draft uses them.
              </p>
            ) : null}
            <p className="mt-4 text-base text-ink">
              Want this to sound like your shop and use your own facts?{" "}
              <Link to="/bench" onClick={() => stashSharedNote(from)} className="font-medium text-ember underline underline-offset-2">
                Build your week in two minutes
              </Link>
              . Your message comes with you.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
