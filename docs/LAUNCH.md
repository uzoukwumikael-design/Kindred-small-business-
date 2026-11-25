# Launch checklist: everything outside the code

The code is ready to deploy. These are the things only you can set up, in the order that avoids surprises.
Tick them off, then check your live site with the health check at the end of part 1.

## 0. Check it yourself any time

    curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/health

With no key it answers `{"ok":true}`, which is what an uptime monitor wants. With your `CRON_SECRET` it lists every setting as pass, review or fix
(missing tables, readable private data, a secret in a public variable, a Google button with Google switched off, and so on). It never prints a secret value.

In the repository: `npm run typecheck`, `npm test` (277 unit checks), `bash supabase/tests/run.sh` (94 database checks, needs a scratch Postgres), and `npm run test:e2e` (about 170 browser checks against a production build and stand-in services; run `npx playwright install chromium` once first).

Your numbers: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/stats?days=30` shows how many people reached each step (visit, week built, draft made, send clicked) with no identifiers. Browser errors go to your server log, and to `ERROR_WEBHOOK_URL` if you set one.

## 1. Secure your own accounts first

Turn on two-factor sign-in on GitHub, Vercel, Supabase (Supabase's own production checklist asks for this when you use email and password sign-in), Google
Cloud, your AI provider, your email provider, and your domain registrar. One stolen login on any of them is a bigger risk than anything in the code.

## 2. Supabase

1. Create the project. Choose the region closest to your users and put its name in `VITE_DATA_REGION` so the privacy page is truthful.
2. SQL editor: paste all of `supabase/schema.sql` and run it. It is safe to run again whenever you update the app.
3. Project Settings, API: copy the project URL and the anon (or publishable) key into Vercel as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   Copy the **service role** key into Vercel as `SUPABASE_SERVICE_ROLE_KEY`. That one is a secret. Never prefix it with `VITE_`.
4. Authentication, URL Configuration: set Site URL to your live address and add **both** `https://YOUR-SITE/studio` and `https://YOUR-SITE/reset-password` to the redirect URLs. Magic links, Google and password reset emails all fail without them.
5. Authentication: keep **email confirmation on**. The health check warns if it is off, because anyone could then sign up with an address they do not own.
6. Authentication, Emails, SMTP settings: add your own email sender (Resend, Brevo, SES and similar). Supabase's built-in sender is heavily limited and its mail is
   likely to land in spam. With your own sender the default is 30 new users an hour, which you can change under Authentication, Rate Limits. If you plan a big announcement,
   raise it first.
7. In your email provider, **turn off link tracking** for these messages. Supabase warns that tracking can rewrite the confirmation links and break sign-in.
8. **Bot protection (Cloudflare Turnstile), optional but worth doing before you promote the site.** The app supports it. Do these in this order, or sign-ups will fail:
   1. In Cloudflare, create a Turnstile widget for your domain. You get a site key (public) and a secret key (private).
   2. In Vercel set `VITE_TURNSTILE_SITE_KEY` (site key) and `TURNSTILE_SECRET_KEY` (secret key), then redeploy. This protects the quick draft, the update list and the help form on its own.
   3. In Supabase, Authentication, Attack Protection (CAPTCHA), choose Turnstile and paste the **same secret**. Only now are sign-up, sign-in, sign-in links and password reset checked.
   Set both or neither: a secret without a site key makes every form refuse everyone (the health check shows this as a failure). Cloudflare's own docs list test keys for trying it before you go live.
9. Backups: read Supabase's backups guide for your plan and decide how you will recover from a mistake. If your plan has no automatic backups, export on a schedule you can keep up.
   Also check whether a free project pauses when unused, which would take your site down without warning. Use a paid plan for a real launch.
10. Optional custom domain for Supabase: if you add one, change `https://*.supabase.co` in the `connect-src` line of `vercel.json` to your domain, or the browser will block the app's requests.

## 3. Google sign-in (only if you want it)

Follow the README. Then set the consent screen to **published** (testing mode only lets named test users in), add your site's address as an authorised domain, and fill in the
privacy and terms links (`/privacy` and `/terms`). Add `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as an authorised redirect URI in Google, and paste the client id and secret into Supabase.
Only then set `VITE_GOOGLE_AUTH=true`. The health check fails if the button is on and Google is not enabled.

## 4. Vercel

1. Import the GitHub repository. No framework settings are needed. Node 20 or newer.
2. Environment variables. Set each for **Production** (and Preview if you test there). `VITE_` ones are baked in at build time, so redeploy after changing them.

| Variable | Needed for | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Accounts, crews, saving across devices | No, public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | Weekly email, account deletion, health check | **Yes** |
| `CRON_SECRET` | Protects the daily job and the health check. 24+ random characters | **Yes** |
| `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`) | Live AI drafts. Without one, drafts come from the offline template | **Yes** |
| `RESEND_API_KEY` or `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FOOTER` | Weekly summary email | **Yes** (key) |
| `SITE_URL`, `VITE_SITE_URL` | Email links, link previews | No |
| `VITE_CONTROLLER_NAME`, `VITE_CONTROLLER_ADDRESS`, `VITE_CONTACT_EMAIL`, `VITE_DATA_REGION` | Names you on the privacy and terms pages | No |
| `WAITLIST_WEBHOOK_URL` | The front-page update list. Hidden if unset | Treat as secret |
| `VITE_PLAN_*`, `VITE_PLAN_PRICE_NGN`, `VITE_PLAN_URL_NGN` | Pricing page | No |
| `VITE_GOOGLE_AUTH`, `VITE_GOVERNING_LAW` | Google button, terms wording | No |
| `QUICK_DRAFT_DAILY_LIMIT`, `QUICK_DRAFT_GLOBAL_CAP` | Limits on the front-page quick draft | No |
| `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot protection (set both or neither) | Site key no, secret **yes** |
| `FEEDBACK_WEBHOOK_URL` | Where the help form sends messages. Without it the page shows your email | Treat as secret |
| `ERROR_WEBHOOK_URL` | Alerts when a visitor's browser hits an error (Slack, Discord, Zapier, Make) | Treat as secret |
| `VITE_SITE_URL` | Also drives the sitemap, canonical tags and link-preview images | No |

