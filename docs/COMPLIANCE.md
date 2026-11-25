# Kindling: data protection checklist for the site owner

This is a working checklist, not legal advice. Laws, thresholds and guidance change. Have a Nigerian data protection
lawyer or a licensed Data Protection Compliance Organisation (DPCO) confirm each item, and review it again before launch
and every year. If you have users in the EU or UK, the GDPR and UK GDPR can apply as well.

## 1. Decide who you are
- You (or your company) are the **data controller**: you decide why and how people's data is used.
- Supabase, Vercel, your AI provider and your email provider are **processors**.
- Set these in Vercel so the privacy page names you: `VITE_CONTROLLER_NAME`, `VITE_CONTROLLER_ADDRESS`,
  `VITE_CONTACT_EMAIL`, and `VITE_DATA_REGION` (the Supabase region you picked). Redeploy afterwards.

## 2. Registration with the Nigeria Data Protection Commission (NDPC)
- The Nigeria Data Protection Act 2023 (NDPA) requires controllers and processors "of major importance" to register.
- The NDPC's February 2024 guidance, as summarised by KPMG, treats a controller as of major importance if it handles the
  data of **more than 200 people in six months** (among other tests). Other summaries mention 2,000 people for the annual
  audit. These numbers are low, so assume you may reach them quickly.
- If you are of major importance you must register, appoint a Data Protection Officer (DPO), and file an annual compliance
  audit through a licensed DPCO. Ask your DPCO to confirm which tests apply to you today.

## 3. Privacy notice (NDPA s.27)
- The `/privacy` page is the notice. Check it states, correctly for your setup: who you are, what you collect, why, the
  legal basis, who receives it, transfers outside Nigeria, how long you keep it, people's rights and how to complain.
- Re-read it whenever you add a provider or a feature. The page lists AI and email providers automatically from your
  settings, but it cannot know about tools you add yourself (for example the list tool behind the update form).

## 4. Consent
- Consent must be freely given, specific and provable, and withdrawing it must be as easy as giving it. Pre-ticked boxes
  do not count.
- What Kindling does: AI drafting asks once before the first draft; the weekly email and the update list use unticked
  boxes; the account form asks people to confirm they are 18 or over and have read the notice.
- The weekly email records `consented_at` in the `kindling_prefs` table. The update list sends a `consent` object to your
  webhook, so store it in your list tool. The AI agreement is kept only in the person's browser. If your lawyer wants a
  server-side record of it, say so and it can be added.

