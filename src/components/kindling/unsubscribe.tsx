import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { unsubscribeWeekly } from "@/lib/kindling/account-server";
import { primaryClass } from "@/components/kindling/shell";

export function Unsubscribe() {
  const search = useSearch({ strict: false }) as { u?: string; t?: string };
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");

  async function stop() {
    setState("working");
    try {
      const result = await unsubscribeWeekly({ data: { u: search.u ?? "", t: search.t ?? "" } });
      setState(result.ok ? "done" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-medium text-ember">Weekly email</p>
      {state === "done" ? (
        <>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">It is switched off.</h1>
          <p className="mt-4 text-base leading-relaxed text-muted" role="status">
            You will not get the weekly email again. You can turn it back on any time from your account.
          </p>
          <Link to="/" className={`${primaryClass} mt-8`}>
            Back to Kindling
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">Stop the weekly email?</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            One click and it stops. Your week and your account are not touched.
          </p>
          <button type="button" className={`${primaryClass} mt-8`} disabled={state === "working" || !search.u || !search.t} onClick={() => void stop()}>
            {state === "working" ? "One moment…" : "Yes, stop the emails"}
          </button>
          {state === "failed" || !search.u || !search.t ? (
            <p className="mt-4 text-sm leading-relaxed text-ember" role="alert">
              This link is not valid, or has been cut short. Open the latest weekly email and use the link at the bottom,
              or turn it off in your account.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
