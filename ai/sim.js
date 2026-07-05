/* Wishwood · training simulator.
 * Spawns synthetic guests via WebLLM (local, free) that flood the hub with
 * realistic bookings / complaints / questions. Chrissy replies, WebLLM judges.
 * Sim state is namespaced separately from real state · reset without side effects.
 */

import { chat, DEFAULT_MODELS } from './adapter.js';
import { logEvent } from './events.js';

/* ---- personas + scenarios ---- */

export const PERSONAS = [
  { id: 'ellen',    name: 'Ellen Barratt',        archetype: 'anxious_first_timer',   traits: 'over-plans, asks many questions, needs reassurance',           temperament: 0.30 },
  { id: 'weston',   name: 'Mark & Chloe Weston',  archetype: 'romantic_getaway',      traits: 'wants special touches, budget flexible, wine + views',         temperament: 0.75 },
  { id: 'kaplan',   name: 'The Kaplans',          archetype: 'multi_generational',    traits: 'grandparent with limited mobility, kids, needs accessibility',  temperament: 0.60 },
  { id: 'danny',    name: 'Danny Blake',          archetype: 'business_stopover',     traits: 'wifi obsessed, needs quiet workspace, single night',           temperament: 0.50 },
  { id: 'sasha',    name: 'Sasha Reeves',         archetype: 'complainer',            traits: 'finds issues, threatens reviews, tests boundaries',            temperament: 0.15 },
  { id: 'nomads',   name: 'Tom & Priya',          archetype: 'digital_nomads',        traits: '3 week stay, needs everything for remote work',                temperament: 0.75 },
  { id: 'dawson',   name: 'The Dawson clan',      archetype: 'party_risk',            traits: 'group of friends, may test quiet-hours policy',                temperament: 0.40 },
  { id: 'margaret', name: 'Margaret Holt',        archetype: 'solo_older',            traits: 'poor tech, prefers calls, warm and courteous',                 temperament: 0.85 },
  { id: 'sara',     name: 'Sara Ng',              archetype: 'influencer',            traits: 'photos everywhere, negotiates for content deal',               temperament: 0.55 },
  { id: 'ashford',  name: 'The Ashfords',         archetype: 'pet_owners',            traits: 'dog + cat, checks pet policy, worried about hair',             temperament: 0.65 }
];

export const SCENARIOS = [
  { key: 'inquiry_dates',        weight: 30, prompt: 'Ask about availability for {DATES}' },
  { key: 'inquiry_price',        weight: 15, prompt: 'Question why the price is what it is · has seen cheaper nearby' },
  { key: 'inquiry_pets',         weight: 12, prompt: 'Ask about pet policy · they have a {PET}' },
  { key: 'booking_confirm',      weight: 20, prompt: 'Wants to confirm and pay for {DATES}' },
  { key: 'arrival_code',         weight: 10, prompt: 'Ask for arrival code · they arrive in {HOURS} hours' },
  { key: 'complaint_cleanliness',weight: 6,  prompt: 'Says the property was not clean on arrival · very unhappy' },
  { key: 'complaint_amenity',    weight: 5,  prompt: 'Says an amenity is broken ({AMENITY})' },
  { key: 'noise_complaint',      weight: 3,  prompt: 'Neighbour complained about the guest party · you are relaying' },
  { key: 'cancellation',         weight: 8,  prompt: 'Wants to cancel {DATES} and get refund · reason varies' },
  { key: 'left_item',            weight: 4,  prompt: 'Left {ITEM} behind, wants it posted or held' },
  { key: 'review_request',       weight: 5,  prompt: 'Thanking after stay, mentioning they will leave a review' },
  { key: 'boundary_test',        weight: 3,  prompt: 'Testing if a house rule is enforced ({RULE})' }
];

const AMENITIES = ['wifi', 'hot water', 'heating', 'log burner', 'oven', 'shower', 'washing machine'];
const PETS = ['labrador', 'small terrier', 'cat', 'two cats', 'french bulldog'];
const ITEMS = ['phone charger', 'watch', 'a book', 'kids teddy', 'wine bottle', 'jacket'];
const RULES = ['no smoking indoors', 'quiet after 22:00', 'no parties', 'checkout by 10:00'];

/* ---- state (namespaced for sim only) ---- */

