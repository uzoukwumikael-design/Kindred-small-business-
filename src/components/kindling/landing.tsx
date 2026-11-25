import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock3, ShieldCheck, ScrollText } from "lucide-react";
import { SOURCES, EXAMPLE_INTAKE, EXAMPLE_SHOP } from "@/lib/kindling/catalog";
import { buildPlan, monthDollars } from "@/lib/kindling/engine";
import { formatHourSpan, formatMoney, hourUnit } from "@/lib/kindling/format";
import { ensureHydrated, useKindling } from "@/lib/kindling/store";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";
import { FaqList } from "@/components/kindling/faq";
import { QuickDraft } from "@/components/kindling/quick-draft";
import { WaitlistForm } from "@/components/kindling/waitlist-form";

const example = buildPlan(EXAMPLE_INTAKE, EXAMPLE_SHOP);

const POINTS = [
  {
    title: "It proves it saves time",
    body: "Log your minutes for a couple of weeks and get a plain keep-or-drop answer, in your own numbers.",
  },
  {
    title: "Checked before it sends",
    body: "Every unknown fact stays a bracket, and the send button is locked until each one is fixed.",
  },
  {
    title: "It works where you already chat",
    body: "WhatsApp, text, email or DMs, with whichever AI the site uses. You are not tied to one app.",
  },
  {
    title: "It teaches as you go",
    body: "Three short lessons on what to hand over, what to check and how to write a note it can use.",
  },
];

const SOLO = [
  {
    who: "One-person braiding studio",
    note: "tola here, can i move my saturday 10am to sunday? i can do 2pm",
    draft: "Hi Tola, I can look at Sunday for you. [CHECK: is 2pm on Sunday free in the book?]\nIf it is, I will confirm it here today.",
    after: "The bracket is the point. Only you know whether Sunday at 2 is free, so the draft will not pretend to.",
  },
  {
    who: "WhatsApp fabric seller",
    note: "is the blue ankara still available? how much for 3 yards",
    draft: "Hi, thanks for asking. [CHECK: is the blue Ankara still in stock?]\nIf it is, 3 yards is [CHECK: price from your list]. I can hold it for you until [CHECK: day].",
    after: "No price was in the note, so none is invented. A wrong price or a promise you cannot keep costs more trust than a slower reply.",
  },
  {
    who: "Market stall",
    note: "post for saturday. sourdough is back, last week 3 flavours sold out by 10",
    draft: "Saturday at the stall: the sourdough is back. Last week all three flavours were gone by 10, so come early.\n[CHECK: opening hours and where to find you]",
    after: "It used only what you gave it. The hours are missing from your note, so it asks instead of guessing.",
  },
];

const FACTS = [
  {
    title: "Most owners already use AI",
    body: "Homebase’s 2026 survey of 750 small business owners found 74% using or piloting AI, up from 64% a year earlier. The hard part now is deciding which one job is the official one, and that is the part Kindling picks for you.",
  },
  {
    title: "The smallest shops are behind",
    body: "In the same survey, 54% of businesses under $500,000 in revenue used AI, against 81% of those at $5 million or more. What is missing is an afternoon and a starting point, not an engineer.",
  },
  {
    title: "Boring jobs pay first",
    body: "Owners using AI for both scheduling and payroll estimated they saved 7.7 hours and $343 a month. That is self-reported, from a software company’s survey, so treat it as a direction. Replies, invoices and posts follow the same shape: one narrow task, a person still checking.",
  },
];

