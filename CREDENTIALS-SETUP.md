# Wishwood · Credentials + Config Checklist

**For Chrissy** (Wishwood operator) and Simon (build). Fill in each `<paste here>` as you gather it. When every **MUST-HAVE** row is filled, we go live.

**Print or copy this whole file** · work through it top-to-bottom · items are ordered by what unlocks the most (booking flow first, then comms, then admin).

---

## 1 · Direct booking · Stripe

**MUST-HAVE to accept direct bookings via `book.html`.**

| What | Where to get it | Value |
|---|---|---|
| Stripe account exists? | https://dashboard.stripe.com/register | Yes / No |
| Business legal name (on Stripe) | On Stripe dashboard → Business settings | `<paste>` |
| Stripe **publishable** key (live) | Dashboard → Developers → API keys → `pk_live_...` | `<paste>` |
| Stripe **secret** key (live) | Dashboard → Developers → API keys → `sk_live_...` | `<paste>` |
| Stripe **publishable** key (test) | `pk_test_...` | `<paste>` |
| Stripe **secret** key (test) | `sk_test_...` | `<paste>` |
| Stripe **webhook signing secret** (live) | Developers → Webhooks → Add endpoint · point at `https://wishwood.co.uk/api/stripe-webhook` (or the Cloudflare Worker URL from §7) | `<paste>` |
| Refund / payout bank account confirmed | Dashboard → Payouts | Yes / No |

**Env vars:**
```
STRIPE_PK_LIVE=<paste>
STRIPE_SK_LIVE=<paste>
STRIPE_PK_TEST=<paste>
STRIPE_SK_TEST=<paste>
STRIPE_WEBHOOK_SECRET=<paste>
```

---

## 2 · Channel manager integrations (booking flow IN)

### Booking.com

**MUST-HAVE if listed on Booking.com.**

Booking.com's Partner API is gated — most small operators use the iCal export instead.

| What | Where to get it | Value |
|---|---|---|
| Booking.com **Extranet** login | https://admin.booking.com/ | Confirmed working: Yes / No |
| Property ID (numeric) | Extranet URL — the digits after `/hotel/gb/` | `<paste>` |
| **iCal export URL** (per unit — Hobbit Hut, Vintage Caravan, etc.) | Extranet → Property → Rates & Availability → Sync calendars → Export | `<paste unit 1>` · `<paste unit 2>` · `<paste unit 3>` · `<paste unit 4>` |
| **iCal import** — the URL Wishwood will publish for Booking.com to hit | (Wishwood generates this: `https://wishwood.co.uk/cal/<unit-slug>.ics`) | Auto-generated |

**Env vars:**
```
BOOKING_ICAL_HOBBIT=<paste>
BOOKING_ICAL_CARAVAN=<paste>
BOOKING_ICAL_YURT=<paste>
BOOKING_ICAL_SURF=<paste>
```

### Airbnb

**MUST-HAVE if listed on Airbnb.**

Airbnb has no direct API for small operators — iCal only.

| What | Where to get it | Value |
|---|---|---|
| Airbnb host account login | https://www.airbnb.co.uk/ (as host) | Confirmed working: Yes / No |
| **iCal export URL** per listing | Listing → Availability → Availability settings → Sync calendars → Export | `<paste unit 1>` · `<paste unit 2>` · `<paste unit 3>` · `<paste unit 4>` |

**Env vars:**
```
AIRBNB_ICAL_HOBBIT=<paste>
AIRBNB_ICAL_CARAVAN=<paste>
AIRBNB_ICAL_YURT=<paste>
AIRBNB_ICAL_SURF=<paste>
```

### Agoda

**Only if listed on Agoda.**

Agoda's channel-manager API (YCS) is enterprise-only — small operators use their channel-manager partner (e.g. through Nextpax or manually).

| What | Where to get it | Value |
|---|---|---|
| Listed on Agoda? | | Yes / No |
| Agoda YCS access confirmed? | https://ycs.agoda.com/ | Yes / No |
| Property code | YCS dashboard | `<paste>` |
| Agoda **iCal export URLs** if available | YCS → Property → Calendar → Sync | `<paste>` |

