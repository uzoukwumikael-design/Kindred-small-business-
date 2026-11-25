import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CLOUD_ENABLED, sendPasswordReset, setNewPassword, useCloud } from "@/lib/kindling/cloud";
import { TURNSTILE_ENABLED, useTurnstile } from "@/components/kindling/turnstile";
import { fieldClass, primaryClass } from "@/components/kindling/shell";

/** Both halves of a password reset: asking for the link, and choosing the new password after opening it. */
export function ResetPassword() {
  const user = useCloud((state) => state.user);
  const recovery = useCloud((state) => state.recovery);
  const [hashSaysRecovery, setHashSaysRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const captcha = useTurnstile();

  useEffect(() => {
    setHashSaysRecovery(/type=recovery/.test(window.location.hash));
  }, []);

  if (!CLOUD_ENABLED) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 sm:px-8">
        <h1 className="font-display text-4xl font-medium text-ink">Accounts are not switched on here.</h1>
        <p className="mt-4 text-base text-muted">Your week stays on this device, so there is no password to reset.</p>
      </main>
    );
  }

  const choosing = Boolean(user) && (recovery || hashSaysRecovery);

  async function request() {
    setError("");
    setNote("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you signed up with.");
      return;
    }
    if (TURNSTILE_ENABLED && !captcha.token) {
      setError("Wait for the security check to finish, then try again.");
      return;
    }
    setBusy(true);
    const result = await sendPasswordReset(email, captcha.token || undefined);
    setBusy(false);
    captcha.reset();
    if (result.ok) setNote(result.note ?? "");
    else setError(result.error);
  }

  async function choose() {
    setError("");
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== again) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await setNewPassword(password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-ember">Password</p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">It is changed.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted" role="status">
          You are signed in. Next time, use your new password, or ask for a sign-in link.
        </p>
        <Link to="/studio" className={`${primaryClass} mt-8`}>
          Back to my week
        </Link>
      </main>
    );
  }

  if (choosing) {
    return (
      <main className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-ember">Password</p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">Choose a new password.</h1>
        <div className="mt-8 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">New password</span>
            <input className={`${fieldClass} mt-2`} type="password" autoComplete="new-password" value={password} placeholder="At least 8 characters" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Type it again</span>
            <input
              className={`${fieldClass} mt-2`}
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void choose();
              }}
            />
          </label>
          <button type="button" className={primaryClass} disabled={busy} onClick={() => void choose()}>
            {busy ? "One moment…" : "Change my password"}
          </button>
          {error ? (
            <p className="text-sm leading-relaxed text-ember" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm font-medium text-ember">Password</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">Reset your password.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Enter your email address and we will send a link. If you opened an old link and landed here, ask for a new one: each link works once.
      </p>
      <div className="mt-8 grid gap-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            className={`${fieldClass} mt-2`}
            type="email"
            autoComplete="email"
            value={email}
            placeholder="you@yourshop.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void request();
            }}
          />
        </label>
        {captcha.widget}
        <button type="button" className={primaryClass} disabled={busy} onClick={() => void request()}>
          {busy ? "One moment…" : "Send me a reset link"}
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
      <p className="mt-8 text-sm text-muted">
        Remembered it?{" "}
        <Link to="/account" className="font-medium text-ember underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}
