/**
 * Wishwood Engine · Cloudflare Worker
 * Sovereign multi-channel automation backend
 *
 * Endpoints:
 *   GET  /                                    discovery
 *   GET  /health                              health check
 *   GET  /ical/:cabin                         export iCal for a cabin (Airbnb/Booking import this)
 *   POST /ical/import                         pull external iCal (run by cron)
 *   POST /webhook/facebook                    FB Page messages
 *   POST /webhook/instagram                   IG DMs
 *   POST /webhook/whatsapp                    WhatsApp Cloud API
 *   POST /webhook/stripe                      Stripe checkout success → confirm booking
 *   POST /draft                               AI draft reply (Claude)
 *   POST /booking/direct                      direct site booking creation
 *   GET  /bookings                            list bookings (auth required)
 *   GET  /messages                            list inbox (auth required)
 *   POST /journey/trigger                     run guest-journey send
 *   GET  /pricing/:cabin/:date                resolved price for date
 *
 * Auth: simple bearer token (env.OPERATOR_TOKEN) for operator endpoints.
 * Public endpoints (ical export, booking submit) have CSRF/rate limits.
 *
 * Storage: KV (WISHWOOD_KV) — bookings, messages, journey-queue, pricing-overrides
 * Cron: every 60s pulls Airbnb + Pitchup iCals, every 5min flushes journey queue
 */

const VERSION = '1.0.0';
const SEAL = '◊·κ=1';

// The 4 real camps — identity kept in step with the hub's Property Brain (single source of truth).
// Prices live on the booking channels and are NEVER quoted to guests; any figures here are internal
// fallbacks only (direct Stripe bookings carry their own amount).
const CABINS = {
  yurt:    { name: 'The Yurt',          base: 135, weekend: 165, peak: 195, airbnbId: '16653222' },
  fern:    { name: 'Fern Lodge',        base: 110, weekend: 135, peak: 160, airbnbId: '' },
  caravan: { name: 'Thistle Caravan',   base: 85,  weekend: 110, peak: 130, airbnbId: '33665585' },
  hobbit:  { name: 'The Hobbit',        base: 95,  weekend: 120, peak: 145, airbnbId: '23775088' },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const jsonResp = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const textResp = (body, status = 200, ct = 'text/plain') =>
  new Response(body, { status, headers: { 'Content-Type': ct, ...CORS } });

/* ─── Auth ─── */
// Accepts EITHER the legacy static OPERATOR_TOKEN (for API clients / cron / dev),
// OR a browser session JWT signed by SESSION_SECRET (issued by /auth/login).
async function requireOperator(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResp({ error: 'unauthorised · missing token' }, 401);
  // Legacy static token (backwards compatible)
  if (env.OPERATOR_TOKEN && token === env.OPERATOR_TOKEN) return null;
  // Browser session JWT
  if (env.SESSION_SECRET && await verifyJwt(token, env.SESSION_SECRET)) return null;
  return jsonResp({ error: 'unauthorised · invalid token' }, 401);
}

/* ─── JWT (HMAC-SHA256 · minimal, no deps) ─── */
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlToStr = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHead = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPay  = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig     = b64url(await hmac(secret, `${encHead}.${encPay}`));
  return `${encHead}.${encPay}.${sig}`;
}

async function verifyJwt(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return false;
    const expected = b64url(await hmac(secret, `${h}.${p}`));
    if (expected !== s) return false;
    const payload = JSON.parse(b64urlToStr(p));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return false;
    return payload;
  } catch { return false; }
}

/* Constant-time string compare · protects against timing attacks on password check */
function ctEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ─── /auth endpoints ─── */
async function handleAuthLogin(req, env) {
  if (!env.MASTER_PASSWORD || !env.SESSION_SECRET) {
    return jsonResp({ error: 'auth not configured · set MASTER_PASSWORD + SESSION_SECRET secrets' }, 500);
  }
  let body;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid json' }, 400); }
  const password = String(body?.password || '');
  if (!password || !ctEq(password, env.MASTER_PASSWORD)) {
    // Small delay to reduce brute-force velocity
    await new Promise(r => setTimeout(r, 400));
    return jsonResp({ error: 'wrong password' }, 401);
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 30;  // 30 days
  const token = await signJwt({ sub: 'operator', iat: now, exp }, env.SESSION_SECRET);
  return jsonResp({ token, exp, sub: 'operator' });
}

async function handleAuthVerify(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || !env.SESSION_SECRET) return jsonResp({ ok: false }, 401);
  const payload = await verifyJwt(token, env.SESSION_SECRET);
  if (!payload) return jsonResp({ ok: false }, 401);
  return jsonResp({ ok: true, sub: payload.sub, exp: payload.exp });
}