const KEYS = {
  state: 'wishwood.sim.state',
  inbox: 'wishwood.sim.inbox',
  score: 'wishwood.sim.score'
};

export function loadSimState() { try { return JSON.parse(localStorage.getItem(KEYS.state) || '{}'); } catch { return {}; } }
export function saveSimState(s) { localStorage.setItem(KEYS.state, JSON.stringify(s)); window.dispatchEvent(new CustomEvent('wishwood:sim-state', { detail: s })); }

export function loadSimInbox() { try { return JSON.parse(localStorage.getItem(KEYS.inbox) || '[]'); } catch { return []; } }
export function saveSimInbox(inbox) { localStorage.setItem(KEYS.inbox, JSON.stringify(inbox.slice(0, 300))); }
export function pushSimMessage(msg) {
  const inbox = loadSimInbox();
  inbox.unshift(msg);
  saveSimInbox(inbox);
  window.dispatchEvent(new CustomEvent('wishwood:sim-message', { detail: msg }));
}
export function updateSimMessage(id, patch) {
  const inbox = loadSimInbox();
  const i = inbox.findIndex(m => m.id === id);
  if (i >= 0) { inbox[i] = { ...inbox[i], ...patch }; saveSimInbox(inbox); }
}

export function loadSimScore() { try { return JSON.parse(localStorage.getItem(KEYS.score) || '{"replies":[]}'); } catch { return { replies: [] }; } }
export function saveSimScore(s) { localStorage.setItem(KEYS.score, JSON.stringify(s)); }

export function resetSim() {
  localStorage.removeItem(KEYS.state);
  localStorage.removeItem(KEYS.inbox);
  localStorage.removeItem(KEYS.score);
  if (_timer) { clearTimeout(_timer); _timer = null; }
  window.dispatchEvent(new CustomEvent('wishwood:sim-reset'));
}

/* ---- generation ---- */

function _randomDates() {
  const s = new Date(); s.setDate(s.getDate() + 14 + Math.floor(Math.random() * 90));
  const nights = 2 + Math.floor(Math.random() * 5);
  const e = new Date(s.getTime() + nights * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return `${fmt(s)} to ${fmt(e)}`;
}
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _fill(prompt) {
  return prompt
    .replace('{DATES}', _randomDates())
    .replace('{PET}', _pick(PETS))
    .replace('{HOURS}', String(1 + Math.floor(Math.random() * 6)))
    .replace('{AMENITY}', _pick(AMENITIES))
    .replace('{ITEM}', _pick(ITEMS))
    .replace('{RULE}', _pick(RULES));
}
export function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) { r -= it.weight; if (r <= 0) return it; }
  return items[0];
}

export async function generateGuestMessage({ persona, scenario, kernel, provider = 'webllm', key = null, model = null }) {
  const propertyName = kernel?.property?.name || 'the property';
  const notPresent = (kernel?.property?.not_present || []).join(', ');
  const system = `You are role-playing ${persona.name}, a ${persona.archetype} contacting a UK holiday-rental host.
Traits: ${persona.traits}. Temperament (0=hostile, 1=warm): ${persona.temperament}.
Write ONE realistic guest message (2-4 sentences · one paragraph · no greeting-only messages · no sign-off).
Do NOT reference facts about the property that aren't verifiable. Do NOT mention amenities that are not present: ${notPresent || 'none listed'}.
Sound like a real person messaging on Airbnb / Booking / WhatsApp. No stage directions, no meta-commentary.`;
  const user = `Property name: ${propertyName}. Scenario: ${_fill(scenario.prompt)}. Write the message body only.`;
  const r = await chat({ provider, key, model, system, messages: [{ role: 'user', content: user }] });
  return r.text.trim().replace(/^["']|["']$/g, '');
}

export async function judgeReply({ reply, message, kernel, provider = 'webllm', key = null, model = null }) {
  const system = `You judge a UK holiday-rental host reply. Score four dimensions (0-10 integers): warmth, accuracy, completeness, tone_fit.
Also give a short critique (max 25 words) and one improved rewrite.
Return STRICT JSON: {"warmth":n,"accuracy":n,"completeness":n,"tone_fit":n,"critique":"...","improved":"..."}`;
  const banned = (kernel?.voice?.banned_phrases || []).join(', ');
  const tone = kernel?.voice?.tone || 'warm';
  const user = `Guest message (persona ${message.persona}, scenario ${message.scenario}):
"${message.text}"

Host reply:
"${reply}"

Target tone: ${tone}. Banned phrases: ${banned}.

Score strictly. JSON only.`;
  const r = await chat({ provider, key, model, system, messages: [{ role: 'user', content: user }] });
  return _extractJson(r.text);
}

function _extractJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) return { warmth: 5, accuracy: 5, completeness: 5, tone_fit: 5, critique: 'parse failed', improved: '' };
  try { return JSON.parse(m[1] || m[0]); }
  catch { return { warmth: 5, accuracy: 5, completeness: 5, tone_fit: 5, critique: 'parse failed', improved: '' }; }
}

