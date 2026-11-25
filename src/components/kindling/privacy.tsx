import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { serviceInfo, type ServiceInfo } from "@/lib/kindling/account-server";
import { CLOUD_ENABLED } from "@/lib/kindling/cloud";
import { TURNSTILE_ENABLED } from "@/components/kindling/turnstile";
import { downloadMyData } from "@/lib/kindling/export";
import { useAiConsent } from "@/components/kindling/ai-consent";
import { secondaryClass } from "@/components/kindling/shell";

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
const WHO = (import.meta.env.VITE_CONTROLLER_NAME as string | undefined) || "The person or company that runs this site";
const ADDRESS = import.meta.env.VITE_CONTROLLER_ADDRESS as string | undefined;
const REGION = import.meta.env.VITE_DATA_REGION as string | undefined;
const UPDATED = "October 2026";

type Row = { purpose: string; data: string; basis: string; who: string };

export function Privacy() {
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const consent = useAiConsent();

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

  const ai = info?.ai ?? [];
  const rows: Row[] = [
    {
      purpose: "Building and keeping your week on one device",
      data: "Your answers, shop details, checklist ticks, logged minutes",
      basis: "None needed from us: it stays in your browser and is never sent to us",
      who: "Nobody",
    },
    {
      purpose: "Writing a draft or sharpening a prompt when you press the button",
      data: "The note you paste, your shop name, what you do, your voice sample, the shop facts you confirmed, and up to three messages you saved as examples",
      basis: "Your consent, asked once before the first draft",
      who: ai.length > 0 ? ai.join(", ") : "No outside AI is connected right now, so drafts are built on our server and go nowhere else",
    },
  ];
  if (CLOUD_ENABLED) {
    rows.push(
      {
        purpose: "Your account and saving your week across devices",
        data: "Your email address, your saved week, your shop facts, the examples you saved, your preferences",
        basis: "Providing the service you asked for",
        who: "Supabase (sign-in and database)",
      },
      {
        purpose: "Sharing a week with a crew you join or start",
        data: "The shared week, logged minutes with your name, your email shown to other members",
        basis: "Providing the service you asked for, and your own choice to join",
        who: "Supabase, and the other members of the crew",
      },
    );
  }
  if (info?.weeklyEmail) {
    rows.push({
      purpose: "The weekly summary email",
      data: "Your email address and the minutes you logged",
      basis: "Your consent, given by ticking the box in your account. You can withdraw it just as easily",
      who: info.emailProvider ?? "Our email service",
    });
  }
  rows.push({
    purpose: "The quick draft box on the front page",
    data: "The one message you paste",
    basis: "Your consent, asked before the first draft when an outside AI is connected",
    who: ai.length > 0 ? ai.join(", ") : "No outside AI is connected right now, so it is drafted on our server and goes nowhere else",
  });
  if (CLOUD_ENABLED) {
    rows.push({
      purpose: "Training the drafting helpers (optional)",
      data: "Only examples you choose to share: the customer message with private details and names masked, the draft, your final reply, the channel and language, which fact types were used, and how much you edited it",
      basis: "Your consent, given by switching it on in your account and again by sharing each example after seeing a preview. Switching it off deletes everything you shared",
      who: "Supabase, and the site owner, who uses the examples to train a small model and improve drafts. Never sold",
    });
  }
  rows.push(
    {
      purpose: "Counting which features get used",
      data: "A tally per day of events such as 'a draft was made'. No account, IP address, cookie or device identifier is stored with it",
      basis: "Our legitimate interest in knowing where people get stuck. Your browser's Do Not Track and Global Privacy Control settings are respected",
      who: CLOUD_ENABLED ? "Supabase" : "Our server",
    },
    {
      purpose: "Finding and fixing errors",
      data: "If a page breaks: the error message, a few lines of technical detail with web addresses and private-looking details removed, and the page path",
      basis: "Our legitimate interest in keeping the site working",
      who: "Our server logs, and an alert channel the site owner may use",
    },
    {
      purpose: "The help page contact form",
      data: "What you write and the reply address you choose to give",
      basis: "Your consent, by sending it",
      who: "The inbox or chat tool the site owner uses",
    },
  );
  if (TURNSTILE_ENABLED) {
    rows.push({
      purpose: "The security check that stops bots",
      data: "Your IP address and signals from your browser, sent to Cloudflare when the check runs",
      basis: "Our legitimate interest in keeping automated abuse out",
      who: "Cloudflare (Turnstile)",
    });
  }
  rows.push(
    {
      purpose: "The update list on the front page",
      data: "Your email address",
      basis: "Your consent, given by ticking the box",
      who: "The list tool the site owner uses",
    },
    {
      purpose: "Keeping the site running and secure",
      data: "Ordinary server logs such as your IP address and the pages requested",
      basis: "Our legitimate interest in a working, safe site",
      who: "Vercel, our host",
    },
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Privacy notice</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        What happens to what you type.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        In recent small business surveys, data privacy and fear of mistakes are the two biggest worries about AI. This
        page says plainly what Kindling does so you can decide for yourself. Last updated {UPDATED}.
      </p>

      <div className="mt-8 grid gap-10">
        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Who is responsible for your data</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            {WHO}
            {ADDRESS ? `, ${ADDRESS}` : ""}. {CONTACT ? "" : "Contact details are shown here once the site owner adds them."}
          </p>
          {CONTACT ? (
            <p className="mt-2 text-base text-ink">
              Questions, requests and complaints:{" "}
              <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">What we use your data for</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Each row says what is used, why, the legal reason, and who handles it.
          </p>
          <ul className="mt-4 grid gap-3">
            {rows.map((row) => (
              <li key={row.purpose} className="rounded-xl border border-line bg-surface p-4 text-base leading-relaxed text-ink">
                <p className="font-medium">{row.purpose}</p>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-ink">Data: </span>
                  {row.data}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium text-ink">Why we may: </span>
                  {row.basis}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium text-ink">Who handles it: </span>
                  {row.who}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-base leading-relaxed text-ink">
            Nothing is ever sent to a customer by Kindling. You read every draft and send it yourself. The app runs no
            ads and no analytics, and it does not sell or rent your data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Masking before an AI sees your note</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            Before any note is sent for drafting, we replace card numbers, ID numbers, account numbers, email addresses,
            phone numbers and anything that looks like a password with placeholders. This catches the obvious ones. It
            cannot catch everything, so please do not paste anything you would not want an outside company to see. Some
            free AI services may use what they receive to improve their products.
          </p>
          {consent.needed ? (
            <p className="mt-3 text-base leading-relaxed text-ink">
              {consent.given
                ? "You have agreed to this on this device."
                : "You have not agreed to this on this device yet, so no note will be sent."}{" "}
              {consent.given ? (
                <button type="button" className="font-medium text-ember underline underline-offset-2" onClick={consent.withdraw}>
                  Withdraw my agreement
                </button>
              ) : null}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Where your data goes</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            The companies named above store and process data on servers that can be outside Nigeria, for example in the
            United States or Europe.{REGION ? ` Account data is stored in ${REGION}.` : ""} We rely on their security
            commitments and on written terms that require them to protect it. If you are not comfortable with that, use
            Kindling without an account and without the AI drafting. Everything else works on your device alone.
          </p>
          {CLOUD_ENABLED ? (
            <p className="mt-3 text-base leading-relaxed text-ink">
              The person who runs this site can see the database with admin tools, so please do not put sensitive
              information into it. If you edit on two devices at once, runs you logged are merged and for anything else
              the most recent edit wins.
            </p>
          ) : null}
        </section>

        {CLOUD_ENABLED ? (
          <section>
            <h2 className="font-display text-2xl font-medium text-ink">If you join a crew</h2>
            <p className="mt-3 text-base leading-relaxed text-ink">
              A crew shares one week. Everyone in it can see and edit that week, see the minutes each person logged with
              their name, and see the email addresses of the other members. Only the person who made the crew can invite
              people, remove them or delete it.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink">
              If you are removed or the crew is deleted, the shared week disappears from your account. A copy you already
              downloaded or copied stays with you, so only invite people you trust. Your own week is never shared unless
              you start a crew from it.
            </p>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Links you share</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            A house rules link contains the rules text inside the link itself. Anyone who has the link can read it, and
            nothing else about you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">How long we keep it</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            Data on your device stays until you clear it or press Start over. Your account and saved week are kept until
            you delete them. When you delete your account they are removed from our database straight away. The
            provider's backups are overwritten on its normal schedule, which is usually within a few weeks. Server logs
            are kept by our host under its own schedule.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Your rights</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            You can ask to see your data, correct it, delete it, restrict or object to how it is used, take it with you,
            and withdraw any consent you gave, as the law allows. Most of this you can do yourself:
          </p>
          <ul className="mt-3 grid gap-2 text-base leading-relaxed text-ink">
            <li>See and take it with you: the download button below, or Download my data in your account.</li>
            <li>Correct it: edit your week, shop details and runs in the app.</li>
            <li>Delete it: Delete my saved copy or Delete my account in your account page.</li>
            <li>Withdraw consent: switch off the weekly email in your account, use the link in any email we send, or withdraw your AI agreement above.</li>
          </ul>
          <p className="mt-3 text-base leading-relaxed text-ink">
            For anything else, write to the address above. If you are unhappy with how we handle your data, you have the
            right to complain to the Nigeria Data Protection Commission, or to the data protection authority where you
            live.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-medium text-ink">Age and security</h2>
          <p className="mt-3 text-base leading-relaxed text-ink">
            Kindling is for business owners and their staff aged 18 or over. If we learn that someone under 18 has an
            account, we will delete it. We use encryption in transit, per-person access rules on the database and signed
            links for unsubscribing. If a breach is likely to put you at risk, we will tell you and the regulator without
            undue delay and within the time the law requires.
          </p>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button type="button" className={secondaryClass} onClick={downloadMyData}>
          <Download className="size-4" aria-hidden="true" />
          Download what is saved on this device
        </button>
        <Link to="/account" className={secondaryClass}>
          Account
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted">
        This is a plain-language notice, not legal advice. We may update it and will change the date at the top when we do.
      </p>
    </main>
  );
}
