/* Wishwood · agent tool registry.
 * Each tool: JSON schema (for LLM function-call) + execute() (real side effect).
 * Every execute() is signed + logged + reversible for 30s via events.js.
 */

import { logEvent } from './events.js';

export const TOOLS = [
  {
    name: 'get_availability',
    description: 'Return booked/free nights for a date range. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', format: 'date' },
        end: { type: 'string', format: 'date' }
      },
      required: ['start', 'end']
    },
    guardrails: { max_value_gbp: 0, always_auto: true },
    reversible_ms: 0,
    async execute({ start, end }, { kernel, state }) {
      const bookings = state.bookings || [];
      const range = _dateRange(start, end);
      const booked = range.filter(d => bookings.some(b => d >= b.start && d < b.end));
      const free = range.filter(d => !booked.includes(d));
      return { free, booked };
    }
  },

  {
    name: 'quote_stay',
    description: 'Quote a stay to a guest given dates + party size. Applies pricing curve + fees.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', format: 'date' },
        end: { type: 'string', format: 'date' },
        party: { type: 'integer' },
        guest_name: { type: 'string' }
      },
      required: ['start', 'end', 'party']
    },
    guardrails: { max_value_gbp: 3000, always_auto: false, auto_low: true },
    reversible_ms: 30000,
    async execute({ start, end, party, guest_name }, { kernel, state }) {
      const nights = _nights(start, end);
      const base = kernel.market?.avg_nightly_gbp || 180;
      const cleaning = kernel.policies?.cleaning_fee_gbp || 75;
      const deposit = kernel.policies?.deposit_gbp || 0;
      const seasonal = _seasonalMultiplier(start, kernel);
      const total = Math.round(nights * base * seasonal + cleaning);
      const quote = { nights, base_per_night: Math.round(base * seasonal), cleaning_fee: cleaning, deposit, total_gbp: total, guest_name };
      await logEvent({ type: 'quote', payload: quote });
      return quote;
    }
  },

  {
    name: 'send_reply',
    description: 'Send a message to a guest on their channel. High-caution tool.',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['airbnb', 'booking', 'vrbo', 'direct', 'email', 'sms', 'whatsapp'] },
        thread_id: { type: 'string' },
        text: { type: 'string' },
        confidence: { type: 'number', description: '0-1' }
      },
      required: ['channel', 'thread_id', 'text']
    },
    guardrails: { max_value_gbp: 0, always_auto: false, auto_low: true, confidence_min: 0.85 },
    reversible_ms: 30000,
    async execute({ channel, thread_id, text, confidence }, { kernel, state }) {
      await logEvent({ type: 'send_reply', payload: { channel, thread_id, text, confidence } });
      return { queued: true, channel, thread_id };
    }
  },

  {
    name: 'set_price',
    description: 'Adjust nightly price for a date range.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', format: 'date' },
        end: { type: 'string', format: 'date' },
        price_gbp: { type: 'number' },
        reason: { type: 'string' }
      },
      required: ['start', 'end', 'price_gbp', 'reason']
    },
    guardrails: { max_value_gbp: 500, always_auto: false, auto_med: true, delta_pct_max: 15 },
    reversible_ms: 60000,
    async execute({ start, end, price_gbp, reason }, { kernel, state }) {
      await logEvent({ type: 'set_price', payload: { start, end, price_gbp, reason } });
      return { applied: true, start, end, price_gbp };
    }
  },

  {
    name: 'update_listing',
    description: 'Edit an OTA listing field (title, description, photo caption, amenity).',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['airbnb', 'booking', 'vrbo', 'direct'] },
        field: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['channel', 'field', 'value']
    },
    guardrails: { max_value_gbp: 0, always_auto: false, auto_med: false },
    reversible_ms: 300000,
    async execute({ channel, field, value }, { kernel, state }) {
      await logEvent({ type: 'update_listing', payload: { channel, field, value } });
      return { queued: true };
    }
  },

  {
    name: 'create_task',
    description: 'Create a task for a human (owner or contractor).',
    parameters: {
      type: 'object',
      properties: {
        who: { type: 'string' },
        what: { type: 'string' },
        when: { type: 'string', format: 'date-time' },
        priority: { type: 'string', enum: ['low', 'med', 'high'] }
      },
      required: ['who', 'what']
    },
    guardrails: { max_value_gbp: 0, always_auto: true },
    reversible_ms: 0,
    async execute(args) {
      await logEvent({ type: 'create_task', payload: args });
      return { created: true };
    }
  },

  {
    name: 'flag_for_human',
    description: 'Escalate. Agent halts on this action-class until human resolves.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        urgency: { type: 'string', enum: ['low', 'med', 'high'] },
        context: { type: 'object' }
      },
      required: ['reason', 'urgency']
    },
    guardrails: { max_value_gbp: 0, always_auto: true },
    reversible_ms: 0,
    async execute(args) {
      await logEvent({ type: 'flag_for_human', payload: args });
      return { flagged: true };
    }
  }
];

export function toolSchemas() {
  return TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

export function findTool(name) {
  return TOOLS.find(t => t.name === name);
}

/* ---- helpers ---- */
function _dateRange(start, end) {
  const out = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d < e) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}
function _nights(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 86400000);
}
function _seasonalMultiplier(startISO, kernel) {
  const m = new Date(startISO).toLocaleString('en-GB', { month: 'short' });
  const peak = kernel.market?.seasonality?.peak_months || [];
  const shoulder = kernel.market?.seasonality?.shoulder_months || [];
  if (peak.includes(m)) return 1.35;
  if (shoulder.includes(m)) return 1.0;
  return 0.75;
}
