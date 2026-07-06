/* Wishwood · Social Media Autopilot engine.
 * Kernel-grounded post generation · content calendar · approval queue · scheduling.
 * Reuses ai/adapter.js (BYOK LLM), ai/events.js (signed log), ai/agent.js (autonomy dial).
 * Hospitality-native. Categories, cadence, and voice all derived from the wishwood kernel.
 */

import { chat } from './adapter.js';
import { logEvent } from './events.js';
import { activeInsightsContext } from './research.js';

/* ---- Hospitality category recipes · monthly cadence · voice flavour ---- */

export const CATEGORIES = [
  {
    key: 'property',
    label: 'Property showcase',
    icon: '◊',
    per_month: 8,
    day_pref: ['Mon', 'Wed', 'Fri'],
    tone_hint: 'proud, unhurried, showing without selling',
    prompts_by_slot: [
      'A specific room or corner of the property. What makes it feel like home for a guest arriving tonight.',
      'The log burner / hearth / cosy focal point. Sensory language. Warmth, sound, texture.',
      'An amenity that guests always comment on (from kernel.property.amenities). Why it matters.',
      'The kitchen. What guests can cook, or what tea/coffee awaits on arrival.',
      'The garden or outdoor space. What it looks like right now, this season.',
      'A quirky detail (from kernel.property.quirks). Something charming that pictures alone miss.',
      'The view. Sunrise, sunset, window at 4pm.',
      'What the property is NOT (from kernel.property.not_present). Framed positively — quiet is a feature.'
    ]
  },
  {
    key: 'local',
    label: 'Local guide',
    icon: '⚑',
    per_month: 6,
    day_pref: ['Tue', 'Sat'],
    tone_hint: 'local, generous, insider-not-tourist',
    prompts_by_slot: [
      'A walk within 10 minutes of the property. What you see, what you carry, where you finish.',
      'The best local pub or café. Specific dish or drink to order.',
      'A weekend market, farm shop, or seasonal spot.',
      'A hidden gem the guidebooks miss.',
      'Something that only happens this time of year in the local area.',
      'A rainy-day activity in the area.'
    ]
  },
  {
    key: 'guest_moment',
    label: 'Guest moments',
    icon: '♡',
    per_month: 4,
    day_pref: ['Thu'],
    tone_hint: 'warm, grateful, letting the guest lead the story',
    prompts_by_slot: [
      'A five-star review turned into a short story (with review text as anchor). No name unless permitted.',
      'A milestone stay — anniversary, birthday, quiet retreat.',
      'A note or gift a guest left behind.',
      'A moment from turnover the housekeeper mentioned.'
    ]
  },
  {
    key: 'behind_scenes',
    label: 'Behind the scenes',
    icon: '⚒',
    per_month: 4,
    day_pref: ['Sun'],
    tone_hint: 'honest, hands-in-it, humble',
    prompts_by_slot: [
      'Turnover day. What happens between guests. Real, unglamorous, honest.',
      'A small improvement made this month.',
      'The owner story. Why this property, why hosting.',
      'A supplier or local business who quietly makes the property work.'
    ]
  },
  {
    key: 'seasonal',
    label: 'Seasonal moments',
    icon: '❋',
    per_month: 4,
    day_pref: ['Wed'],
    tone_hint: 'noticing, in-the-moment, sensory',
    prompts_by_slot: [
      'What the property looks like RIGHT NOW this week. Weather, light, mood.',
      'A seasonal detail — first snowdrops, autumn colour, summer garden peak.',
      'Something the property does best in this season.',
      'A local seasonal event or tradition guests could join.'
    ]
  },
  {
    key: 'availability',
    label: 'Availability / booking',
    icon: '⌘',
    per_month: 4,
    day_pref: ['Fri'],
    tone_hint: 'clear, low-pressure, useful',
    prompts_by_slot: [
      'A gap week that would suit a specific type of guest (couple, family, remote worker).',
      'A last-minute gap this weekend or next.',
      'Availability for a specific holiday or event (bank holiday, half-term, local festival).',
      'Direct-booking benefit (better rate, message the owner, guaranteed cottage-specific detail).'
    ]
  },
  {
    key: 'local_outreach',
    label: 'Local outreach & promotions',
    icon: '⚡',
    per_month: 4,
    day_pref: ['Thu', 'Fri'],
    tone_hint: 'community-first, specific, honest scarcity · never manufactured urgency',
    prompts_by_slot: [
      'Post for a local Facebook group (village community, town noticeboard, what\'s on locally). Community-first tone. Not selling · offering. Include real specific dates if promoting availability.',
      'Last-minute weekend gap · buy 2 nights get 1 free · or 50% off · for locals or nearby friends & family. Frame honestly: "rather see you enjoy it than sit empty."',
      'Post targeted at people visiting a specific local event (fair, race, festival). Real dates, specific attendee benefit.',
      'Referral prompt for past guests or local followers · "know anyone visiting the area · here\'s a direct-booking code."'
    ]
  }
];