3. Domain: add your domain in Vercel and follow its DNS steps. HTTPS is automatic. The app sends a strict transport security header for a year, so only use a domain you will keep.
4. The daily weekly-email job (`vercel.json`) runs on production deployments only, once a day.
5. Spending: set a spend limit or alert in Vercel, and quota or billing alerts with your AI provider. The front-page quick draft is open to anyone and spends your AI quota.
6. **Firewall rate limit.** The app limits requests itself, but those counters live in server memory and reset on restart. Add a rate limit rule in Vercel's firewall for `/api/*` and for the
   app's server-function requests, so one visitor cannot hammer you.
7. Keep preview deployments private (Vercel's deployment protection), so unfinished builds with real keys are not public.

## 5. AI provider

- Gemini's free tier is fine for testing. It has low limits, it may change, and Google says free-tier content may be used to improve its products. For real customer messages use a paid tier with
  terms you are comfortable with, and keep the consent notice and masking.
- Run `GEMINI_API_KEY=... npm run eval` with real messages from your own shop in `evals/samples.json` before you promote the site, and again after any prompt or model change.

## 6. Email deliverability (for the weekly summary)

Verify your sending domain with your email provider and add the SPF, DKIM and DMARC records it gives you. Without them the weekly email and Supabase's sign-in emails go to spam. Free plans have daily caps
(see the README), and `WEEKLY_MAX_PER_RUN` keeps each run under them. Press "Send me one now" in your account to see exactly what people get.

## 7. Payments (optional)

Create a payment link with Paystack or Selar, and set `VITE_PLAN_PRICE_NGN` and `VITE_PLAN_URL_NGN` (and a dollar price if you want one). The app has no billing system of its own. The pricing page promises no
per-message charges and no contract in the app, so keep your real plan consistent with that. Check any competitor price you quote yourself.

## 8. Legal and compliance (not legal advice)

- Have a Nigerian data protection lawyer or a licensed compliance organisation review `/privacy`, `/terms` and `docs/COMPLIANCE.md` before launch.
- Check whether you must register with the Nigeria Data Protection Commission. Guidance reported for 2024 uses low thresholds (more than 200 people in six months), so assume you will reach it.
- Accept the data processing terms of Supabase, Vercel, your AI provider and your email provider, and keep copies.
- Set up a mailbox for data requests and complaints (`VITE_CONTACT_EMAIL`) and decide who answers within a month. Write down a breach plan (the 72-hour rule is in `docs/COMPLIANCE.md`).
- If you will use shared examples to train anything, decide how long you keep them and who may run the export (`docs/TRAINING.md`).

## 9. Monitoring

- Add an uptime monitor (UptimeRobot, Better Stack and similar) on `https://YOUR-SITE/api/health` without a key.
- Turn on Vercel and Supabase email alerts for errors and usage. Look at the logs the first week.
- Put `curl` of the health check, with your key, on your own calendar monthly.

## 9b. Search, sharing and backups

- Search: after you deploy, verify your domain in Google Search Console and Bing Webmaster Tools and submit `https://YOUR-SITE/sitemap.xml`. Check the home page in Google's Rich Results Test (it should find the FAQ), and paste your address into a chat app to see the link preview. `VITE_SITE_URL` must be set for canonical tags and the preview image.
- Reports: `/.well-known/security.txt` appears once `VITE_CONTACT_EMAIL` is set, so researchers know how to reach you.
- Backups: run `BACKUP_PASSPHRASE='a long passphrase' npm run backup` (with `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` set) on a schedule you will actually keep, for example weekly. The file is encrypted, holds personal data, and lands in `backups/`, which is never committed. Keep the passphrase somewhere other than next to the file. Practise a restore once with `npm run restore -- backups/FILE` (a dry run), because an untried backup is only a hope. It restores into the same project, and sign-in accounts themselves stay in Supabase.

## 10. The ten-minute test before you tell anyone

1. On a real phone, open the site, run the quick draft with a real message, and check the draft and the brackets.
2. Sign up with a real email, confirm it, build a week, add shop facts, draft with live AI, and open WhatsApp from the send button.
3. Install the app on an Android phone and try Share into Kindling from another app. This could not be tested for you.
4. Turn on the weekly email, press "Send me one now", then use the unsubscribe link.
5. Start a crew, invite a second account, and edit from both.
6. Delete a test account from the account page and check the health check still passes.
7. Read the privacy and terms pages as a customer would.

## What is deliberately not built, so you are not surprised

- Password reset and the bot check are built, but I could only test them against stand-ins for Supabase and Cloudflare. Try a real reset email and a real sign-up on your live site before you promote it.
- Rate limits are per server instance and in memory (see step 6 of part 4).
- The security policy allows inline scripts, because the framework needs them to start the page. Everything else is locked to your own site, Supabase and Cloudflare's check.
- No welcome email and no status page (an uptime monitor on `/api/health` covers the second). No automatic deletion of long-inactive accounts, and no server-side record of the AI-drafting agreement, which is kept in the person's browser.
- Sharing from other apps on Android has never been tried on a real phone.
- Real Gemini, Supabase, Google and email services were not available to me. Everything was tested against stand-ins that behave like them, so your first live test matters.
