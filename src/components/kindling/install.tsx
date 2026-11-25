import { useEffect, useState } from "react";
import { track } from "@/lib/kindling/events";
import { secondaryClass } from "@/components/kindling/shell";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Installing Kindling to the phone's home screen is what lets it appear in the Share menu of other apps
 * (Android, Chrome). Phones that cannot install it simply see the plain instructions.
 */
export function InstallCard() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed) return null;
  if (installed) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Installed. In other apps, select a message, tap Share and choose Kindling to bring it straight in.
      </p>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4 print:hidden">
      <p className="text-sm font-medium text-ink">Skip the copy and paste</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        On an Android phone, install Kindling, then select a customer's message in another app, tap Share and pick
        Kindling. It opens here with the text filled in. This works only where the app offers Share, and not on iPhones.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {event ? (
          <button
            type="button"
            className={secondaryClass}
            onClick={() => {
              void event.prompt().then(() => {
                void event.userChoice.then((choice) => {
                  if (choice.outcome === "accepted") track("install_accepted");
                });
                setEvent(null);
              });
            }}
          >
            Install Kindling
          </button>
        ) : (
          <span className="text-sm text-muted">In Chrome on Android, open the menu and choose Install app.</span>
        )}
        <button type="button" className="h-11 px-3 text-sm text-muted underline underline-offset-2" onClick={() => setDismissed(true)}>
          Hide this
        </button>
      </div>
    </div>
  );
}