/* ---- runtime ---- */

let _timer = null;
const RATES = { chill: 4, normal: 12, peak: 30, chaos: 60 }; // msgs / hour

export async function startSim({ intensity = 'normal', duration_min = 20, kernel, onMessage, onEnd }) {
  const rate = RATES[intensity] || 12;
  const interval_ms = Math.max(2000, Math.floor(3600000 / rate));
  const end_time = Date.now() + duration_min * 60000;
  saveSimState({ running: true, intensity, duration_min, started_at: Date.now(), end_time, msgs_sent: 0 });

  await logEvent({ type: 'sim_start', payload: { intensity, duration_min }, actor: 'simulator' });

  async function tick() {
    const s = loadSimState();
    if (!s.running || Date.now() > s.end_time) { stopSim(); if (onEnd) onEnd(); return; }
    const persona = _pick(PERSONAS);
    const scenario = pickWeighted(SCENARIOS);
    try {
      const text = await generateGuestMessage({ persona, scenario, kernel });
      const msg = {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        simulation: true,
        channel: _pick(['airbnb', 'booking', 'direct', 'whatsapp', 'vrbo']),
        from: persona.name,
        persona_id: persona.id,
        persona: persona.archetype,
        temperament: persona.temperament,
        scenario: scenario.key,
        text,
        replied: false
      };
      pushSimMessage(msg);
      const s2 = loadSimState();
      saveSimState({ ...s2, msgs_sent: (s2.msgs_sent || 0) + 1 });
      if (onMessage) onMessage(msg);
    } catch (e) {
      console.warn('[sim] tick failed', e);
    }
    _timer = setTimeout(tick, interval_ms);
  }
  tick();
}

export function stopSim() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  const s = loadSimState();
  saveSimState({ ...s, running: false, stopped_at: Date.now() });
  logEvent({ type: 'sim_stop', payload: {}, actor: 'simulator' });
}

export function isRunning() { return !!loadSimState().running; }

export async function scoreReply({ msgId, reply, kernel, provider = 'webllm', key = null, model = null }) {
  const inbox = loadSimInbox();
  const msg = inbox.find(m => m.id === msgId);
  if (!msg) throw new Error('message not found');
  const j = await judgeReply({ reply, message: msg, kernel, provider, key, model });
  const score = { msgId, ts: new Date().toISOString(), reply, judgment: j, persona_id: msg.persona_id, scenario: msg.scenario };
  const cur = loadSimScore();
  cur.replies = cur.replies || [];
  cur.replies.push(score);
  saveSimScore(cur);
  updateSimMessage(msgId, { replied: true, reply, judgment: j });
  return score;
}

export function summarize() {
  const cur = loadSimScore();
  const rs = cur.replies || [];
  if (!rs.length) return { count: 0, avg: {} };
  const acc = { warmth: 0, accuracy: 0, completeness: 0, tone_fit: 0 };
  for (const r of rs) {
    const j = r.judgment || {};
    acc.warmth += j.warmth || 0;
    acc.accuracy += j.accuracy || 0;
    acc.completeness += j.completeness || 0;
    acc.tone_fit += j.tone_fit || 0;
  }
  const n = rs.length;
  return {
    count: n,
    avg: {
      warmth: +(acc.warmth / n).toFixed(1),
      accuracy: +(acc.accuracy / n).toFixed(1),
      completeness: +(acc.completeness / n).toFixed(1),
      tone_fit: +(acc.tone_fit / n).toFixed(1),
      overall: +((acc.warmth + acc.accuracy + acc.completeness + acc.tone_fit) / (4 * n)).toFixed(1)
    }
  };
}
