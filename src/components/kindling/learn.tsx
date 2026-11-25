import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { primaryClass, secondaryClass } from "@/components/kindling/shell";

const KEY = "kindling-learn-v1";

function useProgress(): [string[], (id: string) => void] {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDone((JSON.parse(raw) as string[]).filter((item) => typeof item === "string"));
    } catch {
      setDone([]);
    }
  }, []);
  function mark(id: string) {
    setDone((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // progress just will not be remembered
      }
      return next;
    });
  }
  return [done, mark];
}

/* ------------------------------------------------------------------ */
/* Lesson 1: sort what to hand over and what to keep                   */
/* ------------------------------------------------------------------ */

const SORT_ITEMS: { text: string; answer: "hand" | "keep"; why: string }[] = [
  {
    text: "A polite reminder for an unpaid invoice",
    answer: "hand",
    why: "Routine wording is what drafts are good at. You still check the amount and the date.",
  },
  {
    text: "Deciding whether a customer gets a refund",
    answer: "keep",
    why: "A refund is a decision about money and your policy. The tool does not know either.",
  },
  {
    text: "A first draft of Friday's post",
    answer: "hand",
    why: "A blank page is the slow part. You add the true detail only you know.",
  },
  {
    text: "Telling a customer what a treatment will do for them",
    answer: "keep",
    why: "Anything medical, legal or financial stays with a qualified person, not a draft.",
  },
  {
    text: "Turning a messy supplier note into a reorder list",
    answer: "hand",
    why: "Tidying words into a list is safe. You confirm the quantities before it goes anywhere.",
  },
  {
    text: "Choosing which delivery date to promise",
    answer: "keep",
    why: "A promise is yours to make. The draft can word it once you have chosen the date.",
  },
];

