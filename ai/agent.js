/* Wishwood · agentic runtime.
 * perceive → reason → act → log → observe · loops on a heartbeat.
 * Uses BYOK adapter for the LLM · TOOLS registry for the verbs · events.js for the trail.
 */

import { chat } from './adapter.js';
import { TOOLS, toolSchemas, findTool } from './tools.js';
import { logEvent } from './events.js';

const SETTINGS_KEY = 'wishwood.autopilot.settings';
const AUTONOMY_KEY = 'wishwood.autopilot.autonomy';
const KERNEL_KEY = 'wishwood.autopilot.kernel';

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

export function loadAutonomy() {
  try { return JSON.parse(localStorage.getItem(AUTONOMY_KEY) || '{"mode":"watch"}'); }
  catch { return { mode: 'watch' }; }
}
export function saveAutonomy(a) { localStorage.setItem(AUTONOMY_KEY, JSON.stringify(a)); }

export function loadKernel() {
  try { return JSON.parse(localStorage.getItem(KERNEL_KEY) || 'null'); } catch { return null; }
}
export function saveKernel(k) { localStorage.setItem(KERNEL_KEY, JSON.stringify(k)); }

const SYSTEM_TEMPLATE = (kernel) => `You are the Wishwood autopilot — the AI operator for a holiday-rental property.

You have a GROUNDING KERNEL below. You MUST only assert facts consistent with the kernel. If the kernel does not contain a fact, you say you don't know rather than invent.

You have TOOLS to act in the world. Prefer reading (get_availability) before acting. When confidence < 0.85 or value > guardrail, use flag_for_human instead of executing.

Speak in the voice defined in kernel.voice. Never use kernel.voice.banned_phrases.

KERNEL:
${JSON.stringify(kernel, null, 2)}

Current autonomy mode is set by the owner. If a tool guardrail says the current autonomy is not permitted, do NOT invoke it — flag_for_human instead.`;

export async function turn({ userMessage, state = {} }) {
  const settings = loadSettings();
  const autonomy = loadAutonomy();
  const kernel = loadKernel();
  if (!kernel) throw new Error('kernel not loaded · run harvest first');
  if (!settings.provider || !settings.key) throw new Error('provider/key not configured');

  const system = SYSTEM_TEMPLATE(kernel);
  const messages = [{ role: 'user', content: userMessage }];

  await logEvent({ type: 'perceive', payload: { userMessage } });

  const r = await chat({
    provider: settings.provider,
    model: settings.model,
    key: settings.key,
    system, messages,
    tools: toolSchemas(),
    fallback: settings.fallback
  });

  await logEvent({ type: 'reason', payload: { text: r.text?.slice(0, 500), tool_calls: r.tool_calls } });

  const results = [];
  for (const call of r.tool_calls || []) {
    const tool = findTool(call.name);
    if (!tool) { results.push({ call, error: 'unknown tool' }); continue; }

    const allowed = _autonomyAllows(tool, autonomy, call.arguments);
    if (!allowed.ok) {
      await logEvent({ type: 'autonomy_block', payload: { tool: call.name, reason: allowed.reason } });
      const flag = findTool('flag_for_human');
      await flag.execute({ reason: `autonomy blocked ${call.name}: ${allowed.reason}`, urgency: 'med', context: call.arguments });
      results.push({ call, blocked: allowed.reason });
      continue;
    }

    try {
      const out = await tool.execute(call.arguments, { kernel, state });
      results.push({ call, out });
      await logEvent({ type: 'act', payload: { tool: call.name, args: call.arguments, out } });
    } catch (e) {
      results.push({ call, error: e.message });
      await logEvent({ type: 'act_fail', payload: { tool: call.name, error: e.message } });
    }
  }

  return { text: r.text, tool_calls: r.tool_calls, results };
}

function _autonomyAllows(tool, autonomy, args) {
  const g = tool.guardrails || {};
  if (g.always_auto) return { ok: true };
  const mode = autonomy.mode || 'watch';
  if (mode === 'watch') return { ok: false, reason: 'watch mode · all actions blocked' };
  if (mode === 'suggest') return { ok: false, reason: 'suggest mode · queued for approval' };
  if (mode === 'auto-low' && g.auto_low) return { ok: true };
  if (mode === 'auto-med' && (g.auto_low || g.auto_med)) return { ok: true };
  if (mode === 'full') return { ok: true };
  return { ok: false, reason: `mode ${mode} does not permit ${tool.name}` };
}

/* Heartbeat · call every N minutes when autopilot is on. Perceives inbox (stub) + acts on new items. */
export async function heartbeat({ inbox = [] }) {
  const autonomy = loadAutonomy();
  if (autonomy.mode === 'off') return { skipped: true };
  const results = [];
  for (const msg of inbox) {
    try {
      results.push(await turn({ userMessage: `New ${msg.channel} message from ${msg.from}: "${msg.text}"` }));
    } catch (e) {
      results.push({ error: e.message });
    }
  }
  return { results };
}
