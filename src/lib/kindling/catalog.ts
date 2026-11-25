import { languageRules } from "@/lib/kindling/languages";
import { factsBlock } from "@/lib/kindling/facts";
import { localDay } from "@/lib/kindling/summary";
import { channelRules, usesChannel } from "@/lib/kindling/channels";
import type {
  Choice,
  Intake,
  MaturityId,
  PainId,
  Shop,
  TeamId,
  ToneId,
  TradeId,
  Fact,
  WorryId,
} from "@/lib/kindling/types";

export const TRADES: Choice<TradeId>[] = [
  { id: "cafe", label: "Cafe, restaurant, or food", hint: "Counter, kitchen, catering, a truck" },
  { id: "salon", label: "Salon, barber, or spa", hint: "Chairs, bookings, the products by the desk" },
  { id: "retail", label: "Shop or boutique", hint: "The floor, the stockroom, online orders" },
  { id: "trades", label: "Home services or trades", hint: "Jobs, quotes, the van, callbacks" },
  { id: "clinic", label: "Clinic or wellness studio", hint: "Front desk only, never clinical advice" },
  { id: "professional", label: "Office or professional service", hint: "Clients, proposals, the follow-up pile" },
  { id: "studio", label: "Studio or maker", hint: "Shoots, commissions, classes, the bench" },
  { id: "local", label: "Another local business", hint: "Gym, tutor, inn, daycare admin" },
];

export const TEAMS: Choice<TeamId>[] = [
  { id: "solo", label: "Just me", hint: "I am the whole shift" },
  { id: "crew", label: "2–5 people", hint: "A small crew, one owner in the middle" },
  { id: "shop", label: "6–15 people", hint: "A front of house and a back" },
  { id: "floor", label: "16–40 people", hint: "Big enough that a rule has to be written" },
];

export const PAINS: Choice<PainId>[] = [
  { id: "replies", label: "Answering customers", hint: "Email, DMs, texts, reviews" },
  { id: "schedule", label: "Scheduling and no-shows", hint: "Bookings, confirmations, who is where" },
  { id: "money", label: "Invoices and getting paid", hint: "The awkward follow-up you put off" },
  { id: "marketing", label: "Posts and promotions", hint: "The weekly “we should post something”" },
  { id: "quotes", label: "Quotes and proposals", hint: "Turning a messy visit into a number" },
  { id: "paperwork", label: "Notes and end-of-day admin", hint: "What happened, and what’s tomorrow" },
  { id: "stock", label: "Stock and reorders", hint: "What’s low, what to tell the supplier" },
  { id: "hiring", label: "Hiring", hint: "The job post you keep not finishing" },
  { id: "reviews", label: "Asking for reviews", hint: "The honest ask you keep forgetting to send" },
];

export const MATURITY: Choice<MaturityId>[] = [
  { id: "never", label: "Not in the work", hint: "I haven’t used it on a real task" },
  { id: "dabbling", label: "I’ve tinkered", hint: "I’ve pasted something into a chatbot" },
  { id: "shadow", label: "Unofficial", hint: "A few of us use it, with no shared rule" },
  { id: "one", label: "One real workflow", hint: "We already do one job this way, on purpose" },
];

export const WORRIES: Choice<WorryId>[] = [
  { id: "mistakes", label: "A bad draft reaching a customer", hint: "Wrong price, wrong promise, wrong tone" },
  { id: "privacy", label: "Pasting something I shouldn’t", hint: "Customer details, payments, private notes" },
  { id: "cost", label: "Paying for another tool", hint: "I don’t want a subscription to find out" },
  { id: "staff", label: "The team won’t use it well", hint: "Or they’ll use it five different ways" },
  { id: "time", label: "I don’t have time to learn it", hint: "If this needs a course, it won’t happen" },
];

export const TONES: { id: ToneId; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "plain", label: "Plain" },
  { id: "formal", label: "Formal" },
];