function SortPractice({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<Record<number, "hand" | "keep">>({});
  const answered = Object.keys(picked).length;
  useEffect(() => {
    if (answered === SORT_ITEMS.length) onDone();
  }, [answered, onDone]);
  const right = SORT_ITEMS.filter((item, i) => picked[i] === item.answer).length;
  return (
    <div className="mt-5 grid gap-3">
      {SORT_ITEMS.map((item, i) => {
        const choice = picked[i];
        return (
          <div key={item.text} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-base text-ink">{item.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["hand", "keep"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={choice !== undefined}
                  aria-pressed={choice === option}
                  onClick={() => setPicked((current) => ({ ...current, [i]: option }))}
                  className={
                    "h-11 rounded-lg border px-4 text-sm font-medium " +
                    (choice === option ? "border-ink bg-ink text-on-ink" : "border-line bg-paper text-ink hover:border-ink")
                  }
                >
                  {option === "hand" ? "Hand it over" : "Keep it"}
                </button>
              ))}
            </div>
            {choice !== undefined ? (
              <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
                <strong>{choice === item.answer ? "Right. " : `Not quite, this one is "${item.answer === "hand" ? "hand it over" : "keep it"}". `}</strong>
                {item.why}
              </p>
            ) : null}
          </div>
        );
      })}
      {answered === SORT_ITEMS.length ? (
        <p className="text-base text-ink" role="status">
          {right} of {SORT_ITEMS.length}. The rule underneath: drafts can be handed over, decisions and promises stay
          with you.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson 2: spot the invented fact                                    */
/* ------------------------------------------------------------------ */

const SPOT_ROUNDS: { note: string; draft: string[]; bad: number; why: string }[] = [
  {
    note: "Maria asks to move her Saturday 2pm to Sunday. We are open Sunday 11 to 4.",
    draft: [
      "Hi Maria, Sunday works.",
      "We are open 11 to 4 on Sunday, so 2pm is fine.",
      "I have also added a free blow dry to say sorry for the change.",
    ],
    bad: 2,
    why: "Nothing in the note offers a free blow dry. Drafts like to be generous with things that are not theirs to give.",
  },
  {
    note: "Sam wants 3 trays for Saturday pickup. Total is $120. Ready by 9.",
    draft: [
      "Hi Sam, your 3 trays will be ready by 9 on Saturday.",
      "The total is $135 including delivery.",
      "See you then.",
    ],
    bad: 1,
    why: "The note says $120 and mentions pickup, not delivery. A wrong number is the easiest mistake to miss, so always check the figures.",
  },
  {
    note: "Chase invoice 204 for $480, due 1 October.",
    draft: [
      "Hi, a quick reminder about invoice 204 for $480, due 1 October.",
      "If it has already gone out, please ignore this.",
      "A late fee of 5% will apply from Monday.",
    ],
    bad: 2,
    why: "A late fee is a policy and a threat, and the note never mentioned one. Anything that sounds like a rule needs a source.",
  },
];

function SpotPractice({ onDone }: { onDone: () => void }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const finished = round >= SPOT_ROUNDS.length;
  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);

  if (finished) {
    return (
      <p className="mt-5 text-base text-ink" role="status">
        {score} of {SPOT_ROUNDS.length} found on the first try. That is the whole check: read each line against your
        note and ask where it came from.
      </p>
    );
  }
  const current = SPOT_ROUNDS[round];
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-muted">
        Round {round + 1} of {SPOT_ROUNDS.length}
      </p>
      <p className="mt-2 text-base text-ink">
        <span className="font-medium">Your note: </span>
        {current.note}
      </p>
      <p className="mt-4 text-sm font-medium text-ink">The draft. Tap the line that is not in your note.</p>
      <ul className="mt-2 grid gap-2">
        {current.draft.map((sentence, i) => {
          const chosen = picked === i;
          const reveal = picked !== null;
          return (
            <li key={sentence}>
              <button
                type="button"
                disabled={reveal}
                onClick={() => {
                  setPicked(i);
                  if (i === current.bad) setScore((s) => s + 1);
                }}
                className={
                  "w-full rounded-lg border p-3 text-left text-base " +
                  (reveal && i === current.bad
                    ? "border-ember bg-ember-soft text-ink"
                    : chosen
                      ? "border-ink text-ink"
                      : "border-line bg-paper text-ink hover:border-ink")
                }
              >
                {sentence}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null ? (
        <div className="mt-4" role="status">
          <p className="text-sm leading-relaxed text-ink">
            <strong>{picked === current.bad ? "Found it. " : "That one is fine. The highlighted line is the problem. "}</strong>
            {current.why}
          </p>
          <button
            type="button"
            className={`${secondaryClass} mt-3`}
            onClick={() => {
              setPicked(null);
              setRound((r) => r + 1);
            }}
          >
            {round + 1 === SPOT_ROUNDS.length ? "Finish" : "Next round"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson 3: write a note it can use                                   */
/* ------------------------------------------------------------------ */

const NOT_NAMES = new Set(
  "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December The We Can Please Hello Hey Customer Someone Our My She He They Her His This That There Could Would Need Want Hi When Where How".split(" "),
);

function noteGaps(note: string): string[] {
  const text = note.trim();
  if (text.length < 8) return [];
  const gaps: string[] = [];
  const capitals = (text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).filter((word) => !NOT_NAMES.has(word));
  const introduced =
    /\b(?:from|name is|this is|i'm|it's)\s+[A-Za-z]{2,}/i.test(text) ||
    /^[a-z]{3,}\s+(?:here|wants|asks|says|called|needs|is asking)\b/i.test(text);
  if (capitals.length === 0 && !introduced) {
    gaps.push("No name. The draft will open with [CHECK: customer name].");
  }
  if (!/\d/.test(text)) {
    gaps.push("No numbers. Any time, date, amount or quantity will become a [CHECK] you have to fill.");
  } else if (!/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text)) {
    gaps.push("No day or time. If the reply needs one, it will be a [CHECK].");
  }
  if (!/\?|\b(?:can|could|need|needs|want|wants|wanted|would|please|how|when|where|do you|ask|asks|asked|asking|move|change|cancel)\b/i.test(text)) {
    gaps.push("It is not clear what they asked for. Add the question in your own words.");
  }
  if (text.length < 40) gaps.push("Very short. One more line about what you already know makes the draft sharper.");
  return gaps;
}

function NotePractice({ onDone }: { onDone: () => void }) {
  const [note, setNote] = useState("");
  const gaps = noteGaps(note);
  const ready = note.trim().length >= 8;
  useEffect(() => {
    if (ready && gaps.length === 0) onDone();
  }, [ready, gaps.length, onDone]);
  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-medium text-muted">Hard to use</p>
          <p className="mt-2 text-base text-ink">"customer email about her order"</p>
        </div>
        <div className="rounded-xl border border-ember bg-ember-soft p-4">
          <p className="text-sm font-medium text-muted">Easy to use</p>
          <p className="mt-2 text-base text-ink">
            "Maria wants to move her Saturday 2pm order of 3 trays to Sunday. We open Sunday 11 to 4. Total was $120."
          </p>
        </div>
      </div>
      <label className="mt-5 block">
        <span className="text-sm font-medium text-ink">Try your own. Write a note about a real customer message.</span>
        <textarea
          className="mt-2 w-full rounded-lg border border-line bg-surface p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted"
          rows={4}
          maxLength={600}
          value={note}
          placeholder="Who, what they asked, and the facts you already know."
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {ready ? (
        gaps.length === 0 ? (
          <p className="mt-3 text-base text-ink" role="status">
            That note has a name, a request and a fact to work with. A draft from it will have very little to guess.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2" role="status">
            {gaps.map((gap) => (
              <li key={gap} className="rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
                {gap}
              </li>
            ))}
          </ul>
        )
      ) : null}
      <p className="mt-3 text-sm text-muted">This check runs in your browser. Nothing you type here is sent anywhere.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const LESSONS = [
  {
    id: "hand-or-keep",
    minutes: 2,
    title: "What to hand over and what to keep",
    intro:
      "The best first jobs are the repeated, low-risk ones: routine replies, reminders, short posts, lists. Decisions, promises and anything about money, health or the law stay with you. Sort six real examples.",
  },
  {
    id: "sixty-second-check",
    minutes: 3,
    title: "The 60-second check",
    intro:
      "Every draft gets the same check before it goes out: names, numbers, times and dates, promises, and anything in [CHECK] brackets. Then read it out loud once. In the app, the send button stays locked while any bracket is left. Practise finding the one line that was made up.",
  },
  {
    id: "good-note",
    minutes: 2,
    title: "Write a note it can use",
    intro:
      "A draft is only as good as the note behind it. Include who it is, what they asked, and the facts you already know. Whatever you leave out, the tool has to guess, and guesses are what you will be checking.",
  },
] as const;

export function Learn() {
  const [done, mark] = useProgress();
  const [open, setOpen] = useState<string>(LESSONS[0].id);
  const complete = LESSONS.every((lesson) => done.includes(lesson.id));
  const finish = (id: string) => () => mark(id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-ember">Learn</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
        Seven minutes to use it safely.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Three short lessons with a practice in each. No sign-up, and nothing you do here leaves your browser.
      </p>

      <ol className="mt-8 grid gap-4">
        {LESSONS.map((lesson, index) => {
          const isDone = done.includes(lesson.id);
          const isOpen = open === lesson.id;
          return (
            <li key={lesson.id} className="rounded-xl border border-line">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? "" : lesson.id)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span>
                  <span className="block text-sm text-muted">
                    Lesson {index + 1}, about {lesson.minutes} minutes
                  </span>
                  <span className="mt-1 block font-display text-2xl font-medium text-ink">{lesson.title}</span>
                </span>
                {isDone ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
                    <Check className="size-4" aria-hidden="true" />
                    Done
                  </span>
                ) : null}
              </button>
              {isOpen ? (
                <div className="border-t border-line p-5">
                  <p className="text-base leading-relaxed text-ink">{lesson.intro}</p>
                  {lesson.id === "hand-or-keep" ? <SortPractice onDone={finish(lesson.id)} /> : null}
                  {lesson.id === "sixty-second-check" ? <SpotPractice onDone={finish(lesson.id)} /> : null}
                  {lesson.id === "good-note" ? <NotePractice onDone={finish(lesson.id)} /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-10 rounded-xl border border-line bg-surface p-5">
        <p className="font-display text-2xl font-medium text-ink">
          {complete ? "You are ready for a real one." : "Then put it to work."}
        </p>
        <p className="mt-2 text-base text-muted">
          {complete
            ? "Pick one real message from this week and run it through your week."
            : "You can start now and come back to the lessons any time."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/bench" className={primaryClass}>
            Build my week
          </Link>
          <Link to="/studio" className={secondaryClass}>
            Back to my week
          </Link>
        </div>
      </div>
    </main>
  );
}
