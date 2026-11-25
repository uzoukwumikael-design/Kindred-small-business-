import { Link } from "@tanstack/react-router";
import { track } from "@/lib/kindling/events";
import { useServerFn } from "@tanstack/react-start";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, Copy, Download, Printer, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { askKindling } from "@/lib/kindling/ai";
import { byId, fillPrompt, SOURCES, TONE_LINE, TONES, TRADES, tradeRules, workflowFor } from "@/lib/kindling/catalog";
import { buildPlan, monthDollars } from "@/lib/kindling/engine";
import { formatHourSpan, formatMoney, hourUnit } from "@/lib/kindling/format";
import { CLOUD_ENABLED, useCloud } from "@/lib/kindling/cloud";
import { describeKinds, redact } from "@/lib/kindling/redact";
import { useKindling } from "@/lib/kindling/store";
import type { Shop, TradeId } from "@/lib/kindling/types";
import { RulesShare } from "@/components/kindling/rules-share";
import { WeeklySummary } from "@/components/kindling/weekly";
import { AiConsentNotice, useAiConsent } from "@/components/kindling/ai-consent";
import { ShareExample } from "@/components/kindling/training-ui";
import { analyzeNote } from "@/lib/kindling/account-server";
import { FACT_KEYS } from "@/lib/kindling/facts";
import { ChannelPicker, DraftEditor, LanguagePicker } from "@/components/kindling/draft-editor";
import { effectiveLanguage, needsNativeCheck } from "@/lib/kindling/languages";
import { FactsPane } from "@/components/kindling/facts-pane";
import { checkDraft } from "@/lib/kindling/checks";
import { InstallCard } from "@/components/kindling/install";
import { factsForAi, factsUsed, learnedForAi, styleForAi, usableFacts } from "@/lib/kindling/facts";
import { takeSharedNote } from "@/lib/kindling/share-in";
import { localDay } from "@/lib/kindling/summary";
import { channelLabel, usesChannel } from "@/lib/kindling/channels";
import { LedgerPane } from "@/components/kindling/ledger";
import { fieldClass, primaryClass, secondaryClass } from "@/components/kindling/shell";

const TABS = [
  { id: "run", label: "Run it" },
  { id: "prompt", label: "Prompt" },
  { id: "facts", label: "Shop facts" },
  { id: "try", label: "Try a real note" },
  { id: "rules", label: "House rules" },
  { id: "ledger", label: "Hours" },
] as const;

export function Studio() {
  const ready = useKindling((state) => state.ready);
  const intake = useKindling((state) => state.intake);
  const shop = useKindling((state) => state.shop);

  const syncing = useCloud((state) => state.syncing);

  if (!ready || (!intake && syncing)) {
    return (
      <main className="min-h-[70vh] px-5 py-16 sm:px-8" aria-busy="true">
        {syncing ? <p className="mx-auto max-w-3xl text-base text-muted">Loading your saved week…</p> : null}
      </main>
    );
  }

  if (!intake) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-sm font-medium text-ember">Nothing on the bench</p>
        <h1 className="mt-3 font-display text-4xl font-medium text-ink sm:text-5xl">
          Your week hasn’t been built yet.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Five questions. You’ll leave with one workflow, a prompt, and a house rule, not a pile of tools.
        </p>
        <Link to="/bench" className={`${primaryClass} mt-8`}>
          Start the bench
        </Link>
      </main>
    );
  }

  const plan = buildPlan(intake, shop);
  return <PlanView key={plan.primary.id + intake.trade + intake.pain} />;
}