export const TONE_LINE: Record<ToneId, string> = {
  warm: "Warm and brief, like someone who already knows the regulars. No slogans.",
  plain: "Plain and direct. Short sentences. No slogans. No exclamation points.",
  formal: "Polite and precise. No slang. No emoji. No filler.",
};

const PLACE: Record<TradeId, string> = {
  cafe: "a cafe, restaurant, or food business",
  salon: "a salon, barber, or spa",
  retail: "a shop",
  trades: "a home-services or trades business",
  clinic: "a clinic or wellness studio, front desk only",
  professional: "a professional-services office",
  studio: "a studio or maker business",
  local: "a local business",
};

export type Workflow = {
  id: string;
  pain: PainId;
  title: string;
  dek: string;
  fit: string;
  setupMinutes: number;
  sensitivity: "low" | "medium";
  minutesPerWeek: Record<TeamId, number>;
  cadence: string;
  measure: string;
  outputShape: string;
  steps: { title: string; body: string }[];
  monday: string[];
};

export const WORKFLOWS: Workflow[] = [
  {
    id: "reply-desk",
    pain: "replies",
    title: "The reply desk",
    dek: "Five real messages. One voice. A person still hits send.",
    fit: "Replies are the highest-volume writing most shops do, and the easiest place for a wrong promise to escape. A draft-and-check habit catches that without a new inbox.",
    setupMinutes: 20,
    sensitivity: "medium",
    minutesPerWeek: { solo: 120, crew: 180, shop: 240, floor: 280 },
    cadence: "a typical week",
    measure: "Minutes from opening a customer message to hitting send, for ten working days.",
    outputShape: "Only the reply, ready to paste. No advice before it.",
    steps: [
      {
        title: "Pull five real messages",
        body: "From this week. Strip card numbers, passwords, and anything on the never-list before a single word gets pasted.",
      },
      {
        title: "Run one, then read it aloud",
        body: "If it doesn’t sound like the person at your counter, fix the draft instead of ‘teaching the model’ for an hour. Change one line in the prompt and move on.",
      },
      {
        title: "You send it",
        body: "Do the rest of today’s messages the same way. Write down the minutes when the batch is done.",
      },
      {
        title: "Leave it where tomorrow’s person stands",
        body: "The prompt and the house rules go by the till, the front desk, or the top of the group chat. One place. Not a new app.",
      },
    ],
    monday: [
      "Pick five real customer messages from last week and delete anything that should never be pasted.",
      "Run one through the prompt. Fix the draft until it sounds like you.",
      "Answer the rest of today’s messages the same way, and write down the minutes.",
      "Pin the house rules where the person who answers customers will see them.",
    ],
  },
  {
    id: "confirm",
    pain: "schedule",
    title: "Confirm before you forget",
    dek: "The book and the text say the same time. The tool doesn’t invent your policy.",
    fit: "Scheduling ping-pong is where small teams lose evenings. The win is a confirmation that matches the book, not a bot that books on its own.",
    setupMinutes: 20,
    sensitivity: "medium",
    minutesPerWeek: { solo: 60, crew: 120, shop: 180, floor: 200 },
    cadence: "a typical week",
    measure: "Minutes spent writing confirmations, reminders, and no-show notes.",
    outputShape: "Only the message to the customer, ready to paste.",
    steps: [
      {
        title: "Take one booking you already confirmed",
        body: "What they asked, and what you actually put in the book. The book wins if they disagree.",
      },
      {
        title: "Draft the text you wish you’d sent",
        body: "Check the name, the service, and the time against the book. Not against the draft.",
      },
      {
        title: "Write your real policy once",
        body: "How long you hold a chair, a table, or an arrival window. Put that sentence in the checked-facts box so it stops being invented.",
      },
      {
        title: "Same message, every channel",
        body: "Text, DM, or email, one voice. Send it yourself. A booking bot is a later project, and most shops don’t need one.",
      },
    ],
    monday: [
      "Copy one real booking: name, service, and the time in the book.",
      "Write your hold policy in one sentence (how long you wait before releasing it).",
      "Draft today’s confirmations and check each time against the book before sending.",
      "Save that policy sentence where the closer will find it tomorrow.",
    ],
  },
  {
    id: "review-ask",
    pain: "reviews",
    title: "The review ask",
    dek: "A short, honest request for a review, with your real review link, sent while the customer is still pleased.",
    fit: "Reviews are what a stranger reads before they trust you, and most happy customers never leave one because nobody asked. A short ask at the right moment, in your voice, fixes that without a review-software subscription.",
    setupMinutes: 10,
    sensitivity: "low",
    minutesPerWeek: { solo: 20, crew: 35, shop: 45, floor: 60 },
    cadence: "a typical week",
    measure: "Minutes to send a review ask, and how many reviews arrive in two weeks.",
    outputShape:
      "Only the message, ready to paste. Keep every [CHECK] marker. Ask for an honest review, never a good one, and offer nothing in return.",
    steps: [
      {
        title: "Put your review link in the facts tab",
        body: "Open your business on Google, copy the link customers use to leave a review, and save it under Review link. Without it, every draft has to leave a bracket.",
      },
      {
        title: "Ask the same day",
        body: "The best moment is just after a good visit or a delivered order. Note the customer's first name and what you did for them.",
      },
      {
        title: "Draft it, check the link, send it yourself",
        body: "One short message. Click the link yourself before it goes out, because a broken link wastes the ask.",
      },
      {
        title: "Count what comes back",
        body: "Write down how many asks you sent and how many reviews arrived in two weeks. That is the number that tells you whether to keep this.",
      },
    ],
    monday: [
      "Save your review link in the facts tab.",
      "List the last five customers who were clearly happy.",
      "Draft and send one ask today. Click the link before sending.",
      "Count reviews in two weeks.",
    ],
  },
  {
    id: "kind-chase",
    pain: "money",
    title: "The kind chase",
    dek: "Overdue money, in your voice, with the amount checked against the invoice.",
    fit: "Getting paid is awkward, so it waits. A single follow-up voice, checked against the invoice, is worth more than accounting software you won’t open.",
    setupMinutes: 15,
    sensitivity: "medium",
    minutesPerWeek: { solo: 40, crew: 70, shop: 90, floor: 100 },
    cadence: "a typical week",
    measure: "Minutes to send a payment follow-up, and whether the amount matched the invoice.",
    outputShape: "Only the follow-up message, ready to paste. Keep every [CHECK] marker.",
    steps: [
      {
        title: "One overdue invoice, not the whole ledger",
        body: "Name, amount, due date, what it was for. No card numbers. No bank login. No spreadsheet export of everyone.",
      },
      {
        title: "Draft it, then look at the invoice",
        body: "If the figure in the draft isn’t the figure on the invoice, the draft is wrong. Fix it with your eyes.",
      },
      {
        title: "Send it the way you already chase money",
        body: "Email or text. Put the next nudge on your calendar. Don’t buy a collections tool this month.",
      },
      {
        title: "One voice for every reminder",
        body: "The second and third notes should sound like the same person, slightly firmer, still accurate.",
      },
    ],
    monday: [
      "Choose one overdue invoice and copy only the name, amount, date, and what it was for.",
      "Draft the note and check the amount against the invoice with your eyes.",
      "Send it yourself. Put the next nudge on the calendar.",
      "Keep this prompt as the only follow-up voice.",
    ],
  },
  {
    id: "one-true-thing",
    pain: "marketing",
    title: "One true thing, three places",
    dek: "Something that actually happened this week, cut to fit where you already post.",
    fit: "Posts die because the blank box is the job. Starting from a true sentence and posting one, rather than building a content calendar, is how a small shop stays visible without hiring it out.",
    setupMinutes: 25,
    sensitivity: "low",
    minutesPerWeek: { solo: 75, crew: 75, shop: 90, floor: 90 },
    cadence: "a typical week",
    measure: "Minutes from ‘we should post’ to one thing actually published.",
    outputShape:
      "Three labeled drafts only: Instagram, Google Business profile, and a one-line text or email. No hashtag essays.",
    steps: [
      {
        title: "One true sentence",
        body: "A dish you ran, a job you finished, a product that landed, a class that has two seats. If it isn’t true this week, don’t post it.",
      },
      {
        title: "Cut three lengths",
        body: "Delete any price, offer, or superlative you didn’t say out loud. ‘Best in the city’ is how shops get into trouble.",
      },
      {
        title: "Publish one",
        body: "Not three. The other two wait until you know the voice is yours.",
      },
      {
        title: "Same time next week",
        body: "New fact, same prompt. That repetition is the workflow. A content calendar is optional and usually fiction.",
      },
    ],
    monday: [
      "Write one true sentence about something that happened in the business this week.",
      "Generate the three lengths and delete every claim you wouldn’t say at the counter.",
      "Post one of them where you already have an audience.",
      "Leave the prompt where you’ll find it next week.",
    ],
  },
  {
    id: "quote-scaffold",
    pain: "quotes",
    title: "The quote scaffold",
    dek: "The visit notes become an outline. You put the numbers in.",
    fit: "Quotes stall in the notes app. Asking for a scaffold, not a price, keeps the tool from inventing a number you then have to live with.",
    setupMinutes: 30,
    sensitivity: "medium",
    minutesPerWeek: { solo: 80, crew: 140, shop: 180, floor: 200 },
    cadence: "a typical week",
    measure: "Minutes from finishing a visit or call to sending a quote you would stand behind.",
    outputShape:
      "A scaffold with what’s included, what’s excluded, unknowns marked [CHECK], and a short customer summary that contains no invented prices.",
    steps: [
      {
        title: "Dump the notes before you tidy them",
        body: "What they asked for, what you saw, what you don’t know yet. Messy is the point.",
      },
      {
        title: "Ask for an outline, not a price",
        body: "You type the numbers. If a price appears that you didn’t supply, delete it.",
      },
      {
        title: "Send it in the channel you already use",
        body: "The scaffold is not the offer until you’ve checked exclusions and the parts you don’t do.",
      },
      {
        title: "Keep one sent quote as the pattern",
        body: "Next time, paste a redacted version into the checked-facts box: ‘match this shape.’",
      },
    ],
    monday: [
      "After the next call or visit, paste the messy notes before you clean them up.",
      "Generate a scaffold and put your real prices in yourself.",
      "Read the exclusions out loud. If you wouldn’t say them, they aren’t in the quote.",
      "Send it the way you already send quotes.",
    ],
  },
  {
    id: "close-the-day",
    pain: "paperwork",
    title: "Close the day",
    dek: "Three messy minutes at close become a list the morning can use.",
    fit: "End-of-day admin is where owner evenings go. A twelve-minute internal handoff beats a new operations platform you will not maintain.",
    setupMinutes: 15,
    sensitivity: "medium",
    minutesPerWeek: { solo: 50, crew: 80, shop: 120, floor: 150 },
    cadence: "a typical week",
    measure: "Minutes between locking up and having tomorrow’s list written down.",
    outputShape:
      "An internal note only: what happened, what’s unfinished, and tomorrow’s first three actions. Not for customers.",
    steps: [
      {
        title: "Three minutes, unedited",
        body: "Talk into your phone or type: what happened, what’s unfinished, who is waiting. Don’t organize it first.",
      },
      {
        title: "Turn it into a handoff",
        body: "Tomorrow’s first three actions, and anything a customer must never see removed. This note stays inside.",
      },
      {
        title: "Leave it where morning starts",
        body: "The till, the job book, or the staff chat. If it’s in a chatbot history, it doesn’t exist tomorrow.",
      },
      {
        title: "Same clock, five days",
        body: "If it takes more than twelve minutes, the note was too long. Shorten what you dump in, not the checklist.",
      },
    ],
    monday: [
      "At close, spend three minutes dumping what happened, messy on purpose.",
      "Turn it into tomorrow’s first three actions.",
      "Put that list where the morning person already looks.",
      "Time it. If it’s over twelve minutes, dump less next time.",
    ],
  },
  {
    id: "reorder",
    pain: "stock",
    title: "The reorder list",
    dek: "What the shelf said, turned into an order you can check.",
    fit: "Reorders get delayed because the list lives in someone’s head. A checked list in the supplier’s language is the whole workflow, not a new inventory system.",
    setupMinutes: 20,
    sensitivity: "low",
    minutesPerWeek: { solo: 40, crew: 60, shop: 80, floor: 90 },
    cadence: "a typical week",
    measure: "Minutes to produce a reorder you are willing to send.",
    outputShape:
      "A reorder list: item, what the note actually said, and what a person must confirm. Do not invent quantities.",
    steps: [
      {
        title: "Walk or open the low-stock note",
        body: "Item and a rough count. Skip the things you’re unsure about, those get a question mark, not a guess from the tool.",
      },
      {
        title: "Make it readable to the supplier",
        body: "Names they use, not nicknames only you know. Check counts against the shelf, not against the draft.",
      },
      {
        title: "Order the way you already order",
        body: "Phone, rep, or the portal you have. No new inventory app this month.",
      },
      {
        title: "Keep the list",
        body: "Next week you only update what changed. That’s how this stays under twenty minutes.",
      },
    ],
    monday: [
      "Write what’s low: item and rough count, question marks where you didn’t look.",
      "Turn it into a supplier-readable list with no invented quantities.",
      "Check three lines against the actual shelf.",
      "Place the order the way you already do.",
    ],
  },
  {
    id: "hire-plain",
    pain: "hiring",
    title: "A job post with the truth in it",
    dek: "Hours, pay, and the actual work, before any cheerful adjectives.",
    fit: "Hiring copy goes wrong when it describes a job nobody here has. Five true lines and the same five interview questions beat a polished post that attracts the wrong people.",
    setupMinutes: 30,
    sensitivity: "low",
    minutesPerWeek: { solo: 45, crew: 45, shop: 60, floor: 60 },
    cadence: "a week when you are hiring",
    measure: "Minutes to publish a post you would still agree with after a bad Saturday.",
    outputShape: "A plain job post, then five interview questions, in that order. No slogans.",
    steps: [
      {
        title: "Five lines of truth",
        body: "The hours, the pay range if you will publish it, the actual tasks, and what a bad week looks like. If you won’t say it in the interview, it doesn’t go in the post.",
      },
      {
        title: "Draft, then delete the charm",
        body: "Anything cute that isn’t true comes out. ‘Fast-paced family’ is not a schedule.",
      },
      {
        title: "Post where you already hire",
        body: "The window, the group, the board, the site. Ask the five questions in the same order every time.",
      },
      {
        title: "One owner",
        body: "Candidates should not get two versions of the job from two people.",
      },
    ],
    monday: [
      "Write five true lines: hours, pay if you’ll share it, tasks, and a bad week.",
      "Draft the post and the five questions. Delete anything you wouldn’t say in the room.",
      "Publish it where you already look for people.",
      "Decide who is the only person allowed to describe the job.",
    ],
  },
];

