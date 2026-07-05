# Wishwood · AI-first architecture (scaffolding v1)

The property runs itself. Human oversight optional. Three layers:

## L1 · Seed Harvest → kernel.json

Aggregates the property's public + private footprint into a compact JSON kernel that grounds every LLM call. Prevents hallucination · encodes voice · captures policies.

Sources (adapter per source):
- Airbnb listing scrape (public URL + optional API via BYOK)
- Booking.com listing scrape
- VRBO listing scrape
- Google Business Profile
- TripAdvisor reviews API
- Trustpilot reviews
- Local weather / events / attractions (Open-Meteo + Wikidata)
- Competitor set (nearest 20-50 similar properties, radius + capacity match)
- Historical bookings (PMS export CSV import)

Digest schema in `kernel.schema.json` · example filled in `kernel.example.json`.
Refresh: reviews weekly, competitors weekly, listings on-change, weather daily.

## L2 · BYOK adapter

`adapter.js` normalises Anthropic / OpenAI / Gemini / Grok / Mistral / local WebLLM behind one `chat(messages, tools, opts)` interface. Owner drops a key in `autopilot.html` config panel · nothing else changes.

Fallback rail: primary → secondary → local WebLLM (free tier). Never our tokens.

## L3 · Agentic runtime

`agent.js` runs the loop: perceive (inbox + calendar + kernel) → reason (LLM + tool schema) → act (tool call) → log (event stream) → observe (state delta).

Tools registered in `tools.js` as JSON schemas. Each tool has:
- `execute(args)` — the actual side effect (signed, logged)
- `guardrails` — value/confidence thresholds for auto-execute vs queue-for-human
- `reversible_ms` — undo window (default 30s)

Event stream (`events.js`) is append-only, Ed25519-signed, and is what the hub tails in watch mode.

## Autonomy dial (per action-class)

```
watch     → agent thinks aloud, does nothing
suggest   → agent proposes actions in a queue, human approves each
auto-low  → auto-executes low-value low-risk (auto-reply FAQs, welcome msgs)
auto-med  → auto-executes medium-value (quotes, pricing tweaks ±10%)
full      → auto-executes everything except explicit `flag_for_human`
```

Persisted per action-class in `autopilot.settings.json`.

## Wire-in path (when the upgrade lands)

1. Owner opens `autopilot.html` · pastes API key · picks provider/model.
2. Clicks "Harvest" → kernel builds in background (WebLLM worker + fetch adapters).
3. Reviews kernel · edits facts inline.
4. Sets autonomy dial to `watch`.
5. Agent starts appearing in the event stream on hub.html.
6. Slides dial up as trust grows.

## Gospel constraints (locked)

- No login gate (see `feedback_wishwood_no_login_until_set_up.md`)
- BYOK only · never our tokens
- Ed25519-signed events (Web Crypto, no external libs)
- WebLLM (Llama 3.1 8B via botler pattern) is the free-tier fallback
- Kernel refresh runs in a service worker · never blocks UI
- Hub stays useful without any of this wired (graceful degradation)