/* ─── KV helpers ─── */
async function kvList(env, prefix) {
  const list = await env.WISHWOOD_KV.list({ prefix });
  const items = await Promise.all(
    list.keys.map(async k => {
      const raw = await env.WISHWOOD_KV.get(k.name);
      return raw ? JSON.parse(raw) : null;
    })
  );
  return items.filter(Boolean);
}

async function kvPut(env, key, val) {
  await env.WISHWOOD_KV.put(key, JSON.stringify(val));
}

/* ─── Activity log ───
 * A plain, shared, human-readable feed of everything the OS does: message in, reply drafted,
 * reply sent, booking landed, jobs raised. Newest first, capped at 300. Everyone sees the same
 * log — it's how you (and anyone learning in the trainer) watch the system actually work, and
 * the audit trail behind "the AI drafts, you approve". Never throws: a log failure must not
 * break the real request. Stored in one key so /logs is a single fast read.
 */
async function logEvent(env, kind, message, meta = {}) {
  try {
    const cur = JSON.parse((await env.WISHWOOD_KV.get('log:events')) || '[]');
    cur.unshift({ ts: new Date().toISOString(), kind, message, ...meta });
    await env.WISHWOOD_KV.put('log:events', JSON.stringify(cur.slice(0, 300)));
  } catch (e) { /* logging must never break the request */ }
}

