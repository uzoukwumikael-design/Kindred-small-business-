# Kindling

**Going live? Start with `docs/LAUNCH.md`.** It lists every setting outside the code, and `/api/health` checks your live site against it.

Helps a small shop install one AI workflow this week: a recipe, a prompt, and a one-page house rule.

## Commands

    npm install
    npm run dev          # http://localhost:8080
    npm run build
    npm run typecheck
    npm test             # 277 unit checks
    npm run test:e2e     # about 170 browser checks (run `npx playwright install chromium` once)
    npm run backup       # encrypted backup of every table (see docs/LAUNCH.md)
    npm run restore -- backups/FILE   # dry run first
    bash supabase/tests/run.sh   # database rules, needs a scratch Postgres (see the file)
    npm run eval         # drafting quality with your own AI key

## Run it

    npm install
    npm run dev        # http://localhost:8080
    npm run build

## Deploy on Vercel

Import the repo. No settings needed.

For live AI drafts for free, create a Gemini key at https://aistudio.google.com and add it in Vercel as
`GEMINI_API_KEY`, then redeploy. Groq is supported as a second free option (`GROQ_API_KEY`).
Providers are tried in order and fall back to each other, then to a template drafter that marks every
missing fact with [CHECK].

Google's free tier may use prompts to improve its products, so keep the "never paste" house rule in force.

## Accounts with Supabase (optional)

Without this the app works fully in the browser. With it, people can sign in and their week follows them across devices.

1. Create a project at supabase.com.
2. SQL Editor, New query, paste the whole of `supabase/schema.sql`, Run.
3. Project Settings, API: copy the Project URL and the anon (or publishable) key.
4. In Vercel add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy (they are read at build time).
5. Supabase, Authentication, URL Configuration: set Site URL to your live address and add `https://YOUR-SITE/studio`
   (and `http://localhost:8080/studio` for local work) under Redirect URLs. Magic links fail without this.
6. Optional: Authentication, Providers, Email. Turn off "Confirm email" if you want password sign-up to log people in
   straight away. Magic links work either way.
7. The default Supabase email sender is limited to a few emails an hour. Add your own SMTP (Resend, Brevo) before launch.

Each person gets one row holding their week. Row Level Security means they can only ever read or change their own.

## Crews (shared weeks)

Run the whole of `supabase/schema.sql` again. It is safe to repeat and adds the crew tables and functions.

- Anyone in a crew can edit the shared week. Only the person who made it can invite, rename, remove people or delete it.
- Invites are links (`/join?code=...`). The owner can make a new link, which stops the old one working.
- Members cannot read the invite code, change the owner or add people. All of that goes through database functions that check who is asking.
- Each person's logged runs carry their name, and the Hours tab shows a crew total.
- Limits: a crew holds up to 20 people and an account can own up to 5 crews. A run deleted on one device can come back if another, out-of-date device saves afterwards. Updates arrive when a tab regains focus or every 45 seconds, not instantly.

## Shop facts, kept examples, reviews, sharing in and pricing

- **Shop facts** (Shop facts tab): hours, address, payment link, delivery, prices, booking and returns policy, review link, contact, and
  any custom facts. Drafts use these instead of leaving a bracket. A fact older than 90 days is not used until the owner presses
  Still true. Bank account numbers are masked before any AI sees them, so use a payment link.
- **Which facts a draft used** is shown under the draft. It is a guide based on matching words, not a guarantee.
- **Learning from edits:** after fixing a draft, "Save as a good example" keeps it (private details masked). Up to 8 are kept and the
  latest 3 guide the AI. The Shop facts tab describes the owner's style in plain words from those examples and lets them forget any.
- **The review ask** is a new job ("Asking for reviews") that uses the saved review link and never offers anything in return.
- **Share in from another app:** `public/manifest.webmanifest` registers Kindling as a share target (`/share`). On Android in Chrome, after
  installing the app, Share then Kindling opens the studio with the text filled in. iPhones do not support this. I could test the manifest,
  the icons and the `/share` page, but not the real Android Share sheet, so try it on a phone after you deploy.
