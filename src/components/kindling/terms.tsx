import { Link } from "@tanstack/react-router";

const WHO = (import.meta.env.VITE_CONTROLLER_NAME as string | undefined) || "The person or company that runs this site";
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
const LAW = import.meta.env.VITE_GOVERNING_LAW as string | undefined;
const UPDATED = "October 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What Kindling is",
    body: [
      "Kindling helps a small business plan one AI job, write first drafts of messages, and see whether the job saves time. It is a writing aid. It is not a lawyer, an accountant, a doctor or a financial adviser, and nothing it writes is professional advice.",
    ],
  },
  {
    title: "You check and you send",
    body: [
      "Drafts can be wrong. They can leave out facts, get names or numbers wrong, or sound off in a language the tool handles badly. Kindling marks what it does not know with brackets and checks drafts for invented amounts, times and links, but it cannot catch everything.",
      "You are responsible for reading every message and for what you send to your customers. Kindling never sends anything for you.",
    ],
  },
  {
    title: "Using it fairly",
    body: [
      "Do not use Kindling to break the law, to harass or deceive people, or to write messages that pretend to be someone you are not. Do not paste other people's card numbers, passwords or other private details into it. Do not try to break the site, get around its limits, or use it to run large amounts of automated drafting.",
      "We may limit or suspend access if the site is being abused.",
    ],
  },
  {
    title: "Accounts",
    body: [
      "Accounts are for people aged 18 or over. Keep your sign-in secure and tell us if you think someone else has used it. You can delete your account yourself from the account page at any time.",
    ],
  },
  {
    title: "Your content",
    body: [
      "What you write and save stays yours. You let us process it only to run the features you use, as the privacy page describes. We use examples to train our helpers only if you switch that on and share them.",
    ],
  },
  {
    title: "The service as it is",
    body: [
      "Kindling is provided as it is. It may change, have gaps, or be unavailable at times. Some features depend on outside services, such as an AI provider, an email service and a database host, that we do not control. Free use has fair limits.",
      "To the extent the law allows, we are not responsible for losses that come from relying on a draft, from the service being unavailable, or from indirect or consequential damage. Nothing here limits any right you have by law that cannot be limited.",
    ],
  },
  ...(LAW ? [{ title: "Which law applies", body: [`These terms are governed by the law of ${LAW}.`] }] : []),
  {
    title: "Changes",
    body: ["We may update these terms. The date at the top changes when we do. If you keep using Kindling after a change, you accept the new version."],
  },
];

export function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Terms of use</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">The plain version.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        {WHO} runs Kindling. By using it you agree to these terms. Last updated {UPDATED}. How your data is handled is on the{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
      <div className="mt-8 grid gap-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-2xl font-medium text-ink">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      {CONTACT ? (
        <p className="mt-8 text-base text-ink">
          Questions:{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
      ) : null}
      <p className="mt-6 text-sm text-muted">This is a plain-language summary, not legal advice.</p>
    </main>
  );
}
