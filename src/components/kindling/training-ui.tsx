import { useEffect, useState } from "react";
import { deleteContributions, setTrainingConsent, shareExample, useCloud } from "@/lib/kindling/cloud";
import { findChecks, type ChannelId } from "@/lib/kindling/channels";
import type { LanguageId } from "@/lib/kindling/languages";
import { redact } from "@/lib/kindling/redact";
import { prepareContribution, type Contribution } from "@/lib/kindling/training";
import type { Fact } from "@/lib/kindling/types";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

/** The account switch. Off until the person turns it on, and turning it off deletes what they shared. */
export function TrainingConsent() {
  const training = useCloud((state) => state.training);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle(on: boolean) {
    const before = useCloud.getState().training;
    // Show the change straight away, and put it back if saving fails.
    useCloud.setState({ training: { ...before, consented: on, count: on ? before.count : 0, loaded: true } });
    setBusy(true);
    setMessage("");
    const result = await setTrainingConsent(on);
    setBusy(false);
    if (!result.ok) useCloud.setState({ training: before });
    setMessage(result.ok ? (result.note ?? "Saved. You choose each example yourself.") : result.error);
  }

  async function wipe() {
    setBusy(true);
    const result = await deleteContributions();
    setBusy(false);
    setMessage(result.ok ? (result.note ?? "") : result.error);
  }

  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="font-display text-2xl font-medium text-ink">Help improve the drafts</h2>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
        If you choose, you can share examples of customer messages and the replies you sent. They are used to train a small
        helper that works out which of your shop facts a message needs, and to improve how drafts are written, including in
        Pidgin and other local languages. It is off until you turn it on.
      </p>
      <ul className="mt-3 grid max-w-xl gap-1 text-sm leading-relaxed text-muted">
        <li>You pick each example yourself and see exactly what will be sent before it goes.</li>
        <li>Card numbers, ID numbers, emails, phone numbers and names are masked first. Check the preview anyway.</li>
        <li>Only you can read, and delete, what you shared. It is never sold.</li>
        <li>Turning this off deletes everything you shared. So does deleting your account.</li>
      </ul>
      {!training.loaded ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Checking your sharing setting…
        </p>
      ) : null}
      <label className={"mt-4 flex items-start gap-3 text-base text-ink " + (training.loaded ? "" : "hidden")}>
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[#9a3412]"
          checked={training.consented}
          disabled={busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
        <span>Yes, I may choose to share examples to help train the drafting helpers.</span>
      </label>
      {training.consented ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">
            You have shared {training.count} {training.count === 1 ? "example" : "examples"} (up to 200).
          </span>
          {training.count > 0 ? (
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => void wipe()}>
              Delete everything I shared
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-ink" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

/** Appears under a finished draft for people who opted in. Shows the masked example and lets them fix it first. */
export function ShareExample({
  note,
  original,
  final,
  workflow,
  channel,
  language,
  facts,
  source,
  today,
}: {
  note: string;
  original: string;
  final: string;
  workflow: string;
  channel: ChannelId;
  language: LanguageId;
  facts: Fact[];
  source: "live" | "template";
  today: string;
}) {
  const consented = useCloud((state) => state.training.consented);
  const [open, setOpen] = useState(false);
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [masked, setMasked] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setState("idle");
    setOpen(false);
  }, [final]);

  if (!consented || !note || !final.trim() || findChecks(final).length > 0) return null;

  function start() {
    const prepared = prepareContribution({ note, draft: original, final, workflow, channel, language, facts, source, today });
    setContribution(prepared.contribution);
    setMasked(prepared.masked);
    setOpen(true);
    setError("");
  }

  async function send() {
    if (!contribution) return;
    setState("sending");
    // One more masking pass over whatever the person edited, so nothing private slips in at the last step.
    const row = { ...contribution, note: redact(contribution.note).text, final: redact(contribution.final).text };
    const result = await shareExample(row);
    if (result.ok) {
      setState("done");
      setOpen(false);
    } else {
      setState("idle");
      setError(result.error);
    }
  }

  if (state === "done") {
    return (
      <p className="mt-3 text-sm text-ink" role="status">
        Shared. Thank you. You can delete it any time in your account.
      </p>
    );
  }

  return (
    <div className="mt-4 print:hidden">
      {!open ? (
        <button type="button" className={secondaryClass} onClick={start}>
          Share this example to help improve drafts
        </button>
      ) : contribution ? (
        <div className="rounded-xl border border-line bg-surface p-4" role="region" aria-label="Preview of what will be shared">
          <p className="text-sm font-medium text-ink">This is exactly what will be sent. Edit anything, then send.</p>
          <p className="mt-1 text-sm text-muted">
            {masked > 0 ? `${masked} private-looking detail${masked === 1 ? " was" : "s were"} masked. ` : "Nothing needed masking. "}
            Look for names, places or numbers that could identify a customer.
          </p>
          <label className="mt-3 block">
            <span className="text-sm font-medium text-ink">The customer's message</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed text-ink"
              rows={3}
              maxLength={1500}
              value={contribution.note}
              onChange={(event) => setContribution({ ...contribution, note: event.target.value })}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-medium text-ink">The reply you are sending</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed text-ink"
              rows={4}
              maxLength={6000}
              value={contribution.final}
              onChange={(event) => setContribution({ ...contribution, final: event.target.value })}
            />
          </label>
          <p className="mt-3 text-sm text-muted">
            Also sent: the first draft before your edits, the channel and language, which fact types it used, and how much you
            changed it. Nothing else about you.
          </p>
          {error ? (
            <p className="mt-2 text-sm text-ember" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={primaryClass} disabled={state === "sending" || contribution.note.trim().length < 8} onClick={() => void send()}>
              {state === "sending" ? "Sending…" : "Send this example"}
            </button>
            <button type="button" className={secondaryClass} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
