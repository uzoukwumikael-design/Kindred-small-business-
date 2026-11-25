import { useEffect, useState } from "react";
import { serviceInfo } from "@/lib/kindling/account-server";
import { primaryClass } from "@/components/kindling/shell";

const KEY = "kindling-ai-consent-v1";

export type AiConsent = {
  /** True when a live outside AI service is connected, so a note would leave this site. */
  needed: boolean;
  given: boolean;
  providers: string[];
  give: () => void;
  withdraw: () => void;
};

/**
 * One-time, explicit agreement before notes are sent to an outside AI service. Kept in this browser, and
 * the person can withdraw it from the Privacy page. With no live AI connected nothing leaves the site,
 * so nothing needs agreeing to.
 */
export function useAiConsent(): AiConsent {
  const [providers, setProviders] = useState<string[]>([]);
  const [given, setGiven] = useState(false);

  useEffect(() => {
    try {
      setGiven(Boolean(localStorage.getItem(KEY)));
    } catch {
      setGiven(false);
    }
    let alive = true;
    serviceInfo()
      .then((info) => {
        if (alive) setProviders(info.ai);
      })
      .catch(() => {
        if (alive) setProviders([]);
      });
    const onStorage = () => {
      try {
        setGiven(Boolean(localStorage.getItem(KEY)));
      } catch {
        setGiven(false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return {
    needed: providers.length > 0,
    given,
    providers,
    give: () => {
      try {
        localStorage.setItem(KEY, new Date().toISOString());
      } catch {
        // without storage the person will simply be asked again next time
      }
      setGiven(true);
    },
    withdraw: () => {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // nothing to remove
      }
      setGiven(false);
    },
  };
}

export function AiConsentNotice({ consent }: { consent: AiConsent }) {
  if (!consent.needed || consent.given) return null;
  return (
    <div className="mt-4 rounded-xl border border-ember bg-ember-soft p-4" role="region" aria-label="Before your note is sent">
      <p className="text-base leading-relaxed text-ink">
        To write a draft, your note is sent to {consent.providers.join(" or ")}, an outside company that may process it
        outside Nigeria. We first replace card numbers, ID numbers, emails and phone numbers with placeholders. Nothing
        is ever sent to a customer for you. You can change your mind any time on the Privacy page.
      </p>
      <button type="button" className={`${primaryClass} mt-3`} onClick={consent.give}>
        I agree, send my notes for drafting
      </button>
    </div>
  );
}