**Env vars:**
```
AGODA_ICAL_HOBBIT=<paste or leave blank if not on Agoda>
```

---

## 3 · WhatsApp Business API (for AI-drafted replies)

**MUST-HAVE to unify guest comms.** Choose one provider:

### Option A · Twilio (easiest onboarding)

| What | Where to get it | Value |
|---|---|---|
| Twilio account | https://www.twilio.com/console | Signed up: Yes / No |
| Twilio **Account SID** | Console → dashboard | `<paste>` |
| Twilio **Auth Token** | Console → dashboard (hide/show) | `<paste>` |
| WhatsApp sender number | Console → Messaging → WhatsApp senders (needs business verification, ~1-2 weeks) | `<paste E.164 e.g. +447XXX>` |
| Webhook URL (Twilio → Wishwood) | Configure in Twilio: `https://wishwood.co.uk/api/wa-webhook` | Auto-set |
| Webhook verify token (Wishwood → Twilio) | Simon generates: 32-char random string | `<paste>` |

**Env vars:**
```
TWILIO_ACCOUNT_SID=<paste>
TWILIO_AUTH_TOKEN=<paste>
WHATSAPP_SENDER=<paste E.164>
WA_WEBHOOK_VERIFY_TOKEN=<paste 32-char random string>
```

### Option B · Meta Cloud API direct (cheaper long-term)

| What | Where to get it | Value |
|---|---|---|
| Meta Business account | https://business.facebook.com/ | Confirmed: Yes / No |
| WhatsApp Business Account (WABA) ID | Business Manager → WhatsApp Accounts | `<paste>` |
| Phone Number ID | WhatsApp Manager → the number | `<paste>` |
| **Permanent access token** | Business Settings → System Users → Generate Token | `<paste>` |
| App ID | developers.facebook.com → your app | `<paste>` |
| App Secret | developers.facebook.com → your app → settings | `<paste>` |
| Webhook verify token | Simon generates | `<paste 32-char>` |

**Env vars (Option B):**
```
META_WABA_ID=<paste>
META_PHONE_NUMBER_ID=<paste>
META_ACCESS_TOKEN=<paste>
META_APP_ID=<paste>
META_APP_SECRET=<paste>
WA_WEBHOOK_VERIFY_TOKEN=<paste>
```

---

## 4 · SMS (fallback + confirmations)

**NICE-TO-HAVE.** Some guests don't use WhatsApp. Uses same Twilio account as §3A.

| What | Where to get it | Value |
|---|---|---|
| Twilio SMS phone number (UK) | Twilio Console → Phone Numbers → Buy (~£1/mo) | `<paste E.164 e.g. +447XXX>` |
| Message-service SID (optional grouping) | Twilio → Messaging Services | `<paste or leave blank>` |

**Env vars:**
```
SMS_FROM_NUMBER=<paste E.164>
SMS_MESSAGING_SID=<paste or leave blank>
```

---

## 5 · Email · sending (booking confirmations, reminders)

**MUST-HAVE.** Pick one:

### Option A · Resend (easiest for developers)

| What | Where to get it | Value |
|---|---|---|
| Resend account | https://resend.com/ | Signed up: Yes / No |
| API key | Dashboard → API Keys | `<paste re_...>` |
| Verified sender domain | Dashboard → Domains → add `wishwood.co.uk` → add DNS records | Verified: Yes / No |
| From address | Something like `bookings@wishwood.co.uk` | `<paste>` |

### Option B · SendGrid

| What | Where to get it | Value |
|---|---|---|
| SendGrid account | https://sendgrid.com/ | Yes / No |
| API key | Settings → API Keys → Create | `<paste SG.___>` |
| Verified sender | Marketing → Senders → Verify | Verified: Yes / No |
| From address | `<paste>` | |

**Env vars (whichever picked):**
```
EMAIL_PROVIDER=resend            # or sendgrid
EMAIL_API_KEY=<paste>
EMAIL_FROM=bookings@wishwood.co.uk
```

---

## 6 · Email · receiving (guest replies)