- **Pricing page** (`/pricing`) shows a free plan and, only if you set the `VITE_PLAN_*` variables, one flat paid plan. The app has no billing
  system, so the plan button is a link to a payment page you create. The page promises no per-message charges and no contract in the app,
  so keep your real plan consistent with that.

## The trainable model and the data layer

Kindling includes a small model of its own that you can retrain. It reads a customer message and guesses which shop facts it needs and what
kind of job it is. Full explanation, retraining steps and honest limits are in `docs/TRAINING.md`.

    npm run seed                                    regenerate the synthetic seed data
    npm run train                                   train on the seed data and write docs/MODEL_REPORT.md
    npm run export-training                         export examples people chose to share (needs the service role key)
    npm run train -- --extra data/exports/needs.jsonl --must-beat-baseline

The model is used for the hint under the note box, the offline drafter and the front-page quick draft. It beats the old keyword rules on the
hand-written test set (see `docs/MODEL_REPORT.md`), but it was trained on synthetic data, so retrain on real, consented examples before you
trust it. Re-run `supabase/schema.sql` to add the opt-in tables.

## Local languages, the quick draft and naira pricing

- **Language for drafts** (shop settings): English, Pidgin, Yoruba, Igbo, Hausa, or match the customer. Anything but English shows a reminder to
  have a speaker read the draft, because AI is weaker in these languages. Template drafts without an AI are English only.
- **Quick draft** on the front page: paste one message, get one draft, no sign-up, nothing stored. It is rate limited; see `.env.example`.
- **Naira pricing:** set `VITE_PLAN_PRICE_NGN` and `VITE_PLAN_URL_NGN` (a Paystack or Selar payment link) next to the dollar price. Visitors in
  Nigeria see naira first, with a switch.

## Checking draft quality

**Double-check list.** Under each draft, Kindling flags amounts, times, links and promises (such as "free" or "refund") that are not in the
owner's note or confirmed facts, plus template-sounding phrases and messages that are too long for the channel. It is advice only. The
`[CHECK]` brackets remain the lock on the send button. It compares against the note the draft came from, so it stays quiet after a reload.

**Evaluate the prompts with your own key.** `evals/samples.json` holds ten sample customer messages for a made-up braiding studio, each with
what a good draft must and must not contain (use the facts, bracket what is not known, no invented prices, no card numbers, resist a note
that tries to take over, stay short on a DM). Run:

    GEMINI_API_KEY=your-key npm run eval

It sends each message through the real drafting engine, checks the result, prints PASS or FAIL per case and writes `evals/report.md` with
every draft. Without a key it tests the built-in template drafter. Replace the samples with real messages from your own shop (private
details removed) and your own facts before you rely on the result. A case that expects a bracket can pass by luck, so read the report, not
just the score. Re-run it whenever you change a prompt, a model or `SYSTEM` in `src/lib/kindling/ai-core.server.ts`.

**Deletions stick.** Runs, facts and saved examples you delete are remembered by id and stay deleted when another, out-of-date device saves.
**Style notes** say how many messages each note is based on, appear only from three saved messages, and are labelled an early guess until five.

## Channels and sending

For jobs that write a message to one customer (replies, booking confirmations, invoice chasing, quotes), the shop settings have a
"Where you usually reply" picker: WhatsApp, Text, Email or Instagram and Facebook DM. It shapes the AI prompt, the template drafter and
the copy-paste prompt (short lines for WhatsApp and DMs, a subject line and sign-off for email). Posts, lists and ads do not use it.

The draft is an editable box. Every `[CHECK: ...]` bracket is listed under it, and the send button stays locked until none are left.
Unlocked, it opens the right app with the message filled in: `wa.me` for WhatsApp, `sms:` for text, `mailto:` for email. A DM has no
such link, so it is copy only. Kindling never sends anything itself. Template notes sit under the box and are never part of the message.

## Learn and weekly summary

`/learn` has three short lessons with practice (what to hand over, the 60-second check, writing a note it can use). Progress is kept in the browser only.
The studio shows a one-line summary of the last seven days built from the minutes people logged.

## Weekly summary email (optional)

People turn it on themselves in their account (unticked by default). A job runs once a day, and each person gets one email a week
on the day they chose: how many times they ran their job and the minutes they got back, including their share of any crew.
If nothing is logged they get one gentle nudge, never two in a row.

