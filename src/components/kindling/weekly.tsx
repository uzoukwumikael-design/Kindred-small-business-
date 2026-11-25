import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { localDay, summaryLines, weekStats } from "@/lib/kindling/summary";
import { useKindling } from "@/lib/kindling/store";
import { secondaryClass } from "@/components/kindling/shell";

/** One plain line about the last seven days, built only from minutes the person actually logged. */
export function WeeklySummary() {
  const log = useKindling((state) => state.log);
  const baselines = useKindling((state) => state.baselines);
  const hourly = useKindling((state) => state.shop.hourly);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => weekStats(log, baselines, localDay()), [log, baselines]);

  if (log.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted print:hidden">
        This week: nothing logged yet. Add a run in the Hours tab and a one-line summary appears here.
      </p>
    );
  }

  const { line, trend } = summaryLines(stats, hourly);

  async function copy() {
    try {
      await navigator.clipboard.writeText(line + trend);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 print:hidden">
      <p className="max-w-xl text-base leading-relaxed text-ink" role="status">
        {line}
        {trend}
      </p>
      <button type="button" className={secondaryClass} onClick={() => void copy()}>
        <Copy className="size-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