function PlanView() {
  const intake = useKindling((state) => state.intake);
  const shop = useKindling((state) => state.shop);
  const checks = useKindling((state) => state.checks);
  const sharpened = useKindling((state) => state.sharpened);
  const drafts = useKindling((state) => state.drafts);
  const toggleCheck = useKindling((state) => state.toggleCheck);
  const updateVoice = useKindling((state) => state.updateVoice);
  const setHourly = useKindling((state) => state.setHourly);
  const swapJob = useKindling((state) => state.swapJob);
  const reset = useKindling((state) => state.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rate, setRate] = useState(String(shop.hourly));
  const facts = useKindling((state) => state.facts);
  const [tab, setTab] = useState<string>("run");
  const [shared, setShared] = useState("");
  useEffect(() => {
    const note = takeSharedNote();
    if (note) {
      setShared(note);
      setTab("try");
    }
  }, []);

  if (!intake) return null;
  const plan = buildPlan(intake, shop);
  const primary = plan.primary;
  const hours = formatHourSpan(primary.lowMinutes, primary.highMinutes);
  const unit = hourUnit(primary.highMinutes);
  const dollars = monthDollars(primary.minutes, shop.hourly);
  const filled = fillPrompt(primary.promptTemplate, shop, facts);
  const promptText = sharpened[primary.id]?.trim() ? sharpened[primary.id] : filled;
  const exportText = weekAsText(plan, promptText ?? filled, shop.name);
  const done = primary.monday.filter((_, index) => checks[`${primary.id}:${index}`]).length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">{plan.stageName}</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">{primary.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">{primary.dek}</p>
      <p className="mt-4 text-base leading-relaxed text-muted">{plan.stageLine}</p>

      <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label="Back / week" value={hours} unit={unit} accent />
        <Stat label="About / month" value={formatMoney(dollars)} />
        <Stat label="New tools" value="$0" />
        <Stat label="First draft" value={`${primary.setupMinutes}m`} />
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Planning range for {primary.cadence}, already net of time spent checking. At{" "}
        {formatMoney(shop.hourly)} an hour. Not a promise. {plan.tradeLabel}. {plan.teamLabel}.
      </p>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-medium text-ink">Why this one</h2>
        <p className="mt-3 text-base leading-relaxed text-ink">{primary.fit}</p>
        <p className="mt-3 text-base leading-relaxed text-muted">{plan.worryNote}</p>
      </section>

      <SaveBanner />
      <WeeklySummary />
      <p className="mt-4 text-sm text-muted print:hidden">
        New to checking drafts?{" "}
        <Link to="/learn" className="font-medium text-ember underline underline-offset-2">
          Take the seven-minute walkthrough
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <button type="button" className={secondaryClass} onClick={() => downloadText(exportText, shop.name)}>
          <Download className="size-4" aria-hidden="true" />
          Download the week
        </button>
        <button type="button" className={secondaryClass} onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print it
        </button>
      </div>

      <ShopFields
        shop={shop}
        showChannel={usesChannel(primary.pain)}
        rate={rate}
        onRate={(value) => {
          setRate(value);
          const next = Number(value);
          if (Number.isFinite(next) && next >= 8 && next <= 400) setHourly(Math.round(next));
        }}
        onVoice={(patch) =>
          updateVoice({
            name: shop.name,
            offer: shop.offer,
            tone: shop.tone,
            voiceSample: shop.voiceSample ?? "",
            channel: shop.channel ?? "whatsapp",
            language: shop.language ?? "english",
            ...patch,
          })
        }
      />

      <Tabs.Root value={tab} onValueChange={setTab} className="mt-10">
        <Tabs.List className="flex gap-2 overflow-x-auto pb-1" aria-label="Workflow">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="h-11 shrink-0 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-on-ink"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="run" className="pt-6">
          <ol className="grid gap-4">
            {primary.steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-line bg-surface p-5">
                <p className="font-display text-xl text-ember">0{index + 1}</p>
                <h3 className="mt-2 font-display text-2xl font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl font-medium text-ink">Before close</h2>
              <p className="text-sm tabular-nums text-muted">
                {done} of {primary.monday.length}
              </p>
            </div>
            <ul className="mt-4 grid gap-3">
              {primary.monday.map((item, index) => {
                const id = `${primary.id}:${index}`;
                const on = Boolean(checks[id]);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCheck(id)}
                      className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left"
                    >
                      <span
                        className={
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md " +
                          (on ? "bg-ink text-on-ink" : "border border-line bg-paper text-transparent")
                        }
                        aria-hidden="true"
                      >
                        <Check className="size-4" strokeWidth={2.5} />
                      </span>
                      <span className={"text-base leading-relaxed " + (on ? "text-muted line-through" : "text-ink")}>
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Tabs.Content>

        <Tabs.Content value="prompt" className="pt-6">
          <PromptPane
            workflowId={primary.id}
            text={promptText ?? filled}
            customized={Boolean(sharpened[primary.id]?.trim())}
            original={filled}
          />
        </Tabs.Content>

        <Tabs.Content value="facts" className="pt-6">
          <FactsPane />
        </Tabs.Content>

        <Tabs.Content value="try" className="pt-6">
          <TryPane
            workflowId={primary.id}
            title={primary.title}
            intent={primary.fit}
            outputShape={workflowFor(intake.pain).outputShape}
            stored={drafts[primary.id] ?? ""}
            sharedNote={shared}
            onOpenFacts={() => setTab("facts")}
          />
        </Tabs.Content>

        <Tabs.Content value="rules" className="pt-6">
          <h2 className="font-display text-2xl font-medium text-ink">Paste this where the crew will see it</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            The point of the page is to end unofficial use. One job, one never-list, one person who sends.
          </p>
          <CopyBlock id="rules" text={plan.rules} />
          <RulesShare rules={plan.rules} name={shop.name} job={primary.title} />
        </Tabs.Content>

        <Tabs.Content value="ledger" className="pt-6">
          <LedgerPane primary={primary} hourly={shop.hourly} />
        </Tabs.Content>
      </Tabs.Root>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="font-display text-2xl font-medium text-ink">Not this week</h2>
        <p className="mt-2 text-base text-muted">Two later jobs for this kind of shop. They wait on purpose.</p>
        <ul className="mt-5 grid gap-3">
          {plan.queue.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-paper p-5">
              <p className="font-display text-xl font-medium text-ink">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{item.dek}</p>
              <button
                type="button"
                className="mt-4 inline-flex h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink print:hidden"
                onClick={() => {
                  swapJob(item.pain);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Make this the job instead
              </button>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 border-t border-line pt-6">
        <summary className="text-base font-medium text-ink">Where this shape comes from</summary>
        <div className="mt-4 grid gap-4">
          {SOURCES.map((source) => (
            <article key={source.title}>
              <h3 className="text-sm font-medium text-ink">{source.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{source.detail}</p>
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-sm font-medium text-ember underline underline-offset-2"
                >
                  Read the source
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </details>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {confirmReset ? (
          <>
            <button type="button" className={primaryClass} onClick={() => reset()}>
              Yes, clear this week
            </button>
            <button type="button" className={secondaryClass} onClick={() => setConfirmReset(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className={secondaryClass} onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Start over
          </button>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={"mt-1 font-display text-3xl tabular-nums " + (accent ? "text-ember" : "text-ink")}>
        {value}
        {unit ? <span className="font-sans text-sm font-normal text-muted"> {unit}</span> : null}
      </dd>
    </div>
  );
}

function ShopFields({
  shop,
  rate,
  onRate,
  onVoice,
  showChannel,
}: {
  shop: Shop;
  showChannel: boolean;
  rate: string;
  onRate: (value: string) => void;
  onVoice: (patch: Partial<Pick<Shop, "name" | "offer" | "tone" | "voiceSample" | "channel" | "language">>) => void;
}) {
  const { name, offer, tone } = shop;
  const voiceSample = shop.voiceSample ?? "";
  return (
    <fieldset className="mt-8 grid gap-4 rounded-xl border border-line p-5 print:hidden">
      <legend className="px-1 font-display text-xl text-ink">Sound like the shop</legend>
      <label className="block">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          className={`${fieldClass} mt-2`}
          value={name}
          maxLength={80}
          placeholder="What you call it"
          onChange={(event) => onVoice({ name: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">What you do</span>
        <input
          className={`${fieldClass} mt-2`}
          value={offer}
          maxLength={240}
          placeholder="One true sentence"
          onChange={(event) => onVoice({ offer: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">A real message you sent that sounded like you</span>
        <span className="mt-1 block text-sm text-muted">
          Drafts copy its style, never its facts. Remove private details first.
        </span>
        <textarea
          className="mt-2 w-full rounded-lg border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
          rows={4}
          maxLength={800}
          value={voiceSample}
          placeholder="Paste one reply, text, or post you were happy with."
          onChange={(event) => onVoice({ voiceSample: event.target.value })}
        />
      </label>
      <LanguagePicker value={shop.language ?? "english"} onChange={(language) => onVoice({ language })} />
      {showChannel ? (
        <ChannelPicker
          value={shop.channel ?? "whatsapp"}
          label="Where you usually reply to customers"
          onChange={(channel) => onVoice({ channel })}
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Voice</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TONES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tone === item.id}
                onClick={() => onVoice({ tone: item.id })}
                className={
                  "h-11 rounded-lg border px-4 text-sm font-medium " +
                  (tone === item.id ? "border-ember bg-ember-soft text-ink" : "border-line bg-surface text-ink")
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block w-28">
          <span className="text-sm font-medium text-ink">$/hour</span>
          <input
            className={`${fieldClass} mt-2 tabular-nums`}
            inputMode="numeric"
            value={rate}
            onChange={(event) => onRate(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          />
        </label>
      </div>
    </fieldset>
  );
}

function PromptPane({
  workflowId,
  text,
  customized,
  original,
}: {
  workflowId: string;
  text: string;
  customized: boolean;
  original: string;
}) {
  const intake = useKindling((state) => state.intake);
  const shop = useKindling((state) => state.shop);
  const remember = useKindling((state) => state.remember);
  const markAiUse = useKindling((state) => state.markAiUse);
  const ask = useServerFn(askKindling);
  const [error, setError] = useState("");
  const consent = useAiConsent();
  const [pending, setPending] = useState(false);

  if (!intake) return null;
  const trade = intake.trade;
  const pain = intake.pain;

  async function sharpen() {
    if (consent.needed && !consent.given) return;
    setPending(true);
    setError("");
    try {
      const result = await ask({
        data: {
          mode: "sharpen",
          businessName: shop.name,
          offer: shop.offer,
          toneLine: TONE_LINE[shop.tone],
          tradeLabel: tradeLabel(trade),
          workflowTitle: workflowFor(pain).title,
          workflowIntent: workflowFor(pain).fit,
          outputShape: workflowFor(pain).outputShape,
          promptTemplate: original,
          sourceText: "",
          extraRules: tradeRules(trade, pain).join("\n"),
          voiceSample: shop.voiceSample ?? "",
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.source === "live") markAiUse();
      remember("sharpened", workflowId, result.text);
    } catch {
      setError("That didn’t go through. Copy the prompt and use the chat tool you already have.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium text-ink">Paste this into the chat tool you already use</h2>
          <p className="mt-2 text-sm text-muted">
            {customized ? "Sharpened for this shop. " : "Filled with the shop details above. "}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <CopyBlock id="prompt" text={text} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <AiConsentNotice consent={consent} />
        <button type="button" className={primaryClass} onClick={() => void sharpen()} disabled={pending || (consent.needed && !consent.given)}>
          {pending ? "Sharpening…" : "Sharpen this prompt"}
        </button>
        {customized ? (
          <button
            type="button"
            className={secondaryClass}
            onClick={() => remember("sharpened", workflowId, "")}
          >
            Use the original
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-4 text-sm leading-relaxed text-ember">{error}</p> : null}
    </div>
  );
}

function TryPane({
  workflowId,
  title,
  intent,
  outputShape,
  stored,
  sharedNote,
  onOpenFacts,
}: {
  workflowId: string;
  title: string;
  intent: string;
  outputShape: string;
  stored: string;
  sharedNote: string;
  onOpenFacts: () => void;
}) {
  const intake = useKindling((state) => state.intake);
  const shop = useKindling((state) => state.shop);
  const remember = useKindling((state) => state.remember);
  const markAiUse = useKindling((state) => state.markAiUse);
  const facts = useKindling((state) => state.facts);
  const learned = useKindling((state) => state.learned);
  const addLearned = useKindling((state) => state.addLearned);
  const ask = useServerFn(askKindling);
  const [note, setNote] = useState("");
  const [cameFromShare, setCameFromShare] = useState(false);
  // The note the current draft came from, so the checker can compare against it. It is not kept across reloads.
  const [draftedFrom, setDraftedFrom] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [guess, setGuess] = useState<{ key: string; p: number }[]>([]);
  // A small trained helper guesses which shop facts the message needs, so you can add one before drafting.
  useEffect(() => {
    const text = note.trim();
    if (text.length < 8) {
      setGuess([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      analyzeNote({ data: { note: text } })
        .then((result) => {
          if (alive) setGuess(result.needs);
        })
        .catch(() => {
          if (alive) setGuess([]);
        });
    }, 600);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [note]);
  const [keptMasked, setKeptMasked] = useState(0);
  useEffect(() => {
    if (sharedNote) {
      setNote(sharedNote);
      setCameFromShare(true);
    }
  }, [sharedNote]);
  const [error, setError] = useState("");
  const consent = useAiConsent();
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<"live" | "template" | "">("");
  const [maskedCount, setMaskedCount] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);

  if (!intake) return null;
  const trade = intake.trade;
  const pain = intake.pain;
  const message = usesChannel(pain);
  const channel = shop.channel ?? "whatsapp";

  async function draft() {
    if (consent.needed && !consent.given) return;
    if (note.trim().length < 8) {
      setError("Paste a real note first, a sentence is enough.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await ask({
        data: {
          mode: "draft",
          businessName: shop.name,
          offer: shop.offer,
          toneLine: TONE_LINE[shop.tone],
          tradeLabel: tradeLabel(trade),
          workflowTitle: title,
          workflowIntent: intent,
          outputShape,
          promptTemplate: "n/a",
          sourceText: note.trim(),
          extraRules: tradeRules(trade, pain).map((rule) => `- ${rule}`).join("\n"),
          voiceSample: shop.voiceSample ?? "",
          channel,
          useChannel: message,
          language: shop.language ?? "english",
          facts: factsForAi(facts, localDay()),
          learned: learnedForAi(learned),
          styleNotes: styleForAi(learned),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.source === "live") markAiUse();
      remember("drafts", workflowId, result.text);
      setDraftedFrom(note.trim());
      setOriginalDraft(result.text);
      setNotes(result.notes ?? []);
      track("draft_created");
      setSource(result.source);
      setMaskedCount(result.redacted);
    } catch {
      setError("That didn’t go through. Try once more, or use the prompt in your own chat tool.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-medium text-ink">One messy note from this week</h2>
      <p className="mt-2 text-base leading-relaxed text-muted">
        A customer message, a job scribble, a half-written post. You’ll get a draft with [CHECK] wherever a
        fact was missing. A person still decides what gets sent.
      </p>
      {cameFromShare ? (
        <p className="mb-3 rounded-lg border border-ember bg-ember-soft p-3 text-sm leading-relaxed text-ink" role="status">
          Shared from another app. Read it, take out anything private, then press Draft it.
        </p>
      ) : null}
      <label className="mt-5 block">
        <span className="sr-only">Note to draft from</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={4000}
          rows={7}
          placeholder="Paste the messy version. Don’t tidy it."
          className="w-full rounded-xl border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
        />
      </label>
      {(() => {
        const found = redact(note);
        return found.count > 0 ? (
          <p className="mt-3 rounded-lg border border-ember bg-ember-soft p-3 text-sm leading-relaxed text-ink" role="status">
            This note seems to contain {describeKinds(found.kinds)}. It will be replaced with a placeholder before
            anything is sent. Best to take it out yourself.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Leave out card numbers, passwords and private customer details. We mask the obvious ones, but we cannot
            catch everything.
          </p>
        );
      })()}
      {(() => {
        const have = new Set(usableFacts(facts, localDay()).map((fact) => fact.key));
        const missing = guess.filter((item) => FACT_KEYS.some((k) => k.key === item.key) && !have.has(item.key));
        if (missing.length === 0) return null;
        const labels = missing.map((item) => FACT_KEYS.find((k) => k.key === item.key)?.label.toLowerCase()).join(", ");
        return (
          <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink" role="status" aria-label="Missing facts">
            This message looks like it asks about {labels}. You have not saved that fact, so the draft will leave a bracket.{" "}
            <button type="button" className="font-medium text-ember underline underline-offset-2" onClick={onOpenFacts}>
              Add it in Shop facts
            </button>
            . A small helper guessed this from the words, so it can be wrong.
          </p>
        );
      })()}
      {message ? (
        <p className="mt-4 text-sm text-muted">
          Writing for {channelLabel(channel)}. Change this under Sound like the shop, above.
        </p>
      ) : null}
      <InstallCard />
      <AiConsentNotice consent={consent} />
      <button
        type="button"
        className={`${primaryClass} mt-4`}
        onClick={() => void draft()}
        disabled={pending || (consent.needed && !consent.given)}
      >
        {pending ? "Drafting…" : "Draft it"}
      </button>
      {error ? <p className="mt-4 text-sm leading-relaxed text-ember">{error}</p> : null}
      {stored && maskedCount > 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {maskedCount} private-looking {maskedCount === 1 ? "detail was" : "details were"} replaced with placeholders
          before this was sent. Put the real ones back yourself if the draft needs them.
        </p>
      ) : null}
      {stored ? (
        <div className="mt-6">
          <p className="text-sm font-medium text-ink">
            Draft{source === "template" ? " (template, no AI connected)" : ""}: check every bracket before it leaves the building
          </p>
          <DraftEditor
            text={stored}
            onChange={(next) => remember("drafts", workflowId, next)}
            channel={channel}
            languageNote={
              needsNativeCheck(effectiveLanguage(shop.language, draftedFrom || note))
                ? "This draft is not in English. Ask someone who speaks the language to read it before you send it. AI can get local words and spelling wrong."
                : ""
            }
            sendable={message}
            notes={notes}
            used={factsUsed(stored, usableFacts(facts, localDay()))}
            issues={
              draftedFrom
                ? checkDraft({
                    draft: stored,
                    note: draftedFrom,
                    facts: usableFacts(facts, localDay()),
                    channel,
                    useChannel: message,
                  })
                : []
            }
            onKeep={(text) => {
              track("example_kept");
              const masked = redact(text);
              setKeptMasked(masked.count);
              addLearned({ text: masked.text, workflowId, channel, day: localDay() });
            }}
          />
          <ShareExample
            note={draftedFrom}
            original={originalDraft || stored}
            final={stored}
            workflow={workflowId}
            channel={channel}
            language={shop.language ?? "english"}
            facts={facts}
            source={source === "live" ? "live" : "template"}
            today={localDay()}
          />
          {keptMasked > 0 ? (
            <p className="mt-2 text-sm text-muted">
              {keptMasked} private-looking {keptMasked === 1 ? "detail was" : "details were"} masked in the saved example.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function tradeLabel(trade: TradeId): string {
  return byId(TRADES, trade).label;
}

function CopyBlock({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper">
      <div className="flex justify-end border-b border-line px-3 py-2">
        <button type="button" onClick={() => void onCopy()} className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink hover:bg-ember-soft">
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label="Text you can copy"
        className="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-ink"
      >
        {text}
      </pre>
      <span className="sr-only">{id}</span>
    </div>
  );
}

function weekAsText(plan: ReturnType<typeof buildPlan>, prompt: string, shopName: string): string {
  const p = plan.primary;
  const rule = "=".repeat(48);
  return [
    `${shopName.trim() || "Our shop"}: this week's AI job`,
    rule,
    p.title,
    p.dek,
    "",
    `Planning range: ${formatHourSpan(p.lowMinutes, p.highMinutes)} ${hourUnit(p.highMinutes) || ""}`.trim() + " back per week, after checking time.",
    "",
    "THE RECIPE",
    ...p.steps.map((step, i) => `${i + 1}. ${step.title}\n   ${step.body}`),
    "",
    "BEFORE CLOSE",
    ...p.monday.map((item) => `[ ] ${item}`),
    "",
    "THE PROMPT",
    prompt,
    "",
    "HOUSE RULES",
    plan.rules,
    "",
    "WHAT TO WRITE DOWN",
    p.measure,
  ].join("\n");
}

function downloadText(text: string, shopName: string) {
  const slug = (shopName.trim() || "kindling-week").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug || "kindling-week"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SaveBanner() {
  const user = useCloud((state) => state.user);
  const status = useCloud((state) => state.status);
  const workspace = useCloud((state) => state.workspace);
  const teams = useCloud((state) => state.teams);
  const team = workspace.kind === "team" ? teams.find((item) => item.id === workspace.id) : undefined;
  const [hidden, setHidden] = useState(false);
  if (!CLOUD_ENABLED || hidden) return null;
  if (user) {
    return (
      <p className="mt-6 text-sm text-muted print:hidden" role="status">
        {team ? `Shared with ${team.name}, ${team.members.length} ${team.members.length === 1 ? "person" : "people"}. ` : ""}
        {status === "saving" ? "Saving…" : status === "error" ? "Could not save just now. We will retry." : team ? "Saved for the whole crew." : "Saved to your account."}
      </p>
    );
  }
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 print:hidden">
      <p className="max-w-md text-base text-ink">Keep this week and your logged minutes on every device you use.</p>
      <div className="flex gap-2">
        <Link to="/account" className={primaryClass}>
          Save with email
        </Link>
        <button type="button" className={secondaryClass} onClick={() => setHidden(true)}>
          Not now
        </button>
      </div>
    </div>
  );
}
