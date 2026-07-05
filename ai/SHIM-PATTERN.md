# Estate AI shim · portable drop-in

This `ai/` module + `autopilot.html` + `sim.html` + `ww-autopilot-status.js` is a **canonical estate pattern**. It shims into any operator-facing build in the estate to give it AI-first scaffolding: BYOK · kernel grounding · agentic runtime · autonomy dial · training simulator.

**GOSPEL:** grep this pattern BEFORE writing new AI code in any estate build. Do NOT reinvent.

## What this shim gives you

- **BYOK adapter** — 6 providers (Anthropic · OpenAI · Gemini · Groq · Mistral · WebLLM). Owner's key → owner's provider directly. Never our tokens.
- **Kernel grounding** — every LLM call anchored to a JSON kernel derived from the build's domain. Prevents hallucination.
- **Ed25519-signed event log** — audit trail, provable actions, IDB + localStorage ring.
- **Agentic runtime** — perceive → reason → act → log loop with per-tool guardrails.
- **Autonomy dial** — watch / suggest / auto-low / auto-med / full. Trust builds incrementally.
- **Training simulator** — WebLLM (free · local) spawns synthetic customers so the human learns the flow before real ones arrive.

## Files (all copy-paste portable)

```
ai/
├── adapter.js              # 6-provider BYOK adapter (zero edits needed)
├── agent.js                # runtime loop (0-1 domain edits)
├── events.js               # Ed25519 signed log (zero edits needed)
├── harvest.js              # seed harvest (domain-specific harvesters)
├── sim.js                  # training sim (adapt PERSONAS + SCENARIOS)
├── tools.js                # domain tool registry (rewrite for build's domain)
├── kernel.schema.json      # domain kernel shape (rewrite for build)
├── kernel.example.json     # domain kernel example (rewrite for build)
├── ARCHITECTURE.md         # explainer
└── SHIM-PATTERN.md         # this file
autopilot.html              # BYOK config surface (style-tune only)
sim.html                    # training surface (style-tune only)
ww-autopilot-status.js      # floating status pill (zero edits)
```

## Port to a new estate build in 6 steps

1. **Copy** `ai/` + `autopilot.html` + `sim.html` + `ww-autopilot-status.js` into the target repo.
2. **Rewrite the kernel** (`ai/kernel.schema.json` + `ai/kernel.example.json`) to match the build's domain. Examples:
   - **FallCRM Elite** → property becomes `pipeline`, guests become `contacts`, reviews become `deal_history`.
   - **FallReach** → property becomes `outreach_campaign`, scenarios become `channels`, reviews become `response_history`.
   - **Plumber Lead Machine** → property becomes `service_area`, guests become `homeowners`, scenarios become `job_types`.
3. **Rewrite `ai/tools.js`** with the domain's actual verbs. Every tool must have: `parameters` schema (LLM function-call), `guardrails` (autonomy gates), `reversible_ms` (undo window), `execute()` (real side effect).
4. **Rewrite `ai/sim.js` PERSONAS + SCENARIOS** to reflect the domain's customer types and message patterns.
5. **Wire the status widget** into the build's hub page: `<script defer src="ww-autopilot-status.js"></script>` and update `ww-nav.js` (or the build's nav) to include Autopilot + Sim links.
6. **Update `sw.js`** shell list + bump the CACHE constant.

## What stays identical across every port

- The 6-provider adapter (Anthropic / OpenAI / Gemini / Groq / Mistral / WebLLM)
- Ed25519 signing pattern
- IDB + localStorage ring storage
- Autonomy dial vocabulary (watch / suggest / auto-low / auto-med / full)
- Event schema (`{ts, type, actor, confidence, payload, signature}`)
- Tool schema (`{name, description, parameters, guardrails, reversible_ms, execute}`)
- No login rule (from wishwood pattern)

## What must be domain-specific per port

- Kernel structure (what the LLM is grounded to)
- Tool registry (the verbs of the domain)
- Sim personas + scenarios (who does what to whom)
- Voice + banned phrases (brand-specific)
- Harvester sources (where the domain's ground truth lives)

## Canonical estate references

- **Konomi seal:** ◊·κ=1 (every UI carries this)
- **WebLLM model:** `Llama-3.1-8B-Instruct-q4f16_1-MLC` (botler pattern)
- **Provenance:** every significant action optionally mints a KCC record on fallcolony ledger
- **Free-tier fallback:** WebLLM before any paid provider
- **Event signing:** Web Crypto Ed25519 only (no external libs)

## Priority ports (2026-07)

1. **FallCRM Elite** — high impact · pipeline agent
2. **FallReach** — already agentic · needs kernel + event pattern
3. **FallEnterprise** — client intake autopilot
4. **Roost** — property parent (adjacent to wishwood)
5. **Plumber Lead Machine** — trades autopilot
6. **KardV5** — legal intake agent

## Future-proof checklist (all builds)

See `feedback_ai_economy_futureproof_checklist.md` in memory.
