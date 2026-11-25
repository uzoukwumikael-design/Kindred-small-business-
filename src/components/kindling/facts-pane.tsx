import { Trash2 } from "lucide-react";
import { useState } from "react";
import { FACT_KEYS, STALE_DAYS, ageDays, isStale, styleProfile } from "@/lib/kindling/facts";
import { describeKinds, redact } from "@/lib/kindling/redact";
import { localDay } from "@/lib/kindling/summary";
import { useKindling } from "@/lib/kindling/store";
import type { Fact } from "@/lib/kindling/types";
import { fieldClass, primaryClass, secondaryClass } from "@/components/kindling/shell";

function niceDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function FactRow({
  keyId,
  label,
  placeholder,
  hint,
  fact,
}: {
  keyId: string;
  label: string;
  placeholder: string;
  hint: string;
  fact?: Fact;
}) {
  const saveFact = useKindling((state) => state.saveFact);
  const confirmFact = useKindling((state) => state.confirmFact);
  const [value, setValue] = useState(fact?.value ?? "");
  const today = localDay();
  const stale = fact ? isStale(fact, today) : false;
  const masked = redact(value);

  function commit() {
    const next = value.trim();
    if (next === (fact?.value ?? "")) return;
    saveFact({ key: keyId, label, value: next });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <label className="block">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="mt-1 block text-sm text-muted">{hint}</span>
        <textarea
          className={`${fieldClass} mt-2 h-auto min-h-[3.5rem] py-3 leading-relaxed`}
          rows={2}
          maxLength={300}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
        />
      </label>
      {masked.count > 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-ember" role="status">
          This looks like {describeKinds(masked.kinds)}. It will be replaced with a placeholder before an AI sees it, so
          it cannot appear in a draft. {keyId === "payment" ? "Use a payment link instead." : "Take it out."}
        </p>
      ) : null}
      {fact ? (
        <p className={"mt-2 text-sm " + (stale ? "text-ember" : "text-muted")}>
          {stale
            ? `Confirmed ${niceDay(fact.checkedOn)}, ${ageDays(fact.checkedOn, today)} days ago. Drafts are not using this until you confirm it.`
            : `Confirmed ${niceDay(fact.checkedOn)}.`}{" "}
          {stale || ageDays(fact.checkedOn, today) > 30 ? (
            <button
              type="button"
              className="font-medium text-ink underline underline-offset-2"
              onClick={() => {
                confirmFact(fact.id);
              }}
            >
              Still true
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function FactsPane() {
  const facts = useKindling((state) => state.facts);
  const learned = useKindling((state) => state.learned);
  const saveFact = useKindling((state) => state.saveFact);
  const removeFact = useKindling((state) => state.removeFact);
  const removeLearned = useKindling((state) => state.removeLearned);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const custom = facts.filter((fact) => fact.key === "custom");
  const profile = styleProfile(learned);
  const notes = profile.notes;

  function addCustom() {
    if (!label.trim() || !value.trim()) return;
    saveFact({ key: "custom", label: label.trim(), value });
    setLabel("");
    setValue("");
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-medium text-ink">Shop facts</h2>
      <p className="mt-3 text-base leading-relaxed text-ink">
        Write down what is true once. Drafts use these facts instead of leaving a bracket, and still bracket anything you
        have not told them.
      </p>
      <p className="mt-2 text-base leading-relaxed text-muted">
        Only confirmed facts are used. After {STALE_DAYS} days a fact waits until you press Still true, so an old price
        never goes out by accident. Facts are sent to the AI service with each draft, after private-looking details are
        masked, so keep to things you would put on a notice board.
      </p>

      <div className="mt-6 grid gap-4">
        {FACT_KEYS.map((item) => (
          <FactRow
            key={item.key + (facts.find((fact) => fact.key === item.key)?.id ?? "new")}
            keyId={item.key}
            label={item.label}
            placeholder={item.placeholder}
            hint={item.hint}
            fact={facts.find((fact) => fact.key === item.key)}
          />
        ))}
      </div>

      <section className="mt-8">
        <h3 className="font-display text-xl font-medium text-ink">Your own facts</h3>
        {custom.length > 0 ? (
          <ul className="mt-3 grid gap-3">
            {custom.map((fact) => (
              <li key={fact.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{fact.label}</p>
                    <p className="mt-1 text-base text-ink">{fact.value}</p>
                    <p className={"mt-1 text-sm " + (isStale(fact, localDay()) ? "text-ember" : "text-muted")}>
                      {isStale(fact, localDay()) ? "Needs a re-check. " : ""}Confirmed {niceDay(fact.checkedOn)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${fact.label}`}
                    onClick={() => removeFact(fact.id)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-ember-soft hover:text-ink"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="block">
            <span className="text-sm text-muted">What it is</span>
            <input className={`${fieldClass} mt-1`} maxLength={40} value={label} placeholder="Allergy note" onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-muted">The fact</span>
            <input className={`${fieldClass} mt-1`} maxLength={300} value={value} placeholder="We cook with peanut oil on Fridays." onChange={(event) => setValue(event.target.value)} />
          </label>
          <button type="button" className={primaryClass} onClick={addCustom} disabled={!label.trim() || !value.trim()}>
            Add
          </button>
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <h3 className="font-display text-xl font-medium text-ink">How it has learned to write like you</h3>
        {learned.length === 0 ? (
          <p className="mt-2 text-base leading-relaxed text-muted">
            Nothing yet. After you fix a draft, press Save as a good example. Kindling keeps up to 8 and uses the latest 3
            as a guide to your style. Private-looking details are masked when you save.
          </p>
        ) : (
          <>
            {notes.length > 0 ? (
              <p className="mt-3 text-sm text-muted">
                {profile.confidence === "early"
                  ? `An early guess from ${profile.count} messages. It gets more reliable with five or more.`
                  : `Based on ${profile.count} messages.`}
              </p>
            ) : null}
            {notes.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-base text-ink">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-base text-muted">Your saved messages already guide the drafts. Save {Math.max(1, 3 - learned.length)} more and I will describe your style, with the counts behind it.</p>
            )}
            <ul className="mt-4 grid gap-3">
              {learned.map((item) => (
                <li key={item.id} className="rounded-xl border border-line bg-surface p-4">
                  <p className="whitespace-pre-line text-base leading-relaxed text-ink">{item.text}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">Kept {niceDay(item.day)}</span>
                    <button type="button" className={secondaryClass} onClick={() => removeLearned(item.id)}>
                      Forget this one
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
