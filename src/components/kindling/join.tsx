import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CLOUD_ENABLED, joinTeam, rememberPendingJoin, useCloud } from "@/lib/kindling/cloud";
import { primaryClass } from "@/components/kindling/shell";

export function Join() {
  const search = useSearch({ strict: false }) as { code?: string };
  const code = (search.code ?? "").trim();
  const user = useCloud((state) => state.user);
  const syncing = useCloud((state) => state.syncing);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  // Keep the code so it survives a sign-in email link opened in another tab.
  useEffect(() => {
    if (code && !user) rememberPendingJoin(code);
  }, [code, user]);

  async function join() {
    setWorking(true);
    setError("");
    const result = await joinTeam(code);
    setWorking(false);
    if (result.ok) {
      useCloud.setState({ notice: `You joined ${result.name}. This is the crew's shared week.` });
      void navigate({ to: "/studio" });
    } else {
      setError(result.error);
    }
  }

  if (!CLOUD_ENABLED) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 sm:px-8">
        <h1 className="font-display text-4xl font-medium text-ink">Crews are not switched on here.</h1>
        <p className="mt-4 text-base text-muted">Ask whoever sent you this link to turn on accounts first.</p>
      </main>
    );
  }
  if (!code) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 sm:px-8">
        <h1 className="font-display text-4xl font-medium text-ink">This invite link is incomplete.</h1>
        <p className="mt-4 text-base text-muted">Ask for a fresh link and open it again.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Crew invite</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        You have been invited to share a week.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Everyone in a crew works from the same recipe and prompt, and logs their own minutes. Your own week stays safe
        and you can switch back any time.
      </p>
      {user ? (
        <div className="mt-8">
          <button type="button" className={primaryClass} disabled={working || syncing} onClick={() => void join()}>
            {working ? "Joining…" : "Join this crew"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-ember" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-base text-ink">Sign in or make an account, and you will be added automatically.</p>
          <Link to="/account" className={`${primaryClass} mt-4`}>
            Sign in to join
          </Link>
        </div>
      )}
    </main>
  );
}
