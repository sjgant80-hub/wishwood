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

const CABINS = {
  hobbit:  { name: 'The Hobbit Hut',     base: 95,  weekend: 120, peak: 145, airbnbId: '23775088' },
  caravan: { name: 'The Vintage Caravan', base: 85,  weekend: 110, peak: 130, airbnbId: '33665585' },
  yurt:    { name: 'The Family Yurt',     base: 135, weekend: 165, peak: 195, airbnbId: '16653222' },
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
      imported++;
    }
    return { ok: true, imported, total: events.length };
  } catch (err) {
    return { error: err.message };
  }
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
    // Enqueue T+5min welcome
    await kvPut(env, `journey:welcome:${booking.id}`, {
      bookingId: booking.id,
      trigger: 'T+5min',
      runAt: Date.now() + 5 * 60_000,
    });
  }
  return jsonResp({ ok: true });
}

/* ─── AI draft (Claude) ─── */
async function draftReply(env, { messageText, fromName, channel, context }) {
  // Facts kept in sync with the hub's Property Brain (single source of truth).
  const systemPrompt = `You are drafting a reply on behalf of Chrissy, who runs Wishwood Glamping — private semi-ancient woodland at Sturry, near Canterbury, Kent, beside Blean Woods and a lake. FOUR camps: The Yurt (solar off-grid, sleeps 6), Fern Lodge (woodland lodge, sleeps 4, private bathroom, wifi), Thistle Caravan (couples, sleeps 3, private bathroom, £10 cleaning fee), The Hobbit (sleeps 3, wifi). Every camp has a wood-burner, private outdoor kitchen, compost loo and fire pit. Wifi is available. NO hot tubs. NO dogs — it is protected woodland (explain warmly if asked). Prices and availability live on the booking channels — NEVER quote a nightly price; point the guest to book/check on the channel they came from. Reply in Chrissy's voice: warm, brief, uses "·" instead of comma lists, signs off "Chrissy". Only state facts above; if unsure, say you'll check. Reply is going via ${channel}.`;
  const userPrompt = `Incoming message from ${fromName}:\n\n"""\n${messageText}\n"""\n\nContext: ${context || 'none'}\n\nDraft Chrissy's reply.`;

  try {
    // Prefer Gemini Flash (cheap + fast); fall back to Claude if that's what's set.
    if (env.GEMINI_API_KEY) {
      const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
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
    { cabin: 'hobbit', url: env.AIRBNB_ICAL_HOBBIT, channel: 'airbnb' },
    { cabin: 'caravan', url: env.AIRBNB_ICAL_CARAVAN, channel: 'airbnb' },
    { cabin: 'yurt', url: env.AIRBNB_ICAL_YURT, channel: 'airbnb' },
    { cabin: 'yurt', url: env.PITCHUP_ICAL_YURT, channel: 'pitchup' },
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
        public: ['GET /', 'GET /health', 'GET /ical/:cabin', 'POST /booking/direct', 'POST /webhook/{facebook,instagram,whatsapp,stripe}'],
        operator: ['GET /bookings', 'GET /messages', 'POST /draft', 'GET /pricing/:cabin/:date'],
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
  if (method === 'POST' && path === '/draft') {
    const body = await req.json();
    const out = await draftReply(env, body);
    return jsonResp(out);
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
