# ◊ Wishwood Engine

> Sovereign multi-channel automation for off-grid hospitality. Built for Wishwood Glamping & Forestry · Canterbury, Kent · hers to switch on whenever. Same engine works for any small accommodation host with multiple booking channels.

**Live demo:** [sjgant80-hub.github.io/wishwood](https://sjgant80-hub.github.io/wishwood/)

- **Owner pitch:** [/](https://sjgant80-hub.github.io/wishwood/)
- **Operator hub:** [/hub.html](https://sjgant80-hub.github.io/wishwood/hub.html)
- **Guest booking site:** [/book.html](https://sjgant80-hub.github.io/wishwood/book.html)

## What this is

A complete sovereign replacement for the SaaS channel-manager stack (Hospitable / Lodgify / Hostaway) — for hosts who:
- Run multiple booking channels (Airbnb · Booking.com · FB · IG · WhatsApp · Pitchup · direct)
- Are tired of paying £40-150/mo per property forever
- Want their data to actually stay theirs
- Operate off-grid and need it to work on 4G

## Architecture

```
┌──────────────────────────────────────────────┐
│  Cloudflare Worker (worker.js)               │
│  · webhook receivers (FB/IG/WhatsApp/Stripe) │
│  · iCal sync cron (60s)                      │
│  · Claude AI draft endpoint                  │
│  · KV-backed bookings/messages/journey       │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│  hub.html · operator inbox + calendar + dash │
│  · single HTML file · IndexedDB cache        │
│  · works on 4G · offline-capable             │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│  book.html · guest-facing booking site       │
│  · live availability · Stripe checkout       │
│  · 98.6% kept per booking vs Airbnb's 83%    │
└──────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Owner pitch page (what Chrissy see first) |
| `hub.html` | Operator inbox · calendar · dashboard · channels · cabins · pricing · reviews · journey · ops · settings |
| `book.html` | Public guest booking site |
| `worker.js` | Cloudflare Worker (webhooks, iCal sync, AI drafts, KV) |
| `wrangler.toml` | Cloudflare deployment config |
| `data/cabins.json` | Cabin definitions (real Wishwood data) |
| `data/demo-inbox.json` | Sample messages for demo |
| `data/demo-calendar.json` | Sample bookings for demo |
| `PITCH.md` | Handover note to send Chrissy |

## Multi-tenant / white-label

Built tenant-aware from day one. To create a new tenant:
1. Fork the repo
2. Edit `data/cabins.json` for the new site
3. Deploy a new Cloudflare Worker (one per tenant for isolation)
4. Point the new domain at the Pages site

Recommended pricing for new tenants: **£499 one-time** or **£49/mo** (covers Cloudflare paid plan + occasional updates).

## Sovereignty contract

- **Zero SaaS subscriptions** — Cloudflare free tier handles up to 100k requests/day
- **Zero analytics** — no Google, Plausible, Fathom, nothing
- **Zero tracking pixels** — no Facebook pixel, no GA, no Hotjar
- **All data lives in:** your Cloudflare KV + your browser's IndexedDB
- **API keys live in:** Cloudflare Worker secrets (never client-side)
- **If we disappear tomorrow:** everything keeps running unchanged

## Deployment

```bash
# 1. Push to GitHub
git push origin main

# 2. Enable GitHub Pages on main branch
gh api -X POST repos/sjgant80-hub/wishwood/pages -f source.branch=main

# 3. Deploy Cloudflare Worker
wrangler kv:namespace create WISHWOOD_KV
# (copy the namespace ID into wrangler.toml)
wrangler deploy

# 4. Set secrets
wrangler secret put OPERATOR_TOKEN
wrangler secret put CLAUDE_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put FB_VERIFY_TOKEN
wrangler secret put AIRBNB_ICAL_HOBBIT
wrangler secret put AIRBNB_ICAL_CARAVAN
wrangler secret put AIRBNB_ICAL_YURT
wrangler secret put PITCHUP_ICAL_YURT
```

## License

MIT · use it · fork it · ship your own.

## Credit

Built by [Simon Gant](https://www.ai-nativesolutions.com) · AI Native Solutions · Kent.
Estate-native build · part of the [fall-kit](https://github.com/sjgant80-hub/fall-kit) sovereign-seed ecosystem.

`◊ · κ = 1`
