/* Wishwood · Research engine.
 * BYOK LLM queried with hospitality-specific research questions.
 * Insights saved locally, activated per-insight, injected into composer prompts.
 * Recommend Gemini (buyer likely has Google AI Pro for image + video anyway).
 */

import { chat } from './adapter.js';
import { logEvent } from './events.js';

const KEY = 'wishwood.research.insights';

export function loadInsights() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveInsights(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-100)));
  window.dispatchEvent(new CustomEvent('wishwood:research-updated'));
}

export function loadActiveInsights() {
  return loadInsights().filter(i => i.active);
}

export function toggleActive(id) {
  const list = loadInsights();
  const i = list.find(x => x.id === id);
  if (i) { i.active = !i.active; saveInsights(list); }
}

export function deleteInsight(id) {
  saveInsights(loadInsights().filter(i => i.id !== id));
}

/* Common research topics · quick-select on the UI */
export const RESEARCH_PRESETS = [
  { key: 'local_fb_groups', question: 'Which local Facebook groups near my property are worth posting in to reach potential guests · what content works in each · what content gets banned. Give real group-type examples (village community · town noticeboard · what\'s on locally · walking groups · etc.)' },
  { key: 'last_min_deals', question: 'Best structures for last-minute deals for a UK holiday cottage. Buy-2-get-1-free vs percentage discount vs mid-week specials · what actually converts and when to run each. Include timing (how many days out) and channels.' },
  { key: 'peak_season_2027', question: 'Peak booking windows for UK holiday cottages by month. When do guests book for summer, half-term, Christmas, New Year. What should I be posting each month to catch the search intent.' },
  { key: 'ota_vs_direct', question: 'Tactics to shift guests from Airbnb/Booking.com to direct bookings for a UK cottage. Legal ways to do it inside OTA rules · what works · what gets you delisted.' },
  { key: 'insta_hospitality', question: 'Best-performing Instagram content strategies for holiday rentals in 2026-2027. Reel formats · post cadence · what gets engagement from potential guests vs just other hosts.' },
  { key: 'return_guests', question: 'How to increase repeat bookings from past guests without being pushy. Timing · channel · offer structure · what to say and what to skip.' },
  { key: 'seasonal_content', question: 'Content calendar patterns for UK hospitality by season. What to post in Jan when nobody\'s booking vs May when everyone is. Match content to booking-intent seasonality.' },
  { key: 'gap_week_fill', question: 'Fastest ways to fill gap weeks in a booking calendar 7-14 days out. Specific tactics · which channels · what discount is worth it vs leaving empty.' },
  { key: 'review_growth', question: 'Ethical ways to increase 5-star review count. When to ask · how to ask · what to include in follow-up · what NOT to do (bribes etc that violate OTA terms).' },
  { key: 'competitor_watch', question: 'How to monitor nearby competing cottages without obsessing. What metrics to watch · what to ignore · how often to check.' }
];

/* Run one research query. */
export async function queryResearch({ question, kernel, provider, model, key, tags = [] }) {
  const propertyName = kernel?.property?.name || 'the property';
  const region = kernel?.property?.location?.region || 'the local area';
  const country = kernel?.property?.location?.country || 'GB';
  const propertyType = kernel?.property?.type || 'cottage';
  const sleeps = kernel?.property?.sleeps || null;

  const system = `You are a hospitality-marketing research assistant for ${propertyName}, a UK holiday ${propertyType}${sleeps ? ' sleeping ' + sleeps : ''} in ${region}, ${country}.

Answer the research question with SPECIFIC, ACTIONABLE tactics · not generic advice.
- Include concrete channels, realistic numbers, timing, exact copy examples where useful.
- Reference mainstream sources when you can (Airbnb host manual, Booking.com policies, ONS data, Google Trends).
- No mysticism · no vague strategy · specific tactics only.
- Assume the owner is NOT an agency · single-property, personal voice, sovereign platform.
- Assume they respect Airbnb / Booking.com terms.

Return STRICT JSON:
{
  "summary": "one-paragraph TL;DR of the answer",
  "tactics": ["specific tactic 1", "specific tactic 2", ...],
  "copy_examples": ["example post or message copy 1", "example 2"],
  "channels": ["specific channels or groups mentioned"],
  "timing": ["when to do this · specific windows"],
  "warnings": ["what NOT to do · what breaks OTA terms · what backfires"],
  "psychology_notes": ["which Cialdini principles apply · reciprocity/scarcity/social_proof/authority/consistency/liking"]
}`;

  const user = `Research question: ${question}\n\nBe specific. Cite real channels. Real numbers. Real copy.`;

  const r = await chat({
    provider, model, key,
    system,
    messages: [{ role: 'user', content: user }]
  });

  const parsed = _extractJson(r.text) || { summary: r.text.slice(0, 500), tactics: [], copy_examples: [], channels: [], timing: [], warnings: [], psychology_notes: [] };

  const insight = {
    id: crypto.randomUUID(),
    question,
    answer: parsed,
    tags,
    active: true,
    created_at: new Date().toISOString(),
    provider,
    model
  };

  const list = loadInsights();
  list.unshift(insight);
  saveInsights(list);

  await logEvent({ type: 'research_query', payload: { question: question.slice(0, 100), tags, provider } });
  return insight;
}

/* Compress active insights into a research context block for the composer. */
export function activeInsightsContext(maxChars = 3000) {
  const active = loadActiveInsights();
  if (!active.length) return '';
  let out = 'CURRENT RESEARCH INSIGHTS (apply these tactics when relevant):\n\n';
  for (const i of active) {
    const line = `- Q: ${i.question.slice(0, 100)}\n  Summary: ${i.answer.summary || ''}\n  Key tactics: ${(i.answer.tactics || []).slice(0, 3).join(' · ')}\n\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out;
}

function _extractJson(text) {
  if (!text) return null;
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[1] || m[0]); } catch { return null; }
}
