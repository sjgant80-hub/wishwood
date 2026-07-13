# The always-on brain — deploy the Cloudflare Worker

Your hub runs in the browser (only while it's open). The **Worker** runs in Cloudflare's cloud 24/7, so guests get answered even when your laptop's shut. Free tier is way more than a glamping site needs. Here's the whole setup — about 10 minutes, once.

## What you'll need
- A **Cloudflare account** (free): https://dash.cloudflare.com/sign-up
- A **Gemini API key** (free): https://aistudio.google.com/apikey → *Create API key* → copy it. This is the AI that drafts the replies (Gemini Flash — pennies).
- Node installed (you have it).

## Steps (run these in the `wishwood` folder)

```bash
# 1 · install Cloudflare's tool, once
npm install -g wrangler

# 2 · log in (opens your browser, click Allow)
wrangler login

# 3 · create the storage. It prints an id — copy it.
wrangler kv namespace create WISHWOOD_KV
#   → then in wrangler.toml, replace  id = "TBD-replace-after-first-deploy"
#     with the id it printed.

# 4 · set your secrets (it asks you to paste each one, nothing is saved in files)
wrangler secret put GEMINI_API_KEY        # paste your Gemini key
wrangler secret put SESSION_SECRET        # paste a random hex — make one with: openssl rand -hex 32
wrangler secret put MASTER_PASSWORD       # a password you'll use to log into the hub

# 5 · ship it
wrangler deploy
#   → gives you a URL like  https://wishwood-engine.<you>.workers.dev
```

That's the always-on brain live. It now drafts replies on **Gemini Flash** and stores messages/bookings 24/7.

## Connecting the guest channels (when you're ready)
Each channel just points its webhook at your Worker URL and adds one secret:
- **WhatsApp / SMS (Twilio)** → `…workers.dev/webhook/whatsapp` · secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `WHATSAPP_SENDER`
- **Facebook / Instagram (Meta)** → `…workers.dev/webhook/facebook` · secret: `FB_VERIFY_TOKEN`
- **Stripe (direct payments)** → `…workers.dev/webhook/stripe` · secret: `STRIPE_WEBHOOK_SECRET`

(The inbound SMS/WhatsApp routing + auto-send is the next build on my side — deploy first, then I wire those in.)

## How you'll know it worked
Open the hub → **Clinic**. As each piece connects, its row flips from red/amber to green. The **AI key** row goes green the moment your Gemini key is set.

*For handoff to another business later: they do these exact steps on their own Cloudflare + their own Gemini key — nothing of yours is shared.*