const LATER: Record<TradeId, PainId[]> = {
  cafe: ["marketing", "schedule", "stock", "money", "paperwork", "replies", "reviews"],
  salon: ["schedule", "marketing", "reviews", "money", "replies", "paperwork", "hiring"],
  retail: ["marketing", "stock", "replies", "reviews", "money", "paperwork", "hiring"],
  trades: ["quotes", "schedule", "money", "replies", "reviews", "paperwork", "marketing"],
  clinic: ["schedule", "replies", "paperwork", "money", "marketing", "hiring"],
  professional: ["quotes", "replies", "money", "paperwork", "marketing", "schedule"],
  studio: ["quotes", "marketing", "replies", "reviews", "money", "schedule", "paperwork"],
  local: ["replies", "schedule", "marketing", "reviews", "money", "paperwork", "quotes"],
};

export const STAGES: Record<MaturityId, { name: string; line: string }> = {
  never: {
    name: "Not started",
    line: "You haven’t put this on the clock yet. The first win is one repeated task, not a tour of tools.",
  },
  dabbling: {
    name: "Dabbling",
    line: "You’ve tried a chatbot. It isn’t how the shop works. This week it gets one job and a rule.",
  },
  shadow: {
    name: "Shadow use",
    line: "People are already pasting work into chat tools with no shared rule. That’s where mistakes and private details slip. One workflow becomes official. The rest waits.",
  },
  one: {
    name: "One workflow in",
    line: "You already run this on purpose somewhere. Don’t add a second subscription. Add the next narrow job under the same house rule.",
  },
};