export const CHANNELS = [
  { key: 'instagram', label: 'Instagram', icon: '◐', max_chars: 2200, hashtag_target: 15, image_required: true },
  { key: 'facebook',  label: 'Facebook',  icon: '◑', max_chars: 5000, hashtag_target: 3,  image_required: false },
  { key: 'tiktok',    label: 'TikTok',    icon: '◒', max_chars: 2200, hashtag_target: 6,  image_required: true, video_preferred: true },
  { key: 'pinterest', label: 'Pinterest', icon: '◓', max_chars: 500,  hashtag_target: 5,  image_required: true }
];

/* ---- State ---- */

const KEYS = {
  posts: 'wishwood.social.posts',
  autonomy: 'wishwood.social.autonomy',
  cadence: 'wishwood.social.cadence',
  channels_enabled: 'wishwood.social.channels_enabled'
};

export function loadPosts() {
  try { return JSON.parse(localStorage.getItem(KEYS.posts) || '[]'); } catch { return []; }
}
export function savePosts(posts) {
  localStorage.setItem(KEYS.posts, JSON.stringify(posts.slice(-300)));
  window.dispatchEvent(new CustomEvent('wishwood:social-updated'));
}
export function upsertPost(post) {
  const posts = loadPosts();
  const idx = posts.findIndex(p => p.id === post.id);
  if (idx >= 0) posts[idx] = post;
  else posts.unshift(post);
  savePosts(posts);
  return post;
}
export function deletePost(id) {
  const posts = loadPosts().filter(p => p.id !== id);
  savePosts(posts);
}

export function loadAutonomy() {
  try { return JSON.parse(localStorage.getItem(KEYS.autonomy) || '{"mode":"watch"}'); }
  catch { return { mode: 'watch' }; }
}
export function saveAutonomy(a) { localStorage.setItem(KEYS.autonomy, JSON.stringify(a)); }

export function loadEnabledChannels() {
  try { return JSON.parse(localStorage.getItem(KEYS.channels_enabled) || '["instagram","facebook"]'); }
  catch { return ['instagram', 'facebook']; }
}
export function saveEnabledChannels(list) { localStorage.setItem(KEYS.channels_enabled, JSON.stringify(list)); }

/* ---- Composer · kernel-grounded LLM draft ---- */

