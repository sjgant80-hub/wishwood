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
SaaS tools + a part-time social person + a bookkeeper. The whole point is LESS friction for you,
your staff and your helpers — the system does the remembering and the chasing, so people don't have to.

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

AUTO-JOBS (the alert engine) — the moment ANY booking lands — direct, or from Airbnb / Booking / Pitchup —
the OS reads the dates and stay length and automatically raises the jobs for that stay, so nobody has to
remember or coordinate. Three jobs per booking, shared to everyone who can see the app:
  · WORKAWAY UPKEEP (camp readiness) — empty bins · service the compost toilets · refill + trim the oil
    lamps · top up the water and shower water. This is the volunteer/helper checklist, ready for arrival day.
  · WELCOME (arrival) — gate code + welcome pack, so the guest is greeted properly.
  · CLEAN (checkout) — the turnaround before the next guest.
Each job knows its camp, its date and who it's for. When you wire a channel like text/WhatsApp, the system
can even ping the right person automatically ("cleaner needed Sunday for the Yurt checkout"). It's the
whole point of the OS: reduce friction for people and staff.

ACTIVITY LOG — a plain, shared, running feed of everything the OS does: a message came in, a reply was
drafted, a reply was sent, a booking landed, jobs were raised. Newest first. It's how you — and anyone
learning — can watch the system actually working, and it's the honest audit trail behind "the AI drafts,
you approve". Nothing happens in the dark.

CLINIC — a health panel that shows green / amber / red for every part of the OS: what's wired and working,
what's ready to switch on, and what still needs setup. So you (and anyone learning) always know what's live
and exactly what to do next. Open it any time from The Hub.

ALWAYS-ON — your hub runs in the browser, so it only works while it's open. To answer guests 24/7 (even at
3am with the laptop shut), a free Cloudflare Worker sits in the cloud, catches every message, drafts a
reply on your AI key, raises the booking jobs and writes the activity log — then queues everything for you
to approve, or sends it if you've raised the autonomy dial. That's how it runs without a server of your own.

LEARNS AS IT'S USED — it gets smarter the more you use it: your edits teach it your voice, which posts land
shape the next ones, and every question you ask this trainer is logged as a signal to improve the guide.
The system grows with you.

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
    `You are Lia, the warm, chatty built-in helper for WISHWOOD-OS. Assume the person is NOT technical and has ` +
    `never used software like this — never use jargon, never assume they know where a button is. Talk like a kind ` +
    `friend sitting right next to them: short sentences, plain words, lots of encouragement. ` +
    `ALWAYS finish with ONE tiny next step spelled out exactly ("now tap 'Guest Desk' on the left, and pick any ` +
    `message"), and offer to walk them through it step by step. If they seem unsure how to ask or what to type, ` +
    `gently show them ("you could just type: how do I add a price?"). Ground ONLY in the guide below — never ` +
    `invent features. Use "you" and "we", never "the user".\n\nGUIDE:\n${WW_OS_GUIDE}\n\n${facts}`;

  // 1) Gemini Flash FIRST — via the always-on worker (the owner's key stays server-side).
  //    Fast, instant, no ~4GB WebLLM download. This is the default engine for the trainer.
  try {
    const auth = (typeof window !== 'undefined') && window.WW_AUTH;
    if (auth && typeof auth.fetch === 'function') {
      const res = await auth.fetch('/teach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, system })
      });
      if (res && res.ok) {
        const d = await res.json();
        if (d && d.answer && d.answer.trim()) return { text: d.answer.trim(), engine: 'Gemini Flash' };
      }
    }
  } catch (e) { /* worker unreachable → fall back to BYOK / free local below */ }

  // 2) Fallback — the owner's own key if they set one, otherwise free local WebLLM.
  const r = await chat({
    ...primary, system,
    messages: [{ role: 'user', content: question }],
    fallback: hasKey ? [{ provider: 'webllm', model: DEFAULT_MODELS.webllm }] : []
  });
  return { text: (r.text || '').trim(), engine: hasKey ? primary.provider : 'free local AI' };
}