export const WORRY_NOTE: Record<WorryId, string> = {
  mistakes:
    "You don’t want a bad draft reaching a customer. The rule is blunt: the tool never sends. A person does, after names, times, prices, and promises are checked.",
  privacy:
    "You don’t want the wrong thing pasted. These recipes are written so you paste one task, not the customer list. The never-list is part of the job.",
  cost:
    "You don’t want another bill. This month uses the chat tool you can already open. If two timed weeks don’t give time back, you stop. No subscription required to find out.",
  staff:
    "You don’t want five private habits. One note in the group chat, one job, one person checking the first week. Side use is how the mistakes happen.",
  time:
    "You don’t have an afternoon for a course. Setup is a single real example from this week, not a training module. If it doesn’t fit before close today, it’s the wrong project.",
};

export const SOURCES: { title: string; detail: string; url?: string }[] = [
  {
    title: "Homebase, 2026 Main Street AI Gap Report",
    detail:
      "A survey of 750 small business owners and operators, fielded by Propeller Insights and published by Homebase in September 2026. It found 74% using or piloting AI, up from 64% the year before. Among adopters, 89% reported a positive effect and 87% said it saved them time. Owners using AI for both scheduling and payroll estimated 7.7 hours and $343 saved a month. Adoption was 54% for businesses under $500,000 in revenue and 81% at $5 million or more. Across all owners surveyed, data privacy (51%) and fear of mistakes (42%) were the top concerns.",
    url: "https://www.joinhomebase.com/blog/small-business-ai-gap-report",
  },
  {
    title: "Thryv, 2025 AI and Small Business survey",
    detail:
      "Thryv reported AI use among small businesses rising from 39% in 2024 to 55% in 2025. Among users, 63% used it daily and 58% said they saved more than 20 hours a month.",
    url: "https://www.businesswire.com/news/home/20250717239434/en",
  },
  {
    title: "Fiverr, Small Business Month survey",
    detail:
      "Nearly 6,000 owners across 25 countries answered between July 2024 and March 2025. 77% were using generative AI for business or personal needs, and 70% spent less than five hours a week on marketing.",
    url: "https://block.fiverr.com/news/small-business-survey-2025",
  },
  {
    title: "Bluevine, 2026 Small Business AI Trends Report",
    detail:
      "A survey of 942 U.S. small business owners and financial decision-makers. 78% did not fully trust AI to handle low-level tasks without oversight. Data security and privacy (33%) and accuracy (31%) were the biggest roadblocks. This is why every draft here stops at a person who checks it.",
    url: "https://www.bluevine.com/blog/small-business-ai-trends-report-2026",
  },
  {
    title: "How to read these numbers",
    detail:
      "All of these surveys were run or commissioned by software or finance companies, and the savings are self-reported estimates. Treat them as a sign that owners are trying this, not as a promise for your shop. The hour ranges inside Kindling are our own planning estimates by crew size, net of checking time. The Hours tab lets you replace them with your real minutes.",
  },
];

