import { Link } from "@tanstack/react-router";
import { track } from "@/lib/kindling/events";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

/**
 * The site owner sets the paid plan with environment variables. Nothing is invented here:
 * with none set, the page honestly says everything is free for now.
 *   VITE_PLAN_NAME, VITE_PLAN_PRICE (shown as written, e.g. "$9 a month"), VITE_PLAN_URL (https checkout link),
 *   VITE_PLAN_FEATURES (items separated by |)
 */
const NAME = (import.meta.env.VITE_PLAN_NAME as string | undefined) || "Supporter";
const PRICE_DEFAULT = (import.meta.env.VITE_PLAN_PRICE as string | undefined) || "";
const URL_DEFAULT = (import.meta.env.VITE_PLAN_URL as string | undefined) || "";
// Optional naira price and payment link (for example a Paystack or Selar link). Shown first to visitors in Nigeria.
const PRICE_NGN = (import.meta.env.VITE_PLAN_PRICE_NGN as string | undefined) || "";
const URL_NGN = (import.meta.env.VITE_PLAN_URL_NGN as string | undefined) || "";
const EXTRA = ((import.meta.env.VITE_PLAN_FEATURES as string | undefined) || "")
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 8);

export const FREE_FEATURES = [
  "The five questions and a full plan for the week",
  "The copy-paste prompt, in your shop's voice",
  "AI drafts for WhatsApp, text, email and DMs, with a fair daily limit",
  "Shop facts, so drafts use what you have already checked",
  "A send button that stays locked until every bracket is fixed",
  "The minutes log, weekly summary and a keep-or-drop verdict",
  "The three short lessons on checking drafts",
  "Printable house rules you can share with the crew",
  "Download or delete your data whenever you like",
];

function looksNigerian(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === "Africa/Lagos" || /-NG$/i.test(navigator.language);
  } catch {
    return false;
  }
}

export function Pricing() {
  useEffect(() => {
    track("pricing_view");
  }, []);
  const both = Boolean(PRICE_NGN && PRICE_DEFAULT);
  // Decided after the page loads, so the server and the browser agree on the first render.
  const [currency, setCurrency] = useState<"ngn" | "default">(PRICE_DEFAULT ? "default" : "ngn");
  useEffect(() => {
    if (PRICE_NGN && PRICE_DEFAULT && looksNigerian()) setCurrency("ngn");
  }, []);
  const useNgn = Boolean(PRICE_NGN) && (currency === "ngn" || !PRICE_DEFAULT);
  const PRICE = useNgn ? PRICE_NGN : PRICE_DEFAULT;
  const URL_ = useNgn ? URL_NGN || URL_DEFAULT : URL_DEFAULT || URL_NGN;
  const paid = Boolean(PRICE);
  const checkout = /^https:\/\//i.test(URL_) ? URL_ : "";
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Pricing</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        {paid ? "A free core, and one flat plan." : "Free to use, with nothing to sign."}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Most tools in this space charge per conversation, hide the price behind a call, or tie you to a long contract.
        Here the useful part is free, any paid plan is one flat price, and nothing in the app signs you up for a term.
      </p>

      <div className={"mt-10 grid gap-6 " + (paid ? "lg:grid-cols-2" : "")}>
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-2xl font-medium text-ink">Free</h2>
          <p className="mt-1 font-display text-4xl text-ink">$0</p>
          <p className="mt-1 text-sm text-muted">No card needed. For one shop.</p>
          <ul className="mt-5 grid gap-3">
            {FREE_FEATURES.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed text-ink">
                <Check className="mt-1 size-4 shrink-0 text-ember" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link to="/bench" className={`${primaryClass} mt-6`}>
            Build my week
          </Link>
        </section>

        {paid ? (
          <section className="rounded-xl border border-ember bg-ember-soft p-6">
            <h2 className="font-display text-2xl font-medium text-ink">{NAME}</h2>
            <p className="mt-1 font-display text-4xl text-ink">{PRICE}</p>
            <p className="mt-1 text-sm text-muted">One flat price. Everything in Free, plus:</p>
            {both ? (
              <p className="mt-2 text-sm text-muted">
                Showing {useNgn ? "naira" : "dollars"}.{" "}
                <button
                  type="button"
                  className="font-medium text-ember underline underline-offset-2"
                  onClick={() => setCurrency(useNgn ? "default" : "ngn")}
                >
                  Show {useNgn ? "dollars" : "naira"}
                </button>
              </p>
            ) : null}
            <ul className="mt-5 grid gap-3">
              {(EXTRA.length > 0 ? EXTRA : ["Priority help setting up"]).map((item) => (
                <li key={item} className="flex gap-3 text-base leading-relaxed text-ink">
                  <Check className="mt-1 size-4 shrink-0 text-ember" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {checkout ? (
              <a href={checkout} target="_blank" rel="noopener noreferrer" className={`${primaryClass} mt-6`}>
                Choose {NAME}
              </a>
            ) : (
              <p className="mt-6 text-sm text-muted">Checkout is not switched on yet.</p>
            )}
          </section>
        ) : null}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">What we promise about money</h2>
        <ul className="mt-4 grid gap-3 text-base leading-relaxed text-ink">
          <li>No per-message or per-reply charges. Nothing here counts your conversations.</li>
          <li>No contract in the app. Nothing you tick here commits you to a term.</li>
          <li>The price you see is the price. If it changes, it changes on this page first.</li>
          <li>Your data export and your account deletion are always free. See the privacy page.</li>
        </ul>
        <div className="mt-6">
          <Link to="/privacy" className={secondaryClass}>
            Read how your data is handled
          </Link>
        </div>
      </section>
    </main>
  );
}