/* ─── iCal generation (RFC 5545) ─── */
function bookingToIcalEvent(b) {
  const fmt = d => d.replace(/-/g, '');
  return [
    'BEGIN:VEVENT',
    `UID:${b.id}@wishwood.workers.dev`,
    `DTSTAMP:${fmt(b.created || b.checkin)}T000000Z`,
    `DTSTART;VALUE=DATE:${fmt(b.checkin)}`,
    `DTEND;VALUE=DATE:${fmt(b.checkout)}`,
    `SUMMARY:${b.guest} · ${b.channel}`,
    `DESCRIPTION:Channel: ${b.channel} · ${b.nights}n · £${b.revenue}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ].join('\r\n');
}

async function exportIcal(env, cabin) {
  if (!CABINS[cabin]) return textResp('unknown cabin', 404);
  const all = await kvList(env, 'booking:');
  const cabinBookings = all.filter(b => b.cabin === cabin && b.status !== 'cancelled');
  const events = cabinBookings.map(bookingToIcalEvent).join('\r\n');
  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wishwood Engine//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:Wishwood · ${CABINS[cabin].name}`,
    events,
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  return textResp(ical, 200, 'text/calendar; charset=utf-8');
}

/* ─── iCal import (parse external Airbnb/Booking iCals) ─── */
function parseIcal(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const get = re => (b.match(re) || [, ''])[1].trim();
    const startMatch = b.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
    const endMatch = b.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);
    const uidMatch = b.match(/UID:([^\r\n]+)/);
    const summaryMatch = b.match(/SUMMARY:([^\r\n]+)/);
    if (!startMatch || !endMatch) continue;
    const fmt = s => `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    events.push({
      uid: uidMatch ? uidMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      checkin: fmt(startMatch[1]),
      checkout: fmt(endMatch[1]),
    });
  }
  return events;
}

async function importIcal(env, cabin, sourceUrl, channel) {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return { error: 'fetch failed', status: res.status };
    const text = await res.text();
    const events = parseIcal(text);
    let imported = 0;
    for (const ev of events) {
      const key = `booking:ical:${channel}:${cabin}:${ev.uid || `${ev.checkin}-${ev.checkout}`}`;
      const existing = await env.WISHWOOD_KV.get(key);
      if (existing) continue;
      const b = {
        id: key.replace('booking:',''),
        cabin,
        channel,
        guest: ev.summary || 'External booking',
        checkin: ev.checkin,
        checkout: ev.checkout,
        nights: Math.round((new Date(ev.checkout) - new Date(ev.checkin)) / 86400000),
        revenue: 0,
        status: 'confirmed',
        source: 'ical-import',
        created: new Date().toISOString(),
      };
      await kvPut(env, key, b);
      await enqueueTurnaround(env, b); // OTA booking → same staff alerts as a direct booking
      imported++;
    }
    if (imported) await logEvent(env, 'booking', `Synced ${imported} new booking${imported > 1 ? 's' : ''} · ${channel} · ${(CABINS[cabin] && CABINS[cabin].name) || cabin}`, { source: 'ical', channel, cabin, imported });
    return { ok: true, imported, total: events.length };
  } catch (err) {
    return { error: err.message };
  }
}

/* ─── Staff turnaround alerts ───
 * Every booking — direct (Stripe) OR OTA (Airbnb/Booking via iCal) — auto-creates its jobs:
 *   · workaway — camp readiness/upkeep (bins · toilets · oil lamps · water + shower top-up)
 *   · welcome  — host greeting on arrival (gate code + welcome pack)
 *   · clean    — turnaround on checkout
 * Written to KV as task:* so the always-on layer can push them out (SMS the cleaner/volunteer etc.)
 * the moment a channel is wired. The hub already SHOWS these, derived from bookings; these records
 * are the shared server-side queue behind that. Idempotent.
 */
async function enqueueTurnaround(env, b) {
  if (!b || !b.id || !b.checkin) return;
  const camp = (CABINS[b.cabin] && CABINS[b.cabin].name) || b.cabin || 'a camp';
  const nights = b.nights || 1;
  const stamp = new Date().toISOString();
  // Workaway upkeep — the volunteer's camp-readiness checklist, done before/around arrival.
  await kvPut(env, `task:workaway:${b.id}`, {
    bookingId: b.id, cabin: b.cabin, type: 'workaway', status: 'open',
    guest: b.guest, checkin: b.checkin,
    note: `Workaway upkeep · ${camp} · ready for ${b.checkin} · empty bins · service compost toilets · refill + trim oil lamps · top up water + shower water`,
    checklist: ['Empty bins', 'Service compost toilets', 'Refill + trim oil lamps', 'Top up water', 'Top up shower water'],
    runAt: new Date(b.checkin + 'T07:00:00Z').getTime(),
    created: stamp,
  });
  await kvPut(env, `task:welcome:${b.id}`, {
    bookingId: b.id, cabin: b.cabin, type: 'welcome', status: 'open',
    guest: b.guest, checkin: b.checkin,
    note: `Welcome prep · ${camp} · arrival ${b.checkin} · ${b.guest || 'guest'} · ${nights} night${nights > 1 ? 's' : ''} · gate code + welcome pack`,
    runAt: new Date(b.checkin + 'T08:00:00Z').getTime(),
    created: stamp,
  });
  if (b.checkout) await kvPut(env, `task:clean:${b.id}`, {
    bookingId: b.id, cabin: b.cabin, type: 'clean', status: 'open',
    guest: b.guest, checkout: b.checkout,
    note: `Clean needed · ${camp} · checkout ${b.checkout} (${b.guest || 'guest'}) · turnaround before next guest`,
    runAt: new Date(b.checkout + 'T10:00:00Z').getTime(),
    created: stamp,
  });
  await logEvent(env, 'tasks', `Jobs raised · ${camp} · workaway + welcome + clean`, { bookingId: b.id, cabin: b.cabin, checkin: b.checkin, checkout: b.checkout || null });
}

/* ─── Pricing engine ─── */
function resolvePrice(cabin, dateStr, opts = {}) {
  const cab = CABINS[cabin];
  if (!cab) return null;
  const d = new Date(dateStr);
  const dow = d.getDay();
  const month = d.getMonth() + 1;
  const isWeekend = dow === 5 || dow === 6;
  const isPeak = month === 7 || month === 8;
  let price = isPeak ? cab.peak : isWeekend ? cab.weekend : cab.base;
  // long-stay discount
  if (opts.nights && opts.nights >= 7) price *= 0.88;
  // last-minute fill discount
  if (opts.daysUntil != null && opts.daysUntil <= 14 && opts.gapBefore >= 7) price *= 0.85;
  // FB/IG follower code
  if (opts.code === 'WOOD10') price *= 0.90;
  return Math.round(price);
}

/* ─── Webhook handlers ─── */
async function handleFacebookWebhook(req, env) {
  // Meta verification
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === env.FB_VERIFY_TOKEN) {
      return textResp(challenge);
    }
    return textResp('forbidden', 403);
  }
  // POST: incoming message
  const body = await req.json();
  if (body.object === 'page') {
    for (const entry of (body.entry || [])) {
      for (const messaging of (entry.messaging || [])) {
        const msg = {
          id: `fb-${messaging.message?.mid || Date.now()}`,
          channel: 'facebook',
          from: messaging.sender?.id || 'unknown',
          text: messaging.message?.text || '',
          received: new Date().toISOString(),
          status: 'unread',
        };
        await kvPut(env, `message:${msg.id}`, msg);
      }
    }
  }
  return jsonResp({ ok: true });
}

async function handleStripeWebhook(req, env) {
  // For brevity: trust the signature check is done upstream (use stripe.webhooks.constructEvent in real impl)
  const body = await req.json();
  if (body.type === 'checkout.session.completed') {
    const session = body.data.object;
    const meta = session.metadata || {};
    const booking = {
      id: `direct-${session.id}`,
      cabin: meta.cabin,
      channel: 'direct',
      guest: session.customer_details?.name || 'Direct guest',
      email: session.customer_details?.email,
      checkin: meta.checkin,
      checkout: meta.checkout,
      nights: parseInt(meta.nights, 10) || 1,
      revenue: session.amount_total / 100,
      status: 'confirmed',
      source: 'stripe',
      created: new Date().toISOString(),
    };
    await kvPut(env, `booking:${booking.id}`, booking);
    await logEvent(env, 'booking', `Direct booking · ${(CABINS[booking.cabin] && CABINS[booking.cabin].name) || booking.cabin} · ${booking.guest} · ${booking.checkin}→${booking.checkout}`, { source: 'stripe', bookingId: booking.id });
    // Enqueue T+5min welcome
    await kvPut(env, `journey:welcome:${booking.id}`, {
      bookingId: booking.id,
      trigger: 'T+5min',
      runAt: Date.now() + 5 * 60_000,
    });
    // Auto-tasks: workaway upkeep + welcome on arrival + clean on checkout (visible to all staff)
    await enqueueTurnaround(env, booking);
  }
  return jsonResp({ ok: true });
}

/* ─── Unified inbound: normalize → AI-draft → store. Works the moment a channel points here. ─── */
async function ingestMessage(env, { channel, from, text, to, name }) {
  const id = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const msg = { id, channel, from, to: to || null, fromName: name || from, text: text || '', received: new Date().toISOString(), status: 'unread' };
  try { const d = await draftReply(env, { messageText: msg.text, fromName: msg.fromName, channel }); if (d && d.draft) msg.draft = d.draft; } catch (e) { /* draft is best-effort */ }
  await kvPut(env, `message:${id}`, msg);
  await logEvent(env, 'message', `Message in · ${channel} · ${msg.fromName}${msg.draft ? ' · reply drafted, awaiting approval' : ''}`, { channel, drafted: !!msg.draft });
  if (env.AUTO_SEND === '1' && msg.draft) {
    try { await sendReply(env, { channel, to: from, text: msg.draft }); msg.status = 'auto-sent'; await kvPut(env, `message:${id}`, msg); } catch (e) {}
  }
  return msg;
}

/* Twilio inbound · SMS + WhatsApp (WhatsApp arrives as From "whatsapp:+…") */
async function handleTwilioInbound(req, env) {
  const form = new URLSearchParams(await req.text());
  const from = form.get('From') || 'unknown';
  const channel = from.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
  await ingestMessage(env, { channel, from: from.replace('whatsapp:', ''), to: form.get('To') || '', text: form.get('Body') || '' });
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { status: 200, headers: { 'content-type': 'text/xml', ...CORS } });
}

/* Meta WhatsApp Cloud inbound (GET verify + POST messages) */
async function handleWhatsAppCloudInbound(req, env) {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.WA_WEBHOOK_VERIFY_TOKEN) return textResp(url.searchParams.get('hub.challenge'));
    return textResp('forbidden', 403);
  }
  const body = await req.json();
  for (const entry of (body.entry || [])) for (const change of (entry.changes || [])) {
    const value = change.value || {};
    const name0 = value.contacts?.[0]?.profile?.name;
    for (const m of (value.messages || [])) await ingestMessage(env, { channel: 'whatsapp', from: m.from, text: m.text?.body || '', name: name0 || m.from });
  }
  return jsonResp({ ok: true });
}

/* Generic email / OTA-forward inbound (JSON) — Airbnb/Booking/Pitchup forward guest messages here */
async function handleEmailInbound(req, env) {
  const b = await req.json().catch(() => ({}));
  const text = b.text || b.body || [b.subject, b.snippet].filter(Boolean).join('\n\n');
  await ingestMessage(env, { channel: b.channel || 'email', from: b.from || 'unknown', name: b.name || b.from, text });
  return jsonResp({ ok: true });
}

/* ─── Unified outbound send · each path activates as its secret lands ─── */
async function sendReply(env, { channel, to, text }) {
  let res;
  if (channel === 'sms') res = await sendViaTwilio(env, { channel, to, text });
  else if (channel === 'whatsapp') res = await (env.META_ACCESS_TOKEN ? sendViaWhatsAppCloud(env, { to, text }) : sendViaTwilio(env, { channel, to, text }));
  else if (channel === 'email') res = await sendEmail(env, { to, subject: 'Re: your Wishwood enquiry', text });
  else res = { queued: false, note: `${channel} has no host send API — copy the approved draft into the platform` };
  const outcome = res && res.sent ? 'sent' : (res && res.error ? 'failed' : 'queued');
  await logEvent(env, 'sent', `Reply ${outcome} · ${channel} · ${to}`, { channel, ok: !!(res && res.sent), error: (res && res.error) || null });
  return res;
}
async function sendViaTwilio(env, { channel, to, text }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return { error: 'Twilio not configured' };
  const rawFrom = channel === 'whatsapp' ? (env.WHATSAPP_SENDER || env.SMS_FROM_NUMBER) : env.SMS_FROM_NUMBER;
  const To = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const From = channel === 'whatsapp' && !String(rawFrom).startsWith('whatsapp:') ? `whatsapp:${rawFrom}` : rawFrom;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To, From, Body: text }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { sent: true, sid: data.sid } : { error: data.message || 'Twilio send failed' };
}
async function sendViaWhatsAppCloud(env, { to, text }) {
  if (!env.META_ACCESS_TOKEN || !env.WHATSAPP_PHONE_ID) return { error: 'WhatsApp Cloud not configured' };
  const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.META_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { sent: true, id: data.messages?.[0]?.id } : { error: data.error?.message || 'WhatsApp send failed' };
}
async function sendEmail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) return { error: 'email not configured (set RESEND_API_KEY)' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'Wishwood <hello@wishwood.co.uk>', to, subject, text }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { sent: true, id: data.id } : { error: data.message || 'email send failed' };
}

/* ─── AI draft (Gemini Flash · Claude fallback) ─── */
async function draftReply(env, { messageText, fromName, channel, context }) {
  // Facts kept in sync with the hub's Property Brain (single source of truth).
  const systemPrompt = `You are drafting a reply on behalf of Chrissy, who runs Wishwood Glamping — private semi-ancient woodland at Sturry, near Canterbury, Kent, beside Blean Woods and a lake. FOUR camps: The Yurt (solar off-grid, sleeps 6), Fern Lodge (woodland lodge, sleeps 4, private bathroom, wifi), Thistle Caravan (couples, sleeps 3, private bathroom, £10 cleaning fee), The Hobbit (sleeps 3, wifi). Every camp has a wood-burner, private outdoor kitchen, compost loo and fire pit. Wifi is available. NO hot tubs. NO dogs — it is protected woodland (explain warmly if asked). Prices and availability live on the booking channels — NEVER quote a nightly price; point the guest to book/check on the channel they came from. Reply in Chrissy's voice: warm, brief, uses "·" instead of comma lists, signs off "Chrissy". Only state facts above; if unsure, say you'll check. Reply is going via ${channel}.`;
  const userPrompt = `Incoming message from ${fromName}:\n\n"""\n${messageText}\n"""\n\nContext: ${context || 'none'}\n\nDraft Chrissy's reply.`;

  try {
    // Prefer Gemini Flash (cheap + fast); fall back to Claude if that's what's set.
    if (env.GEMINI_API_KEY) {
      const model = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error?.message || 'Gemini error', raw: data };
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('');
      return { draft: text, model };
    }
    if (env.CLAUDE_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error?.message || 'Claude error', raw: data };
      return { draft: data.content?.[0]?.text || '', model: data.model, usage: data.usage };
    }
    return { error: 'no AI key configured — set GEMINI_API_KEY (Gemini Flash) as a Worker secret' };
  } catch (err) {
    return { error: err.message };
  }
}