export function byId<T extends string>(list: Choice<T>[], id: T): Choice<T> {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown id ${id}`);
  return found;
}

export function workflowFor(pain: PainId): Workflow {
  const found = WORKFLOWS.find((item) => item.pain === pain);
  if (!found) throw new Error(`No workflow for ${pain}`);
  return found;
}

export function laterWorkflows(trade: TradeId, pain: PainId): Workflow[] {
  return LATER[trade]
    .filter((item) => item !== pain)
    .slice(0, 2)
    .map((item) => workflowFor(item));
}

export function tradeRules(trade: TradeId, pain: PainId): string[] {
  const rules: string[] = [];
  if (pain === "reviews") {
    rules.push(
      "Ask for an honest review, never a good one. Offer nothing in return, no discount, gift or favour. The review link must come from the facts, or stay [CHECK: review link].",
    );
  }
  if (trade === "clinic") {
    rules.push(
      "Front desk only. Never discuss symptoms, diagnoses, medications, treatment, or insurance benefits. If the note asks something clinical, the draft offers a callback from a person and nothing else.",
    );
  }
  if (trade === "professional") {
    rules.push(
      "Do not give legal, tax, financial, or other professional advice. Logistics and plain-language drafts only. If a judgment is required, write [CHECK: owner review].",
    );
  }
  if (trade === "salon") {
    rules.push(
      "Never promise a chemical result, a color correction, or a refund. Patch tests, prices, and timing stay marked [CHECK] unless the facts state them.",
    );
  }
  if (trade === "cafe" && (pain === "replies" || pain === "marketing" || pain === "quotes")) {
    rules.push(
      "Never invent allergen safety, wait times, or whether an item is on today. If it is not in the facts, write [CHECK: menu].",
    );
  }
  if (trade === "trades" && (pain === "quotes" || pain === "replies" || pain === "schedule")) {
    rules.push(
      "Never invent trip charges, parts prices, or arrival windows. Mark them [CHECK: price] or [CHECK: arrival].",
    );
  }
  if (trade === "retail" && (pain === "replies" || pain === "marketing")) {
    rules.push("Never invent stock levels or delivery dates. Use [CHECK: stock] when the facts don’t say.");
  }
  if (trade === "studio" && pain === "quotes") {
    rules.push(
      "Usage rights, revision rounds, and rush fees are [CHECK] unless the facts state them. Do not give them away.",
    );
  }
  return rules;
}

export function promptFor(workflow: Workflow, trade: TradeId): string {
  const extras = tradeRules(trade, workflow.pain);
  const lines = [
    `You help {{business}}, ${PLACE[trade]}. What they do: {{offer}}.`,
    "Voice: {{tone}}",
    "{{sample}}",
    ...(usesChannel(workflow.pain) ? ["{{channel}}"] : []),
    "{{language}}",
    "{{facts}}",
    "",
    `Job: ${workflow.fit}`,
    "",
    "Hard rules:",
    "- Draft only. A person who works there will edit this and decide whether it is sent.",
    "- Never invent prices, times, availability, policies, quantities, or promises.",
    "- If a fact is not in the note or the checked facts, write [CHECK: what is missing] and leave it there.",
    "- Do not mention that you are an AI, a model, or a bot.",
    "- Do not add discounts, refunds, or free things unless the checked facts say to.",
    ...extras.map((rule) => `- ${rule}`),
    "",
    "Output:",
    workflow.outputShape,
    "",
    "The real note:",
    '"""',
    "PASTE THE NOTE HERE",
    '"""',
    "",
    "Facts a person has already checked (leave blank if none):",
    '"""',
    "PASTE CHECKED FACTS HERE",
    '"""',
  ];
  return lines.join("\n");
}

export function fillPrompt(template: string, shop: Shop, facts: Fact[] = [], today: string = localDay()): string {
  const name = shop.name.trim() || "our business";
  const offer = shop.offer.trim() || "the work we actually do";
  return template
    .replaceAll("{{business}}", name)
    .replaceAll("{{offer}}", offer)
    .replaceAll("{{tone}}", TONE_LINE[shop.tone])
    .replace("\n{{sample}}", sampleBlock(shop.voiceSample))
    .replace("\n{{channel}}", `\nWhere it will be sent: ${channelRules(shop.channel)}`)
    .replace("\n{{language}}", languageRules(shop.language) ? `\nLanguage: ${languageRules(shop.language)}` : "")
    .replace("\n{{facts}}", factsBlock(facts, today));
}

export function sampleBlock(sample: string | undefined): string {
  const text = (sample ?? "").trim();
  if (!text) return "";
  return [
    "",
    "A real message we sent that sounds right. Match its rhythm, word choice and sign-off. Never copy facts from it:",
    '"""',
    text,
    '"""',
  ].join("\n");
}

export function houseRules(intake: Intake, shop: Shop, title: string): string {
  const name = shop.name.trim() || "This business";
  const lines = [
    `How ${name} uses AI`,
    "",
    "One page. In force until someone replaces it on purpose.",
    "",
    "1. A person sends. The tool drafts. Nothing reaches a customer, a public page, or a review until someone who works here has read it.",
    `2. This month the only job is: ${title}. Other uses wait.`,
    "3. Never paste payment card numbers, bank details, passwords, government ID numbers, or a full customer export.",
  ];
  if (intake.trade === "clinic") {
    lines.push(
      "4. Never paste chart notes, diagnoses, medications, insurance IDs, or a patient’s story. Front-desk words only: times, the name they already use with us, and “someone will call.”",
    );
  } else if (intake.trade === "professional") {
    lines.push(
      "4. Never paste account numbers or papers you would not leave on the front desk. The tool does not give professional advice.",
    );
  } else {
    lines.push("4. Paste one task, not the database. One customer, one job, or one note at a time.");
  }
  const owner =
    intake.team === "solo"
      ? "You own this. The note is for future-you."
      : "One person owns it this month: the owner, unless a name is written here: ________.";
  const shadow =
    intake.maturity === "shadow"
      ? "Unofficial use stops. If it is not this job, it waits."
      : "Side experiments wait until this job has run for two weeks.";
  lines.push(
    `5. If a price, time, policy, or name is not in front of you, the draft says [CHECK]. We do not let it guess, and we do not delete the brackets until we know.`,
    `6. ${owner} ${shadow}`,
    "7. Tool: the chat app we already open. No new subscription until this job has been timed for two weeks.",
    "8. Measure minutes on this job for ten working days. If it does not give time back, we drop it.",
  );
  return lines.join("\n");
}

export const EXAMPLE_SHOP: Shop = {
  name: "North & Rye",
  offer: "Neighborhood coffee, a short lunch, and Saturday catering trays.",
  tone: "warm",
  hourly: 35,
  channel: "whatsapp",
  language: "english",
  voiceSample:
    "Hey Sam, yes we can do Saturday pickup. Trays are ready by 9, and the door is round the back. Thanks for ordering with us.",
};

export const EXAMPLE_INTAKE: Intake = {
  trade: "cafe",
  team: "crew",
  pain: "replies",
  maturity: "dabbling",
  worry: "mistakes",
};

export const AI_DAILY_CAP = 8;

export const DEFAULT_SHOP: Shop = {
  name: "",
  offer: "",
  tone: "warm",
  hourly: 40,
  voiceSample: "",
  channel: "whatsapp",
  language: "english",
};
