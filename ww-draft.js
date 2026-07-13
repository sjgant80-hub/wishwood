/* Wishwood · ww-draft.js · real AI reply drafting, grounded on the true property facts.
 * Reuses ai/adapter.js (BYOK cascade → free local WebLLM fallback). No servers, owner's key only.
 * Anti-hallucination: the model may ONLY state facts in the kernel below; if it doesn't know, it says so.
 * Voice is seeded from Chrissy's own real replies. Draft only — a human still approves + sends.
 */
import { chat, DEFAULT_MODELS } from './ai/adapter.js';

/* The grounding kernel — the TRUTH about Wishwood (off-grid glamping, Canterbury, Kent). */
export const WISHWOOD_KERNEL = {
  property: 'Wishwood Glamping — 16 acres of ancient woodland near Canterbury, Kent. Off-grid by design.',
  host: 'Chrissy (the owner-host who answers guests personally).',
  units: [
    'The Yurt — family yurt, sleeps up to 6, walk-in shower, dogs welcome.',
    'Fern Lodge — lodge camp, dogs welcome.',
    'Thistle Caravan — restored caravan for couples, sleeps 2, dogs welcome.',
    'The Hobbit — storybook hut, sleeps 3, dogs welcome.'
  ],
  everyUnitHas: 'wood-burner, private outdoor kitchen (gas hob, BBQ, fridge, sink), compost loo, fire pit.',
  connectivity: 'Wifi is available.',
  dogs: 'Dogs welcome — £15 per dog for the stay. Outdoor warm-water dog rinse by the boiler shed.',
  location: 'Near Canterbury (~12 min for shops, incl. gluten-free). Bluebells across the woodland in spring (around April).',
  booking: 'Direct booking at wishwood.co.uk/book (best value — no OTA fee). Facebook-follower code WOOD10 = 10% off direct.',
  policy: 'Cancellation is strict (no refund inside 14 days), but Chrissy will, as goodwill, try to re-let and refund what she can.',
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
    `UNITS:\n- ${k.units.join('\n- ')}`,
    `EVERY UNIT HAS: ${k.everyUnitHas}`,
    `CONNECTIVITY: ${k.connectivity}`,
    `DOGS: ${k.dogs}`,
    `LOCATION: ${k.location}`,
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
