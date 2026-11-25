import { useNavigate } from "@tanstack/react-router";
import { track } from "@/lib/kindling/events";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { MATURITY, PAINS, TEAMS, TONES, TRADES, WORRIES } from "@/lib/kindling/catalog";
import { ensureHydrated, useKindling } from "@/lib/kindling/store";
import type { Intake, MaturityId, PainId, Shop, TeamId, ToneId, TradeId, WorryId } from "@/lib/kindling/types";
import { fieldClass, primaryClass, secondaryClass } from "@/components/kindling/shell";

type Draft = {
  trade: TradeId | null;
  team: TeamId | null;
  pain: PainId | null;
  maturity: MaturityId | null;
  worry: WorryId | null;
};

const QUESTIONS: { key: keyof Draft; kicker: string; title: string; choices: { id: string; label: string; hint: string }[] }[] = [
  { key: "trade", kicker: "The shop", title: "What kind of work is it?", choices: TRADES },
  { key: "team", kicker: "The crew", title: "How many people show up, including you?", choices: TEAMS },
  { key: "pain", kicker: "The hour", title: "Which part of the week do you want back?", choices: PAINS },
  { key: "maturity", kicker: "Today", title: "How does AI show up in the work right now?", choices: MATURITY },
  { key: "worry", kicker: "The brake", title: "What would make you stop?", choices: WORRIES },
];

export function Bench() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    trade: null,
    team: null,
    pain: null,
    maturity: null,
    worry: null,
  });
  const [name, setName] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState<ToneId>("warm");
  const [voiceSample, setVoiceSample] = useState("");
  const [hourly, setHourly] = useState("40");
  const [saving, setSaving] = useState(false);

  const question = QUESTIONS[step];
  const onFacts = step >= QUESTIONS.length;
  const selected = question ? draft[question.key] : null;

  function choose(id: string) {
    if (!question) return;
    setDraft((current) => ({ ...current, [question.key]: id }));
  }

  async function finish() {
    if (!draft.trade || !draft.team || !draft.pain || !draft.maturity || !draft.worry) return;
    const rate = Number(hourly);
    const shop: Shop = {
      name: name.trim(),
      offer: offer.trim(),
      tone,
      voiceSample: voiceSample.trim().slice(0, 800),
      channel: "whatsapp",
      language: "english",
      hourly: Number.isFinite(rate) ? Math.min(400, Math.max(8, Math.round(rate))) : 40,
    };
    const intake: Intake = {
      trade: draft.trade,
      team: draft.team,
      pain: draft.pain,
      maturity: draft.maturity,
      worry: draft.worry,
    };
    setSaving(true);
    await ensureHydrated();
    useKindling.getState().commit(intake, shop);
    track("week_built");
    await navigate({ to: "/studio" });
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className="h-full bg-ember transition-all duration-200"
          style={{ width: `${Math.round((onFacts ? 1 : (step + (selected ? 0.35 : 0)) / QUESTIONS.length) * 100)}%` }}
        />
      </div>
      <p className="mt-6 text-sm font-medium text-ember">
        {onFacts ? "Last step" : `Question ${step + 1} of ${QUESTIONS.length}`}
      </p>

      {question ? (
        <>
          <p className="mt-3 text-sm text-muted">{question.kicker}</p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
            {question.title}
          </h1>
          <div className="mt-8 grid gap-3 sm:grid-cols-2" role="listbox" aria-label={question.title}>
            {question.choices.map((choice) => {
              const on = selected === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => choose(choice.id)}
                  className={
                    "min-h-11 rounded-xl border px-4 py-4 text-left transition-colors " +
                    (on ? "border-ember bg-ember-soft" : "border-line bg-surface hover:border-ink")
                  }
                >
                  <span className="block text-base font-medium text-ink">{choice.label}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{choice.hint}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
            Make the prompt sound like the shop.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Optional, and it stays in this browser. Skip the name if you’d rather not, the recipe still works.
          </p>
          <div className="mt-8 grid gap-5">
            <label className="block">
              <span className="text-sm font-medium text-ink">What do you call it?</span>
              <input
                className={`${fieldClass} mt-2`}
                value={name}
                maxLength={80}
                placeholder="North & Rye"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">What do you actually do?</span>
              <input
                className={`${fieldClass} mt-2`}
                value={offer}
                maxLength={240}
                placeholder="Neighborhood coffee and Saturday catering trays"
                onChange={(event) => setOffer(event.target.value)}
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Voice</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TONES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={tone === item.id}
                    onClick={() => setTone(item.id)}
                    className={
                      "h-11 rounded-lg border px-4 text-sm font-medium transition-colors " +
                      (tone === item.id
                        ? "border-ember bg-ember-soft text-ink"
                        : "border-line bg-surface text-ink hover:border-ink")
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium text-ink">One real message you sent that sounded like you</span>
              <span className="mt-1 block text-sm text-muted">
                Optional. A reply, a text, a post. Remove card numbers and private details first. This is the single
                biggest thing that makes drafts sound right.
              </span>
              <textarea
                className="mt-2 w-full rounded-lg border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
                rows={4}
                maxLength={800}
                value={voiceSample}
                placeholder="Hey Sam, yes we can do Saturday pickup. Trays are ready by 9, door is round the back."
                onChange={(event) => setVoiceSample(event.target.value)}
              />
            </label>
            <label className="block max-w-xs">
              <span className="text-sm font-medium text-ink">What is an hour of your time worth?</span>
              <span className="mt-1 block text-sm text-muted">Used only for the hours ledger. A guess is fine.</span>
              <input
                className={`${fieldClass} mt-2 tabular-nums`}
                inputMode="numeric"
                value={hourly}
                onChange={(event) => setHourly(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              />
            </label>
          </div>
        </>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          className={secondaryClass}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
        {onFacts ? (
          <button type="button" className={primaryClass} onClick={() => void finish()} disabled={saving}>
            {saving ? "Building…" : "Show my week"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={primaryClass}
            disabled={!selected}
            onClick={() => setStep((current) => current + 1)}
          >
            Next
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {onFacts ? "Shop details" : `Question ${step + 1}`}
      </p>
    </main>
  );
}
