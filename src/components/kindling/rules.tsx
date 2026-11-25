import { Link, useSearch } from "@tanstack/react-router";
import { Copy, Printer } from "lucide-react";
import { useState } from "react";
import { decodeRules, parseRules } from "@/lib/kindling/share";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

export function RulesPage() {
  const search = useSearch({ strict: false }) as { d?: string };
  const data = decodeRules(search.d);
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-sm font-medium text-ember">Link not readable</p>
        <h1 className="mt-3 font-display text-4xl font-medium text-ink sm:text-5xl">This page needs a full link.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          The link may have been cut short when it was pasted. Ask whoever sent it to copy it again, or build your
          own in five questions.
        </p>
        <Link to="/bench" className={`${primaryClass} mt-8`}>
          Build my week
        </Link>
      </main>
    );
  }

  const parsed = parseRules(data.rules);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">House rules</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        {parsed.title || `How ${data.name || "we"} use AI`}
      </h1>
      {data.job ? <p className="mt-3 text-lg text-ink">This month's one job: {data.job}</p> : null}
      {parsed.intro ? <p className="mt-2 text-base text-muted">{parsed.intro}</p> : null}

      <ol className="mt-8 grid gap-4">
        {parsed.items.map((item, index) => (
          <li key={index} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="font-display text-2xl text-ember">{index + 1}</span>
            <span className="text-base leading-relaxed text-ink">{item}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
        <p className="text-sm text-muted">Read by: ______________________</p>
        <p className="text-sm text-muted">Date: ______________________</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <button type="button" className={primaryClass} onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print or save as PDF
        </button>
        <button type="button" className={secondaryClass} onClick={() => void copyLink()}>
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Link copied" : "Copy this link"}
        </button>
      </div>
      <p className="mt-4 text-sm text-muted print:hidden">
        Made with Kindling. Anyone with this link can read this page. It holds only the rules above.
      </p>
    </main>
  );
}