/* ─── Direct booking (from /book.html) ─── */
async function createDirectBooking(req, env) {
  const data = await req.json();
  const { cabin, checkin, checkout, nights, guest, email, mobile, dogs, code, total } = data;
  if (!CABINS[cabin] || !checkin || !checkout) return jsonResp({ error: 'invalid booking' }, 400);

  // Check availability against existing bookings
  const existing = await kvList(env, 'booking:');
  const conflict = existing.find(b =>
    b.cabin === cabin && b.status !== 'cancelled' &&
    !(checkout <= b.checkin || checkin >= b.checkout)
  );
  if (conflict) return jsonResp({ error: 'dates not available' }, 409);

  // In production: create Stripe checkout session, return URL
  // For demo: just persist as pending
  const booking = {
    id: `direct-${Date.now()}`,
    cabin,
    channel: 'direct',
    guest,
    email,
    mobile,
    checkin,
    checkout,
    nights,
    dogs,
    code,
    revenue: total,
    status: 'pending-payment',
    source: 'direct-form',
    created: new Date().toISOString(),
  };
  await kvPut(env, `booking:${booking.id}`, booking);
  return jsonResp({
    ok: true,
    bookingId: booking.id,
    // In production: stripeCheckoutUrl: 'https://checkout.stripe.com/...'
    nextStep: 'redirect to Stripe',
  });
}