## 5. People's rights
| Right | Where in the app |
| --- | --- |
| Access and portability | Privacy page download, Account, Download my data |
| Correction | Edit in the app |
| Erasure | Account: Delete my saved copy, Delete my account (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| Withdraw consent | Account weekly email box, unsubscribe link, Privacy page AI withdrawal |
| Complaint | Privacy page names the NDPC |
- Answer requests that arrive by email within one month. Keep a note of each request and what you did.

## 6. Processor agreements and transfers
- Accept the data processing terms offered by Supabase, Vercel, your AI provider and your email provider, and keep copies.
- Your data is processed outside Nigeria. Record the reason it is allowed (adequate protection or safeguards such as the
  providers' contractual terms) and keep it with these notes.
- Choose the Supabase region deliberately and put it in `VITE_DATA_REGION`.
- Free AI tiers (including Google's free Gemini tier) may use prompts to improve products. Either use a paid tier with
  stronger terms for real customer data, or leave the notice and the masking in place and keep the warning to users.

## 7. Security
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` or email API keys in any variable starting with `VITE_`. Those are
  public. Set them only as normal Vercel environment variables.
- Turn on two-factor sign-in for your Vercel, Supabase, GitHub, Google and email-provider accounts.
- Rotate keys if a laptop is lost or someone leaves.
- Row Level Security is on for every table (`supabase/schema.sql`). Do not turn it off.

## 8. If something goes wrong (breach plan)
Under the NDPA a breach likely to put people's rights and freedoms at risk must be reported to the NDPC **within 72 hours of
becoming aware of it**, and people must be told without undue delay when the risk is high.
1. Contain it: rotate keys, remove access, take the affected part offline if needed.
2. Write down the time you became aware, what happened, which data and roughly how many people.
3. Decide with your lawyer or DPO whether to notify. Notify within 72 hours if in doubt.
4. The notice to the NDPC covers: what happened, the kinds of data and approximate number of people, likely consequences,
   what you have done and will do, and who to contact.
5. Tell affected people in plain words what happened and what they can do (for example change a password).
6. Keep a record of every breach, including ones you decide not to report.

## 9. Weekly email rules
- Send only to people who ticked the box. The email has an unsubscribe link and a one-click unsubscribe header.
- Set `EMAIL_FOOTER` to your business name and postal address. Some countries require it on commercial email.
- Use a verified sending domain. Resend's free plan allows 100 emails a day; Brevo's allows 300.

## 10. Data added by later features
- **Shop facts** (hours, address, payment link and so on) and **saved example messages** are stored in the person's saved week, and
  the most recent ones go to the AI provider with each draft after private-looking details are masked. The facts page tells people to
  keep to things they would put on a notice board, and to use a payment link, never a bank account number.
- **Shared text** (Android Share menu) arrives in the note box through the `/share` page and is handled like any other note.
- Saved examples are masked when saved and can be deleted one by one on the Shop facts tab. They are removed with the account.
- Add both to your data inventory and to any processor records for your AI provider.

## 11. The training data layer and the front-page quick draft
- **Training data** is opt-in and per example. The consent record is `kindling_training_consent` (with a timestamp and a policy version).
  Switching consent off deletes the person's examples by a database trigger, and deleting the account deletes them too.
- Examples are masked in the browser (card, ID, account numbers, emails, phones, passwords, and a pattern guess at names) and the person
  previews and edits them. Name masking will miss some names, so keep the preview step.
- The export (`npm run export-training`) needs your service role key. Decide who may run it, keep the exported files off shared drives, delete
  them after training, and do not commit `data/exports/`. The files carry a one-way cohort code, not user ids.
- Decide and write down how long you keep shared examples, and whether you would delete examples older than that. The app deletes on
  withdrawal and account deletion only.
- Using customer messages to train a model is a new purpose. Ask your adviser whether you need a data protection impact assessment, and update
  your records of processing and your processor list if you send exported data to any fine-tuning service.
- **Quick draft box:** it sends one pasted message to your AI provider after the visitor agrees, and stores nothing. It is limited per visitor
  and in total (`QUICK_DRAFT_DAILY_LIMIT`, `QUICK_DRAFT_GLOBAL_CAP`), but those counters live in server memory. Add a rate limit in your host's
  firewall too.
- **Local languages:** the app tells people to have a speaker read non-English drafts. Keep that reminder.

## 12. Usage counts, error reports, the help form and the security check
- **Usage counts** (`kindling_event_counts`) store only a count of each event per day. No user id, IP address or cookie goes with them. The app skips
  counting when the browser sends Do Not Track or Global Privacy Control. Because nothing identifies anyone, no cookie banner is needed for them.
  If you add any analytics that does identify people, that changes and you need consent.
- **Error reports** go to your server log and, if you set `ERROR_WEBHOOK_URL`, to that channel. Messages and stack lines have web addresses cut to paths and
  private-looking details masked, but treat the channel as containing technical data and keep it private.
- **The help form** forwards what people write to `FEEDBACK_WEBHOOK_URL`. Decide where that lands, who can read it, and how long you keep it. People may type
  personal details despite the warning, so deleting a message on request must be possible in that tool.
- **Cloudflare Turnstile** (if you switch it on) receives visitors' IP addresses and browser signals. Add Cloudflare to your list of processors and mention it in the privacy page
  (the page does this automatically when the site key is set).

## 13. Things this app does not do
- It keeps no consent log for anonymous AI use, no retention clock that deletes old accounts, and no data protection
  impact assessment. If you grow, ask your DPCO whether you need a DPIA and an inactivity-deletion rule.
- It does not detect or prevent every private detail in pasted notes.
