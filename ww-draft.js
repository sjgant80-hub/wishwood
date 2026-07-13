/* Wishwood · ww-draft.js · real AI reply drafting, grounded on the true property facts.
 * Reuses ai/adapter.js (BYOK cascade → free local WebLLM fallback). No servers, owner's key only.
 * Anti-hallucination: the model may ONLY state facts in the kernel below; if it doesn't know, it says so.
 * Voice is seeded from Chrissy's own real replies. Draft only — a human still approves + sends.
 */
import { chat, DEFAULT_MODELS } from './ai/adapter.js';

/* The grounding kernel — the TRUTH about Wishwood (off-grid glamping, Canterbury, Kent). */
export const WISHWOOD_KERNEL = {
  property: 'Wishwood Glamping — private ancient woodland at Sturry, near Canterbury, Kent, beside Blean Woods National Nature Reserve and a lake.',
  host: 'Chrissy (the owner-host who answers guests personally).',
  units: [
    'The Yurt — the solar-powered off-grid yurt, sleeps 6 (1 double, 2 twin, 1 air mattress). Log-burner (a free net of logs a night), kettle + single gas ring, private composting loo, walk-in eco shower, private garden.',
    'Fern Lodge — woodland lodge, sleeps 4 (1 double, 2 sofa beds + air mattress), private bathroom, private kitchen, wood stove, private BBQ, fire pit, fridge, desk, outdoor dining. Free wifi.',
    'Thistle Caravan — restored vintage caravan, sleeps 3 (double + configurable), kitchenette (gas ring, sink, fridge, kettle), log-burner, heating, private bathroom, fire pit. £10 cleaning fee.',
    'The Hobbit — quirky hobbit hut, sleeps 3 (1 double, 1 twin), wood-burner, private kitchen, heating, private BBQ, wifi, parking.'
  ],
  shared: 'A sheltered communal outdoor kitchen (gas BBQ, sink, worktops, pots & pans), fire pits, log nets, parking.',
  connectivity: 'Wifi is available (confirmed at Fern Lodge and the Hobbit; the Yurt is solar/off-grid so signal there is limited).',
  hotTub: 'No hot tubs.',
  dogs: 'UNCERTAIN — do not state a dog policy. Fern Lodge lists no pets; other camps unclear. If a guest asks about dogs, say you will confirm with Chrissy.',
  location: 'Sturry, near Canterbury (~10 min drive), by Blean Woods NNR and a lake; ~20 min to the coast (Whitstable/Herne Bay). Exact address is shared after booking.',
  checkInOut: 'Check-in mid-afternoon to evening (roughly 2–8pm), check-out late morning (11am–12pm) — varies by camp.',
  booking: 'Bookings currently run through the listing platforms (Glamping Hub, Snaptrip, Pitchup, Airbnb). Do not quote a nightly price from memory — offer to confirm the current rate and availability.',
  policy: 'A peaceful retreat — no loud parties. Cancellation terms are set by the booking platform; if asked, offer to check rather than guessing.',
  voice: [
    'Warm, personal, concise. Lowercase-leaning, em-dashes and middots (·) over heavy punctuation. Never corporate, never "Dear guest".',
    'Answer the actual question first, then a gentle nudge to book direct when it fits. Always sign off as "Chrissy".',
    'If a fact is not in this kernel, do NOT invent it — say you\'ll check and come back.'
  ]
};

function kernelText() {
  const k = WISHWOOD_KERNEL;
  return [
    `PROPERTY: ${k.property}`,
    `HOST: ${k.host}`,
    `CAMPS (4):\n- ${k.units.join('\n- ')}`,
    `SHARED: ${k.shared}`,
    `CONNECTIVITY: ${k.connectivity}`,
    `HOT TUBS: ${k.hotTub}`,
    `DOGS: ${k.dogs}`,
    `LOCATION: ${k.location}`,
    `CHECK-IN / OUT: ${k.checkInOut}`,
    `BOOKING: ${k.booking}`,
    `POLICY: ${k.policy}`,
    `VOICE:\n- ${k.voice.join('\n- ')}`
  ].join('\n\n');
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('wishwood.autopilot.settings') || '{}'); }
  catch { return {}; }
}

/* Returns { text, engine } — engine tells the UI what actually answered. */
export async function wwDraft(msg, voiceExamples = []) {
  const s = loadSettings();
  const examples = voiceExamples.filter(Boolean).slice(0, 2)
    .map((d, i) => `Example ${i + 1} of Chrissy's real voice:\n${d}`).join('\n\n');
  const system =
    `You are drafting a reply AS Chrissy, the host of Wishwood Glamping. You are writing in her voice to a real guest.\n\n` +
    `GROUNDING (the only facts you may state):\n${kernelText()}\n\n` +
    (examples ? examples + '\n\n' : '') +
    `RULES: only use facts from the grounding above. If you don't know a specific price, unit size, or detail, say you'll check and come back rather than guessing. Keep it short and human. End with "Chrissy". Output ONLY the reply text, nothing else.`;
  const user =
    `A guest messaged via ${msg.channel || 'a booking channel'}.\n` +
    `From: ${msg.from || 'a guest'}\n` +
    (msg.cabin ? `About unit: ${msg.cabin}\n` : '') +
    (msg.subject ? `Subject: ${msg.subject}\n` : '') +
    `Their message: "${msg.preview || msg.body || ''}"\n\nDraft Chrissy's reply.`;

  const hasKey = s.key && s.provider && s.provider !== 'webllm';
  const primary = hasKey
    ? { provider: s.provider, model: s.model || DEFAULT_MODELS[s.provider], key: s.key }
    : { provider: 'webllm', model: DEFAULT_MODELS.webllm };
  const fallback = hasKey ? [{ provider: 'webllm', model: DEFAULT_MODELS.webllm }] : [];

  const r = await chat({ ...primary, system, messages: [{ role: 'user', content: user }], fallback });
  return { text: (r.text || '').trim(), engine: hasKey ? primary.provider : 'webllm (free, local)' };
}