export async function composeDraft({ category, channel, slot = 0, kernel, provider, model, key, extra_context = '' }) {
  const cat = CATEGORIES.find(c => c.key === category);
  const ch = CHANNELS.find(c => c.key === channel);
  if (!cat || !ch) throw new Error('unknown category or channel');

  const propertyName = kernel?.property?.name || 'the property';
  const tone = kernel?.voice?.tone || 'warm';
  const banned = (kernel?.voice?.banned_phrases || []).join(', ');
  const signature = kernel?.voice?.signature || '';
  const notPresent = (kernel?.property?.not_present || []).join(', ');
  const amenities = (kernel?.property?.amenities || []).join(', ');
  const quirks = (kernel?.property?.quirks || []).join(', ');
  const region = kernel?.property?.location?.region || '';

  const slotPrompt = cat.prompts_by_slot[slot % cat.prompts_by_slot.length];

  /* Kernel sales psychology block · Cialdini + Freud + Jung archetypes */
  const psych = kernel?.sales_psychology || {};
  const activePrinciples = psych.principles || {};
  const applicablePrinciples = _pickApplicablePrinciples(category, activePrinciples);
  const archetypes = psych.archetypes || null;
  const bannedTactics = (psych.banned_tactics || []).join(', ');

  /* Research context · accumulated Gemini/other insights that were marked active */
  const research = activeInsightsContext(2500);

  const psychBlock = applicablePrinciples.length
    ? `SALES PSYCHOLOGY (apply subtly · not as slogans):\n${applicablePrinciples.map(p => `- ${p.name}: ${p.how}`).join('\n')}\n${archetypes ? `Archetypes: ${archetypes.primary}${archetypes.secondary ? ' + ' + archetypes.secondary : ''} · ${archetypes.voice_signature || ''}` : ''}\n${bannedTactics ? 'NEVER use: ' + bannedTactics : ''}\n`
    : '';

  const system = `You are the social-media voice of ${propertyName}, a UK holiday-rental property. You write posts for the property's own accounts.

CRITICAL RULES:
- Voice tone: ${tone} · ${cat.tone_hint}
- Banned phrases (never use): ${banned || 'none listed'}
- Do NOT mention amenities that aren't present: ${notPresent || 'no restrictions'}
- Available amenities: ${amenities || 'none listed'}
- Property quirks worth mentioning: ${quirks || 'none listed'}
- Region: ${region || 'the local area'}
- Channel: ${ch.label} · max ${ch.max_chars} characters · aim for ${ch.hashtag_target} hashtags
- No "check out our", "book now", "amazing", "absolutely stunning" · no exclamation stacking
- Write like the owner would write · one voice · not agency copy

${psychBlock}
${research}

Return STRICT JSON:
{
  "caption": "the post copy · under ${ch.max_chars} chars · no leading emoji stack",
  "hashtags": ["#tag1", "#tag2", ...],
  "image_prompt": "one sentence describing the ideal image · no camera jargon · a scene the owner could photograph",
  "publish_notes": "any owner-facing note about timing, sensitivity, or context"
}`;

  const user = `Category: ${cat.label}
Slot brief: ${slotPrompt}
${extra_context ? 'Additional context: ' + extra_context : ''}

Write the post. JSON only.`;

  const r = await chat({
    provider, model, key,
    system,
    messages: [{ role: 'user', content: user }]
  });

  const parsed = _extractJson(r.text) || {};
  const post = {
    id: crypto.randomUUID(),
    category,
    channel,
    slot,
    caption: parsed.caption || r.text.slice(0, ch.max_chars),
    hashtags: parsed.hashtags || [],
    image_prompt: parsed.image_prompt || '',
    publish_notes: parsed.publish_notes || '',
    status: 'draft',
    created_at: new Date().toISOString(),
    scheduled_for: null,
    approved_by: null,
    published_at: null,
    provider,
    model
  };

  upsertPost(post);
  await logEvent({ type: 'social_draft', payload: { id: post.id, category, channel, slot } });
  return post;
}

/* Map category → which Cialdini principles are most relevant */
const CATEGORY_PRINCIPLES = {
  property: ['authority', 'liking'],
  local: ['authority', 'liking'],
  guest_moment: ['social_proof', 'liking'],
  behind_scenes: ['liking', 'reciprocity'],
  seasonal: ['scarcity', 'liking'],
  availability: ['scarcity', 'authority'],
  local_outreach: ['scarcity', 'reciprocity', 'social_proof']
};

function _pickApplicablePrinciples(categoryKey, principlesObj) {
  const wanted = CATEGORY_PRINCIPLES[categoryKey] || [];
  return wanted
    .map(name => principlesObj[name] ? { name, ...principlesObj[name] } : null)
    .filter(Boolean);
}

function _extractJson(text) {
  if (!text) return null;
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[1] || m[0]); } catch { return null; }
}

/* ---- Approval + scheduling ---- */