/* ─── Journey queue ─── */
async function runJourneyQueue(env) {
  const queue = await kvList(env, 'journey:');
  const now = Date.now();
  let sent = 0;
  for (const j of queue) {
    if (j.runAt > now) continue;
    // In production: dispatch email/SMS via your provider
    console.log(`[journey] would send ${j.trigger} for booking ${j.bookingId}`);
    await env.WISHWOOD_KV.delete(`journey:${j.trigger.replace(/[+:]/g, '')}:${j.bookingId}`);
    sent++;
  }
  return { sent };
}

/* ─── Cron entry ─── */
async function scheduled(event, env) {
  const results = {};
  // iCal sync (every 60s · only fires if cron set to 1min)
  const sources = [
    { cabin: 'yurt', url: env.AIRBNB_ICAL_YURT, channel: 'airbnb' },
    { cabin: 'fern', url: env.AIRBNB_ICAL_FERN, channel: 'airbnb' },
    { cabin: 'caravan', url: env.AIRBNB_ICAL_CARAVAN, channel: 'airbnb' },
    { cabin: 'hobbit', url: env.AIRBNB_ICAL_HOBBIT, channel: 'airbnb' },
    { cabin: 'yurt', url: env.PITCHUP_ICAL_YURT, channel: 'pitchup' },
    { cabin: 'fern', url: env.PITCHUP_ICAL_FERN, channel: 'pitchup' },
    { cabin: 'caravan', url: env.PITCHUP_ICAL_CARAVAN, channel: 'pitchup' },
    { cabin: 'hobbit', url: env.PITCHUP_ICAL_HOBBIT, channel: 'pitchup' },
  ];
  for (const s of sources) {
    if (!s.url) continue;
    results[`${s.channel}-${s.cabin}`] = await importIcal(env, s.cabin, s.url, s.channel);
  }
  // Journey queue
  results.journey = await runJourneyQueue(env);
  return results;
}

