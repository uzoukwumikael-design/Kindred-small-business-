import { Copy } from "lucide-react";
import { track } from "@/lib/kindling/events";
import { useEffect, useState } from "react";
import { CHANNELS, findChecks, sendTarget, type ChannelId } from "@/lib/kindling/channels";
import type { DraftIssue } from "@/lib/kindling/checks";
import { LANGUAGES, type LanguageId } from "@/lib/kindling/languages";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

export function ChannelPicker({
  value,
  onChange,
  label = "Where will this be sent?",
}: {
  value: ChannelId;
  onChange: (next: ChannelId) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
        {CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
            className={
              "h-11 rounded-lg border px-4 text-sm font-medium " +
              (value === item.id ? "border-ember bg-ember-soft text-ink" : "border-line bg-surface text-ink hover:border-ink")
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LanguagePicker({ value, onChange }: { value: LanguageId; onChange: (next: LanguageId) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">Language for drafts</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Language for drafts">
        {LANGUAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
            className={
              "h-11 rounded-lg border px-4 text-sm font-medium " +
              (value === item.id ? "border-ember bg-ember-soft text-ink" : "border-line bg-surface text-ink hover:border-ink")
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      {value !== "english" ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          AI is weaker in Pidgin, Yoruba, Igbo and Hausa than in English, so every draft in them comes with a reminder to
          have a speaker read it first.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The draft is editable on purpose: the person fixes each [CHECK] bracket here, and only then does the
 * send button unlock. Template notes sit below the box and are never part of the message.
 */
export function DraftEditor({
  text,
  onChange,
  channel,
  languageNote,
  sendable,
  notes,
  used,
  issues,
  onKeep,
  allowKeep = true,
}: {
  text: string;
  onChange: (next: string) => void;
  channel: ChannelId;
  languageNote: string;
  sendable: boolean;
  notes: string[];
  used: string[];
  issues: DraftIssue[];
  onKeep: (text: string) => void;
  allowKeep?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [asked, setAsked] = useState(false);
  const [kept, setKept] = useState(false);
  // A new message is a new candidate: editing the draft clears the saved state.
  useEffect(() => {
    setKept(false);
  }, [text]);
  const checks = findChecks(text);
  const target = sendTarget(channel, text);
  const locked = checks.length > 0;

  function keep() {
    onKeep(text);
    setKept(true);
    setAsked(false);
  }

  async function copy() {
    if (!locked && !kept) setAsked(true);
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4">
      <textarea
        aria-label="Your draft"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        rows={Math.min(14, Math.max(6, text.split("\n").length + 1))}
        maxLength={6000}
        className="w-full rounded-xl border border-line bg-paper p-4 font-sans text-base leading-relaxed text-ink outline-none"
      />

      {used.length > 0 ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Looks like these came from your facts: {used.join(", ")}.
        </p>
      ) : null}

      {languageNote ? (
        <p className="mt-3 rounded-lg border border-ember bg-ember-soft p-3 text-sm leading-relaxed text-ink" role="status">
          {languageNote}
        </p>
      ) : null}

      {issues.length > 0 ? (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3" role="status" aria-label="Double-check these">
          <p className="text-sm font-medium text-ink">Double-check these. They may be fine, but they are not in your note or facts.</p>
          <ul className="mt-2 grid gap-1 text-sm text-ink">
            {issues.map((issue, index) => (
              <li key={`${issue.kind}-${index}`}>{issue.detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {locked ? (
        <div className="mt-3 rounded-lg border border-ember bg-ember-soft p-3" role="status">
          <p className="text-sm font-medium text-ink">
            {checks.length} {checks.length === 1 ? "bracket" : "brackets"} left. Replace each one with the real fact, or
            delete the sentence.
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-ink">
            {checks.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink" role="status">
          No brackets left. Read it once more as the customer would, then send it yourself.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={secondaryClass} onClick={() => void copy()}>
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
        {sendable ? (
          locked ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Fix the brackets first"
              className={`${primaryClass} opacity-50`}
            >
              {target.label} (locked)
            </button>
          ) : target.href ? (
            <a className={primaryClass} href={target.href} target="_blank" rel="noopener noreferrer" onClick={() => {
                track("send_clicked");
                if (!kept) setAsked(true);
              }}>
              {target.label}
            </a>
          ) : (
            <button
              type="button"
              className={primaryClass}
              onClick={() => {
                track("send_clicked");
                void copy();
              }}
            >
              {target.label}
            </button>
          )
        ) : null}
        {!locked && allowKeep ? (
          <button type="button" className={secondaryClass} disabled={kept} onClick={keep}>
            {kept ? "Saved as an example" : "Save as a good example"}
          </button>
        ) : null}
      </div>
      {allowKeep && asked && !kept && !locked ? (
        <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
          Did it go out the way you wrote it? Keep it so future drafts sound more like you.{" "}
          <button type="button" className="font-medium text-ember underline underline-offset-2" onClick={keep}>
            Yes, keep it
          </button>{" "}
          <button type="button" className="text-muted underline underline-offset-2" onClick={() => setAsked(false)}>
            No thanks
          </button>
        </p>
      ) : null}
      {sendable && locked ? (
        <p className="mt-2 text-sm text-muted">The send button unlocks when every bracket is fixed.</p>
      ) : null}
      {sendable && !locked && target.tooLong ? (
        <p className="mt-2 text-sm text-ember">This is long for a link. If WhatsApp cuts it off, use Copy and paste it instead.</p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="mt-4 grid gap-1 text-sm text-muted">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
