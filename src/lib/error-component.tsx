import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { report } from "@/lib/kindling/report";

/** What a visitor sees when a page breaks. It never shows the technical message; that goes to the owner instead. */
export function AppErrorComponent({ error }: ErrorComponentProps) {
  useEffect(() => {
    report(error, "router");
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-5 py-16 sm:px-8">
      <p className="text-sm font-medium text-ember">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">That did not work.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        We have been told about it. Your saved week is safe on this device. Try again, and if it keeps happening, tell us on the help page.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-ink px-5 text-base font-medium text-on-ink hover:bg-ember"
        >
          Try again
        </button>
        <Link to="/" className="inline-flex h-12 items-center justify-center rounded-lg border border-line bg-surface px-5 text-base font-medium text-ink hover:border-ink">
          Back to the front page
        </Link>
      </div>
    </main>
  );
}
