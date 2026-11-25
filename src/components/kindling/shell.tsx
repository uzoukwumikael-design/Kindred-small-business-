import { Link } from "@tanstack/react-router";
import { track } from "@/lib/kindling/events";
import { installErrorReporting } from "@/lib/kindling/report";
import { Flame } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { CLOUD_ENABLED, dismissNotice, initCloud, resolveConflict, useCloud } from "@/lib/kindling/cloud";
import { ensureHydrated, useKindling } from "@/lib/kindling/store";

export const primaryClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-base font-medium text-on-ink transition-colors hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-base font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClass =
  "h-12 w-full rounded-lg border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-muted";

export function Mark() {
  return (
    <span className="flex size-9 items-center justify-center rounded-lg bg-ember-soft text-ember" aria-hidden="true">
      <Flame className="size-5" strokeWidth={1.75} />
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const ready = useKindling((state) => state.ready);
  const hasPlan = useKindling((state) => state.intake !== null);

  const user = useCloud((state) => state.user);
  const conflict = useCloud((state) => state.conflict);
  const notice = useCloud((state) => state.notice);

  useEffect(() => {
    void ensureHydrated();
    installErrorReporting();
    track("visit");
    initCloud();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-display text-xl font-medium text-ink">
            <Mark />
            Kindling
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
            <Link
              to="/bench"
              className="inline-flex h-11 items-center rounded-lg px-3 text-ink hover:bg-ember-soft"
            >
              The bench
            </Link>
            {ready && hasPlan ? (
              <Link
                to="/studio"
                className="inline-flex h-11 items-center rounded-lg px-3 text-ink hover:bg-ember-soft"
              >
                Your week
              </Link>
            ) : null}
            <Link to="/learn" className="inline-flex h-11 items-center rounded-lg px-3 text-ink hover:bg-ember-soft">
              Learn
            </Link>
            <Link to="/pricing" className="hidden h-11 items-center rounded-lg px-3 text-ink hover:bg-ember-soft sm:inline-flex">
              Pricing
            </Link>
            {CLOUD_ENABLED ? (
              <Link
                to="/account"
                className="inline-flex h-11 items-center rounded-lg px-3 text-ink hover:bg-ember-soft"
              >
                {user ? "Account" : "Sign in"}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      {notice ? (
        <div className="border-b border-line bg-surface print:hidden" role="status">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <p className="text-base text-ink">{notice}</p>
            <button type="button" className={secondaryClass} onClick={dismissNotice}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
      {conflict ? (
        <div className="border-b border-ember bg-ember-soft print:hidden" role="alert">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-base text-ink">
              Your account already has a saved week, and this device has a different one. Which should we keep?
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryClass} onClick={() => void resolveConflict("account")}>
                Use the account copy
              </button>
              <button type="button" className={primaryClass} onClick={() => void resolveConflict("device")}>
                Keep this device
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {children}
      <footer className="border-t border-line print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted sm:px-8">
          <span>Kindling. One AI job at a time, with a person checking.</span>
          <span className="flex gap-4">
            <Link to="/pricing" className="underline underline-offset-2 hover:text-ink">
              Pricing
            </Link>
            <Link to="/help" className="underline underline-offset-2 hover:text-ink">
              Help
            </Link>
            <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">
              Privacy
            </Link>
            <Link to="/terms" className="underline underline-offset-2 hover:text-ink">
              Terms
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