**NICE-TO-HAVE.** So AI inbox can pull inbound guest emails into the unified feed.

**Simplest path:** forward everything to a mailbox and use inbound-parse:

| What | Where to get it | Value |
|---|---|---|
| Real inbox (any provider) | Google Workspace / Zoho / whatever Chrissy uses today | `<paste address>` |
| App password (for IMAP fetch) | Provider's security settings → App passwords | `<paste>` |
| OR · Resend Inbound webhook | Resend → Domains → Inbound → add hostname `inbound.wishwood.co.uk` | Set up: Yes / No |
| OR · SendGrid Inbound Parse | SendGrid → Settings → Inbound Parse | Set up: Yes / No |

**Env vars:**
```
INBOUND_MAILBOX=<paste address>
INBOUND_MAILBOX_PASSWORD=<paste app password>
INBOUND_IMAP_HOST=imap.gmail.com          # or imap.zoho.com etc
INBOUND_IMAP_PORT=993
```

---

## 7 · Cloudflare (webhooks live here · free tier is fine)

**MUST-HAVE if any of §3, §5, §6 need webhook endpoints.** GitHub Pages doesn't do server-side.

| What | Where to get it | Value |
|---|---|---|
| Cloudflare account | https://dash.cloudflare.com/sign-up | Yes / No |
| Zone (domain) added to Cloudflare | Dashboard → Websites → Add site (`wishwood.co.uk`) | Yes / No |
| Zone ID | Dashboard → Overview (right sidebar) | `<paste>` |
| Account ID | Same sidebar | `<paste>` |
| API token · scope: Workers Scripts Edit + KV Edit | https://dash.cloudflare.com/profile/api-tokens → Create Token | `<paste>` |
| Worker name | Simon picks · e.g. `wishwood-api` | `<paste>` |
| KV namespace (for state) | Workers → KV → Create · e.g. `WISHWOOD_STATE` | Namespace ID: `<paste>` |

**Env vars:**
```
CF_ACCOUNT_ID=<paste>
CF_ZONE_ID=<paste>
CF_API_TOKEN=<paste>
CF_WORKER_NAME=wishwood-api
CF_KV_NAMESPACE_ID=<paste>
```

---

## 8 · Domain + DNS

**MUST-HAVE.**

| What | Where to get it | Value |
|---|---|---|
| Domain registered? | Wherever bought (GoDaddy, 123-Reg, Namecheap, etc.) | `<paste registrar>` |
| Domain: `wishwood.co.uk` or `wishwood.org` or...? | | `<paste>` |
| Nameservers pointed at Cloudflare? | Cloudflare → Overview → Change your nameservers | Confirmed: Yes / No |
| DNS records set up so far | GitHub Pages A records? MX for email? | List each: `<paste>` |

**Records needed once ready:**
- `@` (root) → GitHub Pages IPs (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153)
- `www` → CNAME `sjgant80-hub.github.io`
- `api` → CNAME `wishwood-api.workers.dev` (for webhooks)
- `MX` → email provider's MX records (Resend / Zoho / etc.)
- `TXT` for SPF + DKIM (email provider gives these)

---

## 9 · Optional AI keys (for reply drafting)

**NICE-TO-HAVE.** The dashboard can draft replies in Chrissy's voice. Requires an LLM key.

| What | Where to get it | Value |
|---|---|---|
| Anthropic API key (Claude) | https://console.anthropic.com/ → API Keys | `<paste sk-ant-...>` |
| OR OpenAI API key | https://platform.openai.com/api-keys | `<paste sk-...>` |

**Env vars:**
```
ANTHROPIC_API_KEY=<paste or leave blank>
OPENAI_API_KEY=<paste or leave blank>
```

If both blank · Wishwood falls back to WebLLM (browser-native, free, slower). No blocker.

---

## 10 · Business + legal

**MUST-HAVE before WhatsApp Business verifies + before Stripe pays out.**