1. In Vercel add `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any long random string), one of `RESEND_API_KEY` or `BREVO_API_KEY`, and
   `EMAIL_FROM` such as `Kindling <hello@yourdomain.com>`. Optional: `EMAIL_FOOTER`, `SITE_URL`. Never prefix these with `VITE_`.
2. Run `supabase/schema.sql` again (adds the `kindling_prefs` table).
3. Verify your sending domain (Resend) or sender address (Brevo), or mail will be refused or land in spam.
4. Redeploy. `vercel.json` already schedules `/api/weekly` daily at 08:00 UTC (9am in Nigeria). Cron runs on production deployments only.
5. In your account, turn the email on and press "Send me one now" to see exactly what people get.

Notes: Vercel's free plan allows a cron to run only once a day, and it can fire any time within the hour, so the job is daily and
sends to whoever is due. A repeated run never double-sends. Free email plans have daily caps (Resend 100 a day and 3,000 a month,
Brevo 300 a day), so `WEEKLY_MAX_PER_RUN` limits each run and people past the cap are sent the next day. Every email has an unsubscribe
link and a one-click unsubscribe header. Accounts can also be deleted by their owner from the account page, which needs
`SUPABASE_SERVICE_ROLE_KEY`.

## Privacy and compliance

`docs/COMPLIANCE.md` is a checklist for the site owner covering Nigeria's data protection law (registration thresholds, the privacy
notice, consent, people's rights, processor contracts, the 72-hour breach clock). It is not legal advice. Have a Nigerian data protection
lawyer or licensed DPCO confirm it. Set `VITE_CONTROLLER_NAME`, `VITE_CONTROLLER_ADDRESS`, `VITE_CONTACT_EMAIL` and `VITE_DATA_REGION` so
the `/privacy` page names you. The page lists the AI and email services in use automatically.

## Google sign-in (optional)

1. Google Cloud Console: create a project, set up the OAuth consent screen, then create an OAuth client ID of type Web application.
2. Under Authorized redirect URIs add your Supabase callback: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`.
3. Supabase, Authentication, Providers, Google: enable it and paste the Client ID and Client Secret.
4. Make sure `https://YOUR-SITE/studio` is in Supabase's redirect allow list (same list as the magic links).
5. In Vercel set `VITE_GOOGLE_AUTH=true` and redeploy. The button stays hidden until you do.

## Editing from two devices

Saves carry a version number. If a second device saved first, the newer copy is merged in: logged runs and ticks are combined, so nothing logged is lost. For other fields the most recent edit wins. If you already ran an earlier `schema.sql`, run the new one again. It adds the version column safely.

## Privacy

`src/lib/kindling/redact.ts` masks card numbers, ID numbers, account numbers, emails, phone numbers (including Nigerian formats) and
"password is ..." before text reaches an AI provider, on the server as well as in the browser. The `/privacy` page explains everything
in plain language. Set `VITE_CONTACT_EMAIL` to show a contact address on it. Have it reviewed against the data protection law that
applies to you before launch.

## Email sign-ups

Add `WAITLIST_WEBHOOK_URL` in Vercel (a Formspree endpoint, Zapier or Make webhook, or Google Apps Script URL).
Each sign-up is POSTed as JSON `{ email, trade, source, at }`. With it unset, the form is hidden.

## What is where

- `src/lib/kindling/catalog.ts` all workflows, questions, prompts and house rules (edit copy here)
- `src/lib/kindling/ai.ts` the server function and per-IP daily limit. `ai-core.server.ts` holds the prompts, provider chain, output checks and template fallback
- `src/lib/kindling/offline.ts` the template drafter
- `src/components/kindling/` landing, the five-question bench, the studio, the minutes log (`ledger.tsx`) and the shareable rules page (`rules.tsx`)
- `src/lib/kindling/cloud.ts` Supabase sign-in, saving, conflict handling between devices
- `supabase/schema.sql` the one table and its security rules
- `src/lib/kindling/redact.ts` privacy masking, `src/components/kindling/privacy.tsx` the privacy page
- `src/lib/kindling/share.ts` encodes the house rules into a link, nothing is stored on a server
- `src/lib/kindling/waitlist.ts` email capture to your webhook