export async function approvePost(id, when = null) {
  const posts = loadPosts();
  const p = posts.find(x => x.id === id);
  if (!p) throw new Error('post not found');
  p.status = when ? 'scheduled' : 'approved';
  p.approved_by = 'operator';
  p.approved_at = new Date().toISOString();
  if (when) p.scheduled_for = new Date(when).toISOString();
  savePosts(posts);
  await logEvent({ type: 'social_approve', payload: { id, when } });
  return p;
}

export async function schedulePost(id, when) {
  return approvePost(id, when);
}

export async function markPublished(id) {
  const posts = loadPosts();
  const p = posts.find(x => x.id === id);
  if (!p) throw new Error('post not found');
  p.status = 'published';
  p.published_at = new Date().toISOString();
  savePosts(posts);
  await logEvent({ type: 'social_publish', payload: { id, channel: p.channel } });
  return p;
}

/* ---- Month planner · one-click generate the whole month ---- */

export async function planMonth({ kernel, provider, model, key, monthStart = new Date(), onProgress = () => {} }) {
  const enabled = loadEnabledChannels();
  const generated = [];
  const totalSlots = CATEGORIES.reduce((s, c) => s + c.per_month, 0);
  let done = 0;

  for (const cat of CATEGORIES) {
    for (let slot = 0; slot < cat.per_month; slot++) {
      for (const chKey of enabled) {
        onProgress({ done, total: totalSlots * enabled.length, category: cat.key, channel: chKey });
        try {
          const post = await composeDraft({ category: cat.key, channel: chKey, slot, kernel, provider, model, key });
          // Auto-space across the month
          const dayIndex = _pickDay(cat.day_pref, slot, monthStart);
          post.scheduled_for = _dateAtHour(monthStart, dayIndex, 10 + (slot % 3) * 3).toISOString();
          post.status = 'scheduled';
          upsertPost(post);
          generated.push(post);
        } catch (e) {
          console.warn('[social] compose failed', cat.key, chKey, slot, e.message);
        }
        done++;
      }
    }
  }

  await logEvent({ type: 'social_plan_month', payload: { count: generated.length } });
  return generated;
}

function _pickDay(dayPref, slot, monthStart) {
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const targets = dayPref.map(d => dayMap[d]);
  const target = targets[slot % targets.length];
  const start = new Date(monthStart);
  start.setDate(1);
  const shift = (target - start.getDay() + 7) % 7;
  const weeksToSkip = Math.floor(slot / targets.length);
  return 1 + shift + weeksToSkip * 7;
}

function _dateAtHour(monthStart, day, hour) {
  const d = new Date(monthStart);
  d.setDate(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/* ---- Summary + queue helpers ---- */

export function summary() {
  const posts = loadPosts();
  const draft = posts.filter(p => p.status === 'draft').length;
  const approved = posts.filter(p => p.status === 'approved').length;
  const scheduled = posts.filter(p => p.status === 'scheduled').length;
  const published = posts.filter(p => p.status === 'published').length;
  const thisMonth = posts.filter(p => {
    const t = new Date(p.scheduled_for || p.published_at || p.created_at);
    const now = new Date();
    return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
  }).length;
  return { total: posts.length, draft, approved, scheduled, published, this_month: thisMonth };
}

export function queueForApproval() {
  return loadPosts().filter(p => p.status === 'draft').slice(0, 20);
}

export function upcoming(limit = 20) {
  const now = Date.now();
  return loadPosts()
    .filter(p => p.status === 'scheduled' && new Date(p.scheduled_for).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
    .slice(0, limit);
}

export function calendarGrid(monthStart = new Date()) {
  const start = new Date(monthStart);
  start.setDate(1);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const posts = loadPosts();
  const byDay = {};
  for (const p of posts) {
    if (!p.scheduled_for && !p.published_at) continue;
    const when = new Date(p.published_at || p.scheduled_for);
    if (when.getFullYear() !== start.getFullYear() || when.getMonth() !== start.getMonth()) continue;
    const day = when.getDate();
    byDay[day] = byDay[day] || [];
    byDay[day].push(p);
  }
  return { daysInMonth, firstDow: start.getDay(), byDay, monthLabel: start.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) };
}