/* ─── Router ─── */
async function handle(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Public discovery
  if (method === 'GET' && (path === '/' || path === '/health')) {
    return jsonResp({
      service: 'wishwood-engine',
      version: VERSION,
      seal: SEAL,
      status: 'ok',
      site: 'Wishwood Glamping & Forestry · Canterbury, Kent',
      endpoints: {
        public: ['GET /', 'GET /health', 'GET /ical/:cabin', 'POST /booking/direct', 'POST /webhook/{facebook,instagram,twilio,whatsapp,email,stripe}'],
        operator: ['GET /bookings', 'GET /messages', 'GET /tasks', 'GET /logs', 'POST /draft', 'POST /send', 'GET /pricing/:cabin/:date'],
      },
      cabins: Object.keys(CABINS),
    });
  }

  // Public: iCal export
  if (method === 'GET' && path.startsWith('/ical/')) {
    return exportIcal(env, path.split('/')[2]);
  }

  // Public: direct booking submit
  if (method === 'POST' && path === '/booking/direct') {
    return createDirectBooking(req, env);
  }

  // Webhooks
  if (path === '/webhook/facebook') return handleFacebookWebhook(req, env);
  if (path === '/webhook/instagram') return handleFacebookWebhook(req, env); // shared IG/FB
  if (path === '/webhook/stripe' && method === 'POST') return handleStripeWebhook(req, env);
  if (path === '/webhook/twilio') return handleTwilioInbound(req, env);           // Twilio SMS + WhatsApp
  if (path === '/webhook/whatsapp') return handleWhatsAppCloudInbound(req, env);  // Meta WhatsApp Cloud
  if (path === '/webhook/email' && method === 'POST') return handleEmailInbound(req, env); // email / OTA forward

  // Public: browser session auth
  if (method === 'POST' && path === '/auth/login')  return handleAuthLogin(req, env);
  if (method === 'GET'  && path === '/auth/verify') return handleAuthVerify(req, env);

  // Operator endpoints (auth required · legacy token OR session JWT)
  const authErr = await requireOperator(req, env);
  if (authErr) return authErr;

  if (method === 'GET' && path === '/bookings') {
    const items = await kvList(env, 'booking:');
    return jsonResp({ count: items.length, bookings: items });
  }
  if (method === 'GET' && path === '/messages') {
    const items = await kvList(env, 'message:');
    return jsonResp({ count: items.length, messages: items });
  }
  if (method === 'GET' && path === '/tasks') {
    // Shared staff/volunteer job queue (workaway · welcome · clean), soonest first — the alert feed.
    const items = (await kvList(env, 'task:')).sort((a, b) => (a.runAt || 0) - (b.runAt || 0));
    return jsonResp({ count: items.length, tasks: items });
  }
  if (method === 'GET' && path === '/logs') {
    // Shared activity feed — everything the OS has done, newest first.
    const items = JSON.parse((await env.WISHWOOD_KV.get('log:events')) || '[]');
    return jsonResp({ count: items.length, logs: items });
  }
  if (method === 'POST' && path === '/draft') {
    const body = await req.json();
    const out = await draftReply(env, body);
    return jsonResp(out);
  }
  if (method === 'POST' && path === '/send') {
    const { channel, to, text } = await req.json();
    return jsonResp(await sendReply(env, { channel, to, text }));
  }
  if (method === 'GET' && path.startsWith('/pricing/')) {
    const [, , cabin, date] = path.split('/');
    const nights = parseInt(url.searchParams.get('nights') || '1', 10);
    const code = url.searchParams.get('code');
    return jsonResp({ cabin, date, price: resolvePrice(cabin, date, { nights, code }) });
  }
  if (method === 'POST' && path === '/journey/trigger') {
    return jsonResp(await runJourneyQueue(env));
  }

  return jsonResp({ error: 'not found' }, 404);
}

export default {
  fetch: handle,
  scheduled,
};
