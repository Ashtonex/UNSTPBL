# Text messages (SMS) and visitor follow-up

This explains what the messaging feature does, how it keeps people safe, and how to go
from **test mode** to sending real texts.

## What it does

| Who | What | How |
| --- | --- | --- |
| Visitors | A thank-you text after their first visit | An usher adds them on **Bishop → Visitors** and ticks the consent box |
| Visitors | Follow-up tracking | Visit count, "here again today", and a New / Contacted / Returning / Member status |
| Members | Announcements, the daily verse, a birthday blessing | Each member switches on what they want under **Profile → Text messages** |
| Leaders | Send an announcement | **Bishop → Text messages**: write, preview who it reaches and what it costs, confirm, send |

## Changing the wording

**Bishop → Text messages → Change what the thank-you, birthday and daily verse texts say** (or **Bishop → Message wording**)
lets a bishop or admin edit the three standing texts. Drop in `{first_name}`, `{church}`, and for the daily verse
`{reference}` and `{verse}` with the buttons; a live preview shows the finished text, its length in segments and its
cost. **Reset to original** restores the built-in wording. Notes:

- "Reply STOP to opt out." is always added by the system and cannot be removed (typing it yourself is harmless; it is not doubled).
- The daily verse must contain `{verse}`, and is shortened automatically so it never exceeds two segments.
- Changes apply to the next text sent. Texts already sent are unchanged, and every change is recorded in the audit log.
- Needs migration `0007_message_templates.sql`. Without it the built-in wording is used and nothing breaks.
- One-off announcements are still written on the Text messages page. WhatsApp wording is not covered (WhatsApp is not built yet).

## Test mode (the default)

Until `SMS_PROVIDER` is set, nothing is sent and nothing is charged. Every screen works as
normal and every message is recorded in the history marked **Test mode**, so you can rehearse
the whole flow. A banner on the Visitors and Text messages screens says which mode you are in.

## Safety built in

- **Consent first.** Members are texted only for topics they switched on themselves (all off by
  default). Visitors are texted only if the consent box was ticked.
- **STOP is honoured.** Replying STOP (or UNSUBSCRIBE, CANCEL, END, QUIT) blocks all further
  texts to that number. START resumes them. Every message ends with "Reply STOP to opt out."
- **Monthly cap.** `SMS_MONTHLY_SEGMENT_CAP` (default 300) is a hard ceiling on real texts per
  month. Sending stops when it is reached.
- **Preview and confirm.** A leader sees the exact message, the number of recipients and the
  estimated cost before anything goes out, and must confirm. If the audience changes between
  preview and send, the send is refused.
- **No double sends.** The same message to the same audience within two minutes is rejected, and
  a visitor's welcome text can only ever be sent once.
- **Limits.** At most 500 people per send, 4 segments per message. Staff only: only bishops and
  admins can send or manage visitors.
- **Everything is logged** (who, what, status, cost) in `message_log`.

### Why messages are short

You pay per *segment*: 160 plain characters, or 70 if the text contains a curly quote, em dash or
emoji. The app converts those to plain characters automatically, and trims a verse to fit two
segments.

## Going live

1. **Apply the database migration** `packages/db/migrations/0006_sms_and_visitors.sql` (new tables
   only, nothing existing is changed). The Visitors and Text messages links stay hidden on the
   Bishop dashboard until the database is ready.
2. **Choose a provider and get a price.** Ask for the per-SMS price to Econet, NetOne and Telecel,
   whether they have direct local routes, and who registers the sender name (a registered sender
   ID is required for local routes in Zimbabwe; confirm the process with POTRAZ).
3. **Set these on the API host (Render → Environment).** Twilio is built in:

   | Variable | Meaning |
   | --- | --- |
   | `SMS_PROVIDER` | `twilio` (leave unset or `dryrun` for test mode) |
   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | From the Twilio console |
   | `TWILIO_MESSAGING_SERVICE_SID` | A Messaging Service (or use `TWILIO_FROM` for a sender) |
   | `PUBLIC_API_URL` | The API's public https address, e.g. `https://unstpbl-api.onrender.com` |
   | `SMS_COST_PER_SEGMENT_USD` | Your price per segment, so previews show a cost |
   | `SMS_MONTHLY_SEGMENT_CAP` | Your monthly ceiling, set deliberately |
   | `CHURCH_NAME` | Shown in messages (defaults to Victory Tabernacle City Mutare) |

4. **Point the provider's webhooks at the API** so STOP replies and delivery receipts are recorded:
   - Incoming messages: `POST {PUBLIC_API_URL}/webhooks/sms/twilio/inbound`
   - Status callback: `POST {PUBLIC_API_URL}/webhooks/sms/twilio/status`

   Both are verified with the provider's signature; unsigned requests are rejected.
5. **Send yourself a test** with **Text me a test** (it uses the number on your profile) before
   texting anyone else.
6. For the daily verse and birthday texts to run on their own, add the `CRON_SECRET` repository
   secret to GitHub (see `.github/workflows/keepalive.yml`).

A different provider (for example a local Zimbabwean aggregator) can be added by writing one small
adapter in `packages/api/src/lib/sms/providers/`; nothing else needs to change.

## Running it day to day

- **Visitors:** add each guest once. Entering the same number again records a return visit instead
  of a duplicate.
- **Cost:** `Estimated cost = recipients x segments x SMS_COST_PER_SEGMENT_USD`.
- **Someone says they never agreed:** they can switch texts off under Profile, or reply STOP.
- **Public sign-up forms** (for example a QR code visitors scan) are deliberately not included: an
  open form can be abused to text strangers at the church's expense. Add one only with number
  verification (a one-time code) in front of it.
