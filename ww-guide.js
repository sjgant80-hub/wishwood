/* Wishwood · ww-guide.js · the OS teaches itself.
 * A free (WebLLM) built-in tutor that explains how WISHWOOD-OS works — every module,
 * how it behaves once fully wired — so anyone can learn it hands-on with no key.
 * It teaches, and it LEARNS: every question is logged as a signal to improve the guide.
 * Grounds on WW_OS_GUIDE + the live Property Brain. Reuses ai/adapter.js (WebLLM-first).
 */
import { chat, DEFAULT_MODELS } from './ai/adapter.js';
import { loadKernel } from './ww-draft.js';

export const WW_OS_GUIDE = `
WISHWOOD-OS is an AI-run operating system for a small business. One dashboard, six modules,
you (the human) approve everything. It runs in your browser — your data stays yours. The AI can
run free on your own machine (WebLLM) or on your own API key. It replaces a stack of separate
SaaS tools + a part-time social person + a bookkeeper.

THE HUB — your one dashboard. See everything at a glance; nothing happens without your say-so.

GUEST DESK — every guest message from every channel (SMS, WhatsApp, email, Airbnb, Booking.com,
Pitchup) lands in ONE inbox. The AI reads it and drafts a reply in your voice, grounded on your
Property Brain (so it never makes facts up). You approve, edit, or skip. Fully wired, it auto-answers
routine questions right up to check-in and hands off to you for anything sensitive; bookings sync
to the calendar automatically.

SOCIAL — the AI drafts posts for all your socials and runs a 30-day content plan (what to post, when,
why). You approve each one. It learns which posts land and adjusts. Fully wired, it posts for you.

BOOKS — the real FallAccount accounting app is embedded. Bookings auto-post as revenue, OTA fees are
deducted, expenses get categorised (snap a receipt), and your VAT / HMRC year-end export is ready as
a file — no accountant lock-in. A manual-entry form catches anything the automation missed.

REVIEWS — watches your reviews across platforms, drafts a warm reply to each, you approve. Flags the
ones that need a real human touch.

EMAIL — automated guest email sequences (booking → pre-arrival info → check-in details → review request)
plus marketing to past guests. Every message AI-drafted in your voice, you approve before it sends.

PROPERTY BRAIN — the single source of truth. You edit the facts ONCE here (camps, wifi, dogs, prices,
policies). Every reply, listing rewrite, and post grounds on it. Change a fact, everything updates.
An "AI tidy & gap-check" spots contradictions, stale claims, and gaps for you.

LISTINGS — rewrites your descriptions on each platform (Airbnb, Pitchup, your own site) to match the
Property Brain, in-voice, per platform. Auto-updates your own site; one-click copy for the OTAs.

OVERSIGHT — the golden rule: the AI drafts, you approve. It never sends anything on its own unless you
raise the autonomy dial. You're always the check.

SOVEREIGN — single HTML file, works offline after first load, no server, no lock-in. Free local AI
(WebLLM) means anyone can try the whole thing for £0.
`;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('wishwood.autopilot.settings') || '{}'); }
  catch { return {}; }
}

/* Teach + learn: answers grounded on the guide; logs the question as a learning signal. */
export async function wwTeach(question) {
  try {
    const k = 'wishwood.learn.log';
    const l = JSON.parse(localStorage.getItem(k) || '[]');
    l.unshift({ q: question, ts: Date.now() });
    localStorage.setItem(k, JSON.stringify(l.slice(0, 500)));
  } catch {}

  const s = loadSettings();
  const hasKey = s.key && s.provider && s.provider !== 'webllm';
  // Learn mode defaults to FREE local WebLLM so anyone can use it with no key.
  const primary = hasKey
    ? { provider: s.provider, model: s.model || DEFAULT_MODELS[s.provider], key: s.key }
    : { provider: 'webllm', model: DEFAULT_MODELS.webllm };

  let facts = '';
  try {
    const kn = loadKernel();
    facts = `This example business: ${kn.property || 'a small hospitality business'} — camps: ${(kn.units || []).map(u => (u.split('—')[0] || u).trim()).join(', ')}.`;
  } catch {}

  const system =
    `You are the friendly built-in guide for WISHWOOD-OS. Teach the person how it works in plain, warm ` +
    `language — like explaining to a smart 12-year-old who's never used software like this. Ground ONLY in the ` +
    `guide below; don't invent features. Keep answers short and concrete, and add a "try it: open the X module" ` +
    `nudge when it helps.\n\nGUIDE:\n${WW_OS_GUIDE}\n\n${facts}`;

  const r = await chat({
    ...primary, system,
    messages: [{ role: 'user', content: question }],
    fallback: hasKey ? [{ provider: 'webllm', model: DEFAULT_MODELS.webllm }] : []
  });
  return { text: (r.text || '').trim(), engine: hasKey ? primary.provider : 'free local AI' };
}
