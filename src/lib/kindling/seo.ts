/** Page titles, descriptions, canonical addresses and structured data. */

export const SITE: string = ((import.meta.env?.VITE_SITE_URL as string | undefined) ?? "").replace(/\/$/, "");

/** Pages that should appear in search results and in the sitemap. */
export const PUBLIC_PATHS = ["/", "/pricing", "/learn", "/help", "/privacy", "/terms"];

type HeadInput = { title: string; description?: string; path: string; index?: boolean };

/** The head for one page. Private app pages pass index: false and are kept out of search results. */
export function pageHead({ title, description, path, index = true }: HeadInput) {
  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(index ? [] : [{ name: "robots", content: "noindex" }]),
    ],
    links: index && SITE ? [{ rel: "canonical", href: `${SITE}${path === "/" ? "" : path}` }] : [],
  };
}

export type Faq = { question: string; answer: string };

export const FAQ: Faq[] = [
  {
    question: "Does Kindling send messages to my customers?",
    answer:
      "No. It writes a first draft. You read it, fix any bracket, and send it yourself. The send button opens WhatsApp, your text app or your email with the message already filled in, and it stays locked until every bracket is fixed.",
  },
  {
    question: "What if a draft gets a price or a time wrong?",
    answer:
      "Anything the tool does not know becomes a bracket such as [CHECK: price from your list], and it flags amounts, times, links and promises that are not in your note or your saved shop facts. You still read every draft. Nothing is ever sent for you.",
  },
  {
    question: "What does it cost?",
    answer:
      "The useful part is free for one shop. If there is a paid plan it is one flat price, with no charge per message and no contract in the app. The pricing page shows exactly what is on offer.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. Everything works on one device without one. An account lets you open your week on another phone or laptop, share a week with your crew, and get a weekly summary email if you switch it on.",
  },
  {
    question: "Which AI does it use, and is my data safe?",
    answer:
      "It uses whichever AI service the site owner has connected, and the privacy page names it. Before a note is sent, card numbers, ID numbers, emails, phone numbers and names are masked, you agree first, and nothing you type is sold. You can download or delete your data at any time.",
  },
  {
    question: "Can it write in Pidgin, Yoruba, Igbo or Hausa?",
    answer:
      "You can choose any of them, or let it match your customer. AI is weaker in these languages than in English, so every draft in them reminds you to have a speaker read it before it goes out. Without an AI connected, drafts are in English only.",
  },
  {
    question: "Does it work on my phone?",
    answer:
      "Yes. On an Android phone you can also install it and share a customer's message straight into it from another app. That share option does not work on iPhones.",
  },
  {
    question: "How do I delete my data?",
    answer:
      "Everything on your device can be cleared with Start over. If you have an account, the account page lets you download your data, delete your saved copy, or delete the account entirely.",
  },
];

/** Structured data for the home page: the product, the organisation and the questions above. */
export function homeJsonLd(): string {
  const url = SITE || undefined;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Kindling",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      description:
        "Kindling helps a small shop install one AI workflow: a recipe, a prompt, and a house rule, with every message checked by a person before it goes out.",
      ...(url ? { url } : {}),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Kindling",
      ...(url ? { url, logo: `${url}/icons/icon-512.png` } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
  // "<" is escaped so the data can never close its own script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
