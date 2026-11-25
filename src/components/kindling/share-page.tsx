import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { composeSharedNote } from "@/lib/kindling/facts";
import { stashSharedNote } from "@/lib/kindling/share-in";
import { ensureHydrated, useKindling } from "@/lib/kindling/store";

/** Where the phone's Share menu lands. It keeps the text, then opens the studio with it ready to draft. */
export function SharePage() {
  const search = useSearch({ strict: false }) as { title?: string; text?: string; url?: string };
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void ensureHydrated().then(() => {
      if (!alive) return;
      const note = composeSharedNote(search);
      if (note) stashSharedNote(note);
      const hasWeek = useKindling.getState().intake !== null;
      void navigate({ to: hasWeek ? "/studio" : "/bench", replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, search]);

  return (
    <main className="mx-auto max-w-xl px-5 py-16 sm:px-8" aria-busy="true">
      <p className="text-base text-muted">Opening your shared message…</p>
    </main>
  );
}