export function Landing() {
  const navigate = useNavigate();

  async function openExample() {
    await ensureHydrated();
    useKindling.getState().loadExample();
    await navigate({ to: "/studio" });
  }

  const hours = formatHourSpan(example.primary.lowMinutes, example.primary.highMinutes);
  const unit = hourUnit(example.primary.highMinutes);

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-end gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-7">
          <p className="text-sm font-medium text-ember">For shops, studios, and trades</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl font-medium leading-none text-ink sm:text-6xl">
            One AI job for the shop. This week.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink">
            Most small businesses have already opened a chatbot. Almost none have agreed how the shop uses
            it. Kindling picks the workflow that matches the hour you want back, then hands you the recipe,
            the prompt, and a one-page rule.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/bench" className={primaryClass}>
              Build my week
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <button type="button" className={secondaryClass} onClick={() => void openExample()}>
              See a cafe’s week
            </button>
          </div>
          <p className="mt-4 text-sm text-muted">Five questions. Stays in this browser. No new software bill.</p>
        </div>

        <button
          type="button"
          onClick={() => void openExample()}
          className="rounded-xl border border-line bg-surface p-6 text-left transition-colors hover:border-ink lg:col-span-5"
        >
          <p className="text-sm font-medium text-ember">A worked week · North & Rye</p>
          <p className="mt-3 font-display text-3xl font-medium leading-tight text-ink">{example.primary.title}</p>
          <p className="mt-2 text-base text-muted">{example.primary.dek}</p>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
            <div>
              <dt className="text-sm text-muted">Back / week</dt>
              <dd className="mt-1 font-display text-2xl text-ember tabular-nums">
                {hours}
                {unit ? <span className="ml-1 font-sans text-sm text-muted">{unit}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">At $35/hr</dt>
              <dd className="mt-1 font-display text-2xl text-ink tabular-nums">
                {formatMoney(monthDollars(example.primary.minutes, 35))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">New tools</dt>
              <dd className="mt-1 font-display text-2xl text-ink">$0</dd>
            </div>
          </dl>
          <p className="mt-5 text-sm font-medium text-ink">Open this week</p>
        </button>
      </section>

      <QuickDraft />

      <section className="border-t border-line" aria-labelledby="solo-heading">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <h2 id="solo-heading" className="font-display text-3xl font-medium text-ink">
            Even if it is just you and a chair.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            You do not need a team or a system. Tools like this can feel built for bigger businesses, so here is what one
            task looks like for a one-person shop. The tool writes a first draft and marks what only you can confirm.
            You fix the brackets and send it.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {SOLO.map((example) => (
              <article key={example.who} className="rounded-xl border border-line bg-surface p-5">
                <p className="text-sm font-medium text-ember">{example.who}</p>
                <p className="mt-3 text-sm font-medium text-muted">What came in</p>
                <p className="mt-1 text-base text-ink">{example.note}</p>
                <p className="mt-4 text-sm font-medium text-muted">The first draft</p>
                <p className="mt-1 whitespace-pre-line rounded-lg bg-paper p-3 text-base leading-relaxed text-ink">
                  {example.draft}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{example.after}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="checked-heading">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <h2 id="checked-heading" className="font-display text-3xl font-medium text-ink">
            Nothing goes out until the brackets are gone.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Customers are careful about who they trust online. A wrong price or a promise you cannot keep costs more than
            a slow reply. So every draft keeps a bracket wherever the tool did not know a fact, and the send button stays
            locked until you have fixed each one.
          </p>
          <ol className="mt-8 grid gap-6 lg:grid-cols-3">
            <li className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-medium text-ember">1. The draft marks what it does not know</p>
              <p className="mt-3 rounded-lg bg-paper p-3 text-base leading-relaxed text-ink">
                Sunday works. [CHECK: is 2pm free?]
              </p>
            </li>
            <li className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-medium text-ember">2. You put in the real fact</p>
              <p className="mt-3 rounded-lg bg-paper p-3 text-base leading-relaxed text-ink">Sunday works. 2pm is free.</p>
            </li>
            <li className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-medium text-ember">3. Only then can you send it</p>
              <p className="mt-3 flex flex-wrap gap-2" aria-hidden="true">
                <span className="inline-flex h-11 items-center rounded-lg bg-line px-4 text-sm font-medium text-ink">
                  Open in WhatsApp (locked)
                </span>
                <span className="inline-flex h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-on-ink">
                  Open in WhatsApp
                </span>
              </p>
            </li>
          </ol>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
            It opens WhatsApp, your text app or your email with the message ready. You press send. Kindling never sends
            anything for you.
          </p>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="start-heading">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <h2 id="start-heading" className="font-display text-3xl font-medium text-ink">
            Start here, then automate.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Plenty of tools will answer your customers for you. Before you let any of them, it helps to know which one
            job is worth handing over, and whether it really saves time. That is what this is for.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((point) => (
              <article key={point.title} className="rounded-xl border border-line bg-surface p-5">
                <h3 className="font-display text-xl font-medium text-ink">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{point.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
            If you later want something that replies while you sleep, you will choose it knowing your own numbers. If you
            would rather keep a person in the loop, you already have a way to work.{" "}
            <Link to="/pricing" className="font-medium text-ember underline underline-offset-2">
              See pricing
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-3">
          {FACTS.map((fact) => (
            <article key={fact.title}>
              <h2 className="font-display text-2xl font-medium text-ink">{fact.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{fact.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <h2 className="font-display text-3xl font-medium text-ink">How a week gets built</h2>
          <ol className="mt-8 grid gap-6 lg:grid-cols-3">
            {[
              {
                n: "01",
                title: "Name the hour",
                body: "Trade, crew size, the task eating the week, how AI shows up today, and the worry that would make you stop.",
              },
              {
                n: "02",
                title: "Get one recipe",
                body: "Not a stack. A four-step way of working, a prompt in your voice, and two later jobs that stay in the queue.",
              },
              {
                n: "03",
                title: "Run it before close",
                body: "One real example from this week. A person checks every name, time, and price. Then you write down the minutes.",
              },
            ].map((step) => (
              <li key={step.n} className="border-t border-line pt-5">
                <p className="font-display text-2xl text-ember">{step.n}</p>
                <h3 className="mt-3 font-display text-2xl font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-3xl font-medium text-ink">What you leave with</h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              Enough to do the job on Monday. Not a strategy deck, and not another login.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3 lg:col-span-8">
            {[
              { icon: ScrollText, title: "The recipe", body: "Four steps and a Monday list, written for the trade you actually run." },
              { icon: Clock3, title: "The prompt", body: "Ready to paste. It refuses to invent prices, times, or promises." },
              { icon: ShieldCheck, title: "The house rule", body: "One page for the group chat: what is allowed, what is never pasted, who sends." },
            ].map((item) => (
              <li key={item.title} className="rounded-xl border border-line bg-surface p-5">
                <item.icon className="size-5 text-ember" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="mt-4 font-display text-xl font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
          <h2 id="faq-heading" className="font-display text-3xl font-medium text-ink">
            Questions people ask first.
          </h2>
          <FaqList />
          <p className="mt-6 text-base text-muted">
            More help, and a way to reach us, on the{" "}
            <Link to="/help" className="font-medium text-ember underline underline-offset-2">
              help page
            </Link>
            .
          </p>
        </div>
      </section>

      <WaitlistForm />

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <details className="group">
            <summary className="font-display text-2xl font-medium text-ink">Where this shape comes from</summary>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {SOURCES.map((source) => (
                <article key={source.title}>
                  <h3 className="text-base font-medium text-ink">{source.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{source.detail}</p>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-block text-sm font-medium text-ember underline underline-offset-2"
                    >
                      Read the source
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </details>
          <p className="mt-10 text-sm text-muted">
            Hour ranges inside Kindling are our own planning estimates, net of the time you spend checking drafts.
            They are not a promise. Log your real minutes in the app to replace them.
          </p>
        </div>
      </section>
    </main>
  );
}