| What | Value |
|---|---|
| Registered business name | `<paste>` |
| Business address (for Stripe / Companies House) | `<paste>` |
| UTR / Companies House number if incorporated | `<paste or "sole trader">` |
| VAT registered? | Yes (VAT number: `<paste>`) / No |
| Public terms of service URL | `https://wishwood.co.uk/terms` — needs to exist |
| Public privacy policy URL | `https://wishwood.co.uk/privacy` — needs to exist |
| Contact phone for guests | `<paste>` |
| Contact email for guests | `<paste — usually bookings@wishwood.co.uk>` |

---

## 11 · Access · Chrissy's fingers

**MUST-HAVE for handover.**

| What | Value |
|---|---|
| Chrissy's Fiverr-style login for the admin dashboard (Simon sets password) | `<paste chosen password>` |
| Chrissy's phone number for WhatsApp Business + SMS | `<paste E.164>` |
| Chrissy's email for password recovery | `<paste>` |
| 2FA method (SMS / authenticator app / recovery codes stashed) | `<paste choice>` |

---

## 12 · Other platforms you might be using (gap section)

If you're on any of these, tell Simon which ones and paste whatever access details you have. Same pattern as the sections above — usually an iCal export URL, an API key, or a webhook secret.

**Other OTA / booking channels**
- Hostelworld · Expedia · VRBO / HomeToGo · Tripadvisor Rentals · Plum Guide · Sawday's · UniquelyBritain · Canopy & Stars · Cool Camping · Pitchup · Coolstays: `<paste iCal exports + any API creds>`
- Direct partners (village noticeboards, local tourism boards): `<paste any booking widget code>`

**Other messaging channels**
- Facebook Messenger (Meta): FB Page ID + Page access token → `<paste>`
- Instagram DM (Meta): Instagram Business Account ID + access token → `<paste>`
- Telegram: Bot token from @BotFather → `<paste>`
- Signal: Phone number for signal-cli setup → `<paste>`

**Other payment alternates**
- PayPal Business: Client ID + secret → `<paste>`
- Square: Access token + location ID → `<paste>`
- Klarna: API username + password → `<paste>`
- Bank transfer only: sort code + account number for QR-code payment info → `<paste>`

**Other useful integrations**
- Mailchimp / MailerLite (existing guest newsletter): API key → `<paste>`
- Google Calendar (personal calendar sync): OAuth token → `<paste>` (Simon runs the flow)
- Google Reviews / Trustpilot (auto-request review after stay): API key or embed URL → `<paste>`
- Smart-home (Sonos / Hue / smart lock for arrivals): API base URL + token → `<paste>`
- QuickBooks / Xero (auto-invoice booking to accounting): OAuth → `<paste>` (Simon runs)
- Zapier / Make (if you already have workflows you want to keep): webhook URL → `<paste>`

**Anything else** — just describe it in your own words at the bottom of the reply and Simon will figure out how to wire it:
`<paste any other platform / tool / integration you use daily>`

---

## 13 · What you send to Simon when done

Paste back the completed file as `SECRETS-FILLED.md` (do NOT commit to git · keep local or send via secure channel · Signal / iMessage / physical hand-off). Simon then:

1. Loads all `<paste>` values into a `.env` file on the Cloudflare Worker
2. Configures webhooks in Stripe, Twilio/Meta, email provider
3. Publishes DNS records
4. Runs the end-to-end test: fake booking on staging → confirms email → confirms WhatsApp reply
5. Flips to live · confirms with Chrissy · handover

---

## Priority order · what you can start now without Simon

You can gather these entirely on your own before Simon needs to touch anything:

1. **§1 Stripe** — sign up, get through Stripe Atlas / UK KYC (~1-2 days)
2. **§3A Twilio** — sign up, request WhatsApp sender (approval ~1-2 weeks · start early)
3. **§5A Resend** — sign up, add domain (~1 hour once DNS is set)
4. **§7 Cloudflare** — sign up, add domain (~30 min)
5. **§8 Domain** — check DNS records exist and point at Cloudflare (~15 min)
6. **§10 Business info** — you already know these

Send Simon the filled file whenever each section is complete · don't wait for all of them.

---

**◊·κ=1**  ·  MIT · Wishwood · 2026-07-02
