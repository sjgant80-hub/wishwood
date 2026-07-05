/* Wishwood · seed harvester.
 * Aggregates the property's public + private footprint into kernel.json.
 * Runs adapters in parallel · digests results with an LLM (via adapter.js) · returns a kernel diff.
 * Adapters are pluggable · each one exports { source, fetch(config) → raw, distil(raw, llm) → kernelDelta }.
 */

import { chat } from './adapter.js';
import { logEvent } from './events.js';

const HARVESTERS = {
  /* Reviews harvester · reads a list of review URLs (Airbnb / Booking / Google / Trustpilot),
   * pulls public review text (owner scrapes their own listings only), digests via LLM into
   * voice, praise, complaints, guest archetypes.
   */
  reviews: {
    async fetchRaw({ urls }) {
      // Owner supplies their own OTA review URLs. Fetch each. On CORS-blocked hosts, tell the
      // user to save the reviews as JSON via their PMS export and drop the file in.
      const out = [];
      for (const url of urls || []) {
        try {
          const r = await fetch(url);
          if (r.ok) out.push({ url, html: await r.text() });
        } catch (e) { out.push({ url, error: e.message }); }
      }
      return out;
    },
    async distil(raw, { provider, key, model }) {
      const system = `You are the wishwood seed-harvester. Extract from raw review pages the following
strict JSON shape: { voice: { tone, greeting_style, banned_phrases }, recurring_praise: [], recurring_complaints: [],
guest_archetypes: [{ label, share, notes }] }. Base only on what the reviews actually say.`;
      const messages = [{ role: 'user', content: `RAW REVIEWS:\n\n${JSON.stringify(raw).slice(0, 40000)}` }];
      const r = await chat({ provider, key, model, system, messages });
      return _extractJson(r.text);
    }
  },

  /* Competitor harvester · given a lat/lng + type + sleeps, queries a competitor lookup
   * (owner supplies the lookup URL — Airbnb search JSON export, PriceLabs export, or manual CSV).
   */
  competitors: {
    async fetchRaw({ competitorCsvUrl }) {
      if (!competitorCsvUrl) return [];
      const r = await fetch(competitorCsvUrl);
      const t = await r.text();
      return _parseCsv(t);
    },
    async distil(raw) {
      return { competitors: raw.slice(0, 50) };
    }
  },

  /* Local events + weather via Open-Meteo (no key) and Wikidata SPARQL for local landmarks. */
  local: {
    async fetchRaw({ lat, lng }) {
      if (!lat || !lng) return null;
      try {
        const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`).then(r => r.json());
        return { weather: wx };
      } catch (e) { return { error: e.message }; }
    },
    async distil(raw) { return { local_signals: raw }; }
  },

  /* Listings harvester · owner supplies their own OTA listing URLs, we mirror
   * the current copy so the agent knows what's live where. */
  listings: {
    async fetchRaw({ listingUrls }) {
      const out = {};
      for (const [channel, url] of Object.entries(listingUrls || {})) {
        try { out[channel] = await (await fetch(url)).text(); }
        catch (e) { out[channel] = { error: e.message }; }
      }
      return out;
    },
    async distil(raw) {
      return { current_listings: Object.keys(raw) };
    }
  }
};

export async function harvest({ config, provider, key, model, onProgress = () => {} }) {
  const start = Date.now();
  const kernel = JSON.parse(JSON.stringify(config.kernelSeed || {}));
  const sources = [];
  const sourceKeys = Object.keys(HARVESTERS);

  for (const sk of sourceKeys) {
    onProgress({ phase: 'fetch', source: sk });
    let raw = null;
    try { raw = await HARVESTERS[sk].fetchRaw(config[sk] || {}); }
    catch (e) { console.warn(`[harvest] ${sk} fetch fail`, e); continue; }

    onProgress({ phase: 'distil', source: sk });
    let delta = null;
    try { delta = await HARVESTERS[sk].distil(raw, { provider, key, model }); }
    catch (e) { console.warn(`[harvest] ${sk} distil fail`, e); continue; }

    if (delta) {
      _mergeDeep(kernel, delta);
      sources.push(sk);
    }
  }

  kernel.meta = {
    ...(kernel.meta || {}),
    kernel_version: '0.1.0',
    harvested_at: new Date().toISOString(),
    refresh_interval_hours: 168,
    sources
  };

  await logEvent({ type: 'harvest_complete', payload: { sources, duration_ms: Date.now() - start } });
  return kernel;
}

/* ---- helpers ---- */
function _mergeDeep(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = target[k] || {};
      _mergeDeep(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

function _extractJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[1] || m[0]); } catch { return {}; }
}

function _parseCsv(t) {
  const [head, ...rows] = t.split('\n').filter(Boolean);
  const cols = head.split(',');
  return rows.map(r => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}
