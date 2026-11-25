import { Link } from "@tanstack/react-router";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

export function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-sm font-medium text-ember">404</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">That page is not here.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        The address may have been typed wrong, or the page may have moved. Nothing you saved has been lost.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className={primaryClass}>
          Back to the front page
        </Link>
        <Link to="/studio" className={secondaryClass}>
          My week
        </Link>
        <Link to="/help" className={secondaryClass}>
          Help
        </Link>
      </div>
    </main>
  );
}
