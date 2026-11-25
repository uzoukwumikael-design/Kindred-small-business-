import { Link, useNavigate } from "@tanstack/react-router";
import { track } from "@/lib/kindling/events";
import { useEffect, useState } from "react";
import { deleteMyAccount, sendTestWeekly, serviceInfo, type ServiceInfo } from "@/lib/kindling/account-server";
import {
  CLOUD_ENABLED,
  accessToken,
  afterAccountDeleted,
  loadPrefs,
  savePrefs,
  GOOGLE_ENABLED,
  signInGoogle,
  deleteCloudData,
  sendMagicLink,
  signInPassword,
  signOut,
  signUpPassword,
  useCloud,
  type AuthResult,
} from "@/lib/kindling/cloud";
import { CrewPanel } from "@/components/kindling/crew";
import { TURNSTILE_ENABLED, useTurnstile } from "@/components/kindling/turnstile";
import { TrainingConsent } from "@/components/kindling/training-ui";
import { downloadMyData } from "@/lib/kindling/export";
import { useKindling } from "@/lib/kindling/store";
import { fieldClass, primaryClass, secondaryClass } from "@/components/kindling/shell";

type Mode = "link" | "signin" | "signup";

export function Account() {
  const user = useCloud((state) => state.user);
  const status = useCloud((state) => state.status);
  const syncing = useCloud((state) => state.syncing);
  const message = useCloud((state) => state.message);
  const hasPlan = useKindling((state) => state.intake !== null);
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const captcha = useTurnstile();
  const [info, setInfo] = useState<ServiceInfo | null>(null);

  useEffect(() => {
    let alive = true;
    serviceInfo()
      .then((value) => {
        if (alive) setInfo(value);
      })
      .catch(() => {
        if (alive) setInfo(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!CLOUD_ENABLED) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-sm font-medium text-ember">Accounts are off</p>
        <h1 className="mt-3 font-display text-4xl font-medium text-ink sm:text-5xl">Your week stays on this device.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Saving across devices is not switched on for this site yet. Everything still works, and nothing leaves your
          browser.
        </p>
        <Link to="/bench" className={`${primaryClass} mt-8`}>
          Build my week
        </Link>
      </main>
    );
  }

  async function run(action: () => Promise<AuthResult>, after?: () => void) {
    setBusy(true);
    setError("");
    setNote("");
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.note) setNote(result.note);
    after?.();
  }

  if (user) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-sm font-medium text-ember">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">{user.email}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted" role="status">
          {syncing
            ? "Loading your saved week…"
            : status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved to your account. Sign in on any device to pick it up."
                : status === "error"
                  ? message || "Could not save just now."
                  : hasPlan
                    ? "Signed in. Your week saves as you change it."
                    : "Signed in. Build a week and it saves here."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={hasPlan ? "/studio" : "/bench"} className={primaryClass}>
            {hasPlan ? "Back to my week" : "Build my week"}
          </Link>
          <button type="button" className={secondaryClass} onClick={() => void signOut(false).then(() => navigate({ to: "/" }))}>
            Sign out
          </button>
          <button
            type="button"
            className={secondaryClass}
            onClick={() => void signOut(true).then(() => navigate({ to: "/" }))}
          >
            Sign out and clear this device
          </button>
        </div>

        <CrewPanel />

        {info?.weeklyEmail ? <WeeklyEmail provider={info.emailProvider} /> : null}

        <TrainingConsent />

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="font-display text-2xl font-medium text-ink">Your data</h2>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
            We keep one thing for you: the week you built, your shop details, your checklist ticks and your logged
            minutes. Nothing else, and only you can read it.
          </p>
          <button type="button" className={`${secondaryClass} mt-4 mr-3`} onClick={downloadMyData}>
            Download my data
          </button>
          {confirmDelete ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryClass}
                disabled={busy}
                onClick={() => void run(() => deleteCloudData(), () => setConfirmDelete(false))}
              >
                Yes, delete my saved copy
              </button>
              <button type="button" className={secondaryClass} onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className={`${secondaryClass} mt-4`} onClick={() => setConfirmDelete(true)}>
              Delete my saved copy
            </button>
          )}
          {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
          {note ? <p className="mt-3 text-sm text-ink">{note}</p> : null}
          {info?.accountDelete ? (
            <DeleteAccount
              onDeleted={() => {
                void afterAccountDeleted().then(() => navigate({ to: "/" }));
              }}
            />
          ) : null}
        </section>
      </main>
    );
  }

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && (mode === "link" || password.length >= 8);

  function submit() {
    if (!agreed) {
      setError("Tick the box to say you are 18 or over and have read how your data is handled.");
      return;
    }
    if (!valid) {
      setError(mode === "link" ? "Enter an email address we can send the link to." : "Enter your email and a password of at least 8 characters.");
      return;
    }
    if (TURNSTILE_ENABLED && !captcha.token) {
      setError("Wait for the security check to finish, then try again.");
      return;
    }
    const token = captcha.token || undefined;
    const after = () => {
      captcha.reset();
    };
    if (mode === "link") void run(() => sendMagicLink(email, token), after);
    else if (mode === "signin")
      void run(
        () => signInPassword(email, password, token),
        () => void navigate({ to: hasPlan ? "/studio" : "/bench" }),
      ).finally(after);
    else
      void run(
        () => signUpPassword(email, password, token),
        () => {
          track("account_created");
          void navigate({ to: hasPlan ? "/studio" : "/bench" });
        },
      ).finally(after);
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Keep your week</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        Pick it up on any phone or laptop.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {hasPlan
          ? "The week you just built will be saved to your account the moment you sign in."
          : "Sign in to bring back a week you built before."}
      </p>

      <label className="mt-8 flex items-start gap-3 text-sm leading-relaxed text-ink">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[#9a3412]"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          I am 18 or over, and I have read{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            how my data is handled
          </Link>{" "}
          and the{" "}
          <Link to="/terms" className="underline underline-offset-2">
            terms
          </Link>
          .
        </span>
      </label>

      {GOOGLE_ENABLED ? (
        <div className="mt-8">
          <button type="button" className={`${secondaryClass} w-full`} disabled={busy} onClick={() => {
              if (!agreed) {
                setError("Tick the box to say you are 18 or over and have read how your data is handled.");
                return;
              }
              void run(() => signInGoogle());
            }}>
            Continue with Google
          </button>
          <p className="mt-4 text-center text-sm text-muted">or use your email</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="How to sign in">
        {(
          [
            ["link", "Email me a link"],
            ["signin", "Password"],
            ["signup", "Create account"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
              setError("");
              setNote("");
            }}
            className={
              "h-11 rounded-lg border px-4 text-sm font-medium " +
              (mode === id ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink hover:border-ink")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            className={`${fieldClass} mt-2`}
            type="email"
            autoComplete="email"
            value={email}
            placeholder="you@yourshop.com"
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </label>
        {mode === "signin" ? (
          <p className="text-sm text-muted">
            <Link to="/reset-password" className="font-medium text-ember underline underline-offset-2">
              Forgot your password?
            </Link>{" "}
            Or{" "}
            <button type="button" className="font-medium text-ember underline underline-offset-2" onClick={() => setMode("link")}>
              email me a sign-in link instead
            </button>
            .
          </p>
        ) : null}
        {mode !== "link" ? (
          <label className="block">
            <span className="text-sm font-medium text-ink">Password</span>
            <input
              className={`${fieldClass} mt-2`}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              placeholder="At least 8 characters"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
            />
          </label>
        ) : null}
        {captcha.widget}
        <button type="button" className={primaryClass} disabled={busy} onClick={submit}>
          {busy ? "One moment…" : mode === "link" ? "Send me the link" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {error ? (
          <p className="text-sm leading-relaxed text-ember" role="alert">
            {error}
          </p>
        ) : null}
        {note ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink" role="status">
            {note}
          </p>
        ) : null}
      </div>
      <p className="mt-8 text-sm leading-relaxed text-muted">
        We store the week you build and nothing else. Never paste card numbers, passwords or private customer details
        into any field. No account is needed to use Kindling on one device.{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          How your data is handled
        </Link>
      </p>
    </main>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function WeeklyEmail({ provider }: { provider: string | null }) {
  const [weekly, setWeekly] = useState(false);
  const [weekday, setWeekday] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void loadPrefs().then((prefs) => {
      if (!alive) return;
      setWeekly(prefs.weekly);
      setWeekday(prefs.weekday);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save(next: { weekly: boolean; weekday: number }) {
    const before = { weekly, weekday };
    setWeekly(next.weekly); // show the change straight away, put it back if saving fails
    setWeekday(next.weekday);
    setBusy(true);
    setMessage("");
    const result = await savePrefs(next);
    setBusy(false);
    if (!result.ok) {
      setWeekly(before.weekly);
      setWeekday(before.weekday);
      setMessage(result.error);
      return false;
    }
    if (next.weekly) track("weekly_email_on");
    setMessage(next.weekly ? `Saved. Your first email comes on ${DAYS[next.weekday]}.` : "Switched off. No more weekly emails.");
    return true;
  }

  async function test() {
    setBusy(true);
    setMessage("");
    const token = await accessToken();
    const result = await sendTestWeekly({ data: { token } });
    setBusy(false);
    setMessage(result.ok ? "Sent. Check your inbox and your spam folder." : (result.error ?? "That did not send."));
  }

  if (!loaded) return null;
  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="font-display text-2xl font-medium text-ink">Weekly email</h2>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
        One short email a week: how many times you ran your job and the minutes you got back. It is off until you turn
        it on, and you can turn it off here or from the link in any email.
      </p>
      <label className="mt-4 flex items-start gap-3 text-base text-ink">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[#9a3412]"
          checked={weekly}
          disabled={busy}
          onChange={(event) => void save({ weekly: event.target.checked, weekday })}
        />
        <span>Yes, email me a weekly summary at the address I signed up with.</span>
      </label>
      {weekly ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium text-ink">Which day</span>
            <select
              className={`${fieldClass} mt-2`}
              value={weekday}
              disabled={busy}
              onChange={(event) => void save({ weekly: true, weekday: Number(event.target.value) })}
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => void test()}>
            Send me one now
          </button>
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Sent in the morning, UTC (about 9am in Nigeria). Your email address is passed to {provider ?? "our email service"}{" "}
        only to deliver it.
      </p>
      {message ? (
        <p className="mt-3 text-sm text-ink" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    const token = await accessToken();
    const result = await deleteMyAccount({ data: { token } });
    setBusy(false);
    if (result.ok) onDeleted();
    else setError(result.error ?? "Could not delete the account.");
  }

  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="font-display text-xl font-medium text-ink">Delete my account</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        This permanently removes your sign-in, your saved week, your preferences and any crew you own, which also
        removes it for its members. It cannot be undone.
      </p>
      {step === "confirm" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={primaryClass} disabled={busy} onClick={() => void remove()}>
            {busy ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button type="button" className={secondaryClass} onClick={() => setStep("idle")}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className={`${secondaryClass} mt-4`} onClick={() => setStep("confirm")}>
          Delete my account
        </button>
      )}
      {error ? (
        <p className="mt-3 text-sm text-ember" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
