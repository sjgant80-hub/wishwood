/* Wishwood · BYOK LLM adapter · one interface for many providers.
 * chat({ messages, tools, opts }) → { text, tool_calls, usage }
 * Providers: anthropic · openai · gemini · groq · mistral · webllm (local, free).
 * Fallback rail: primary → secondary → webllm.
 * Nothing here talks to our servers · owner's key hits owner's chosen provider directly.
 */

const PROVIDERS = {
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    }),
    body: ({ messages, tools, model, system, max_tokens }) => ({
      model: model || 'claude-opus-4-8',
      max_tokens: max_tokens || 4096,
      system: system || undefined,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools ? tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
      })) : undefined
    }),
    parse: (r) => {
      const text = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const tool_calls = (r.content || []).filter(b => b.type === 'tool_use').map(b => ({
        id: b.id, name: b.name, arguments: b.input
      }));
      return { text, tool_calls, usage: r.usage };
    }
  },

  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' }),
    body: ({ messages, tools, model, system, max_tokens }) => ({
      model: model || 'gpt-4.1',
      max_tokens: max_tokens || 4096,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      tools: tools ? tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      })) : undefined
    }),
    parse: (r) => {
      const msg = r.choices?.[0]?.message || {};
      const tool_calls = (msg.tool_calls || []).map(tc => ({
        id: tc.id, name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
      }));
      return { text: msg.content || '', tool_calls, usage: r.usage };
    }
  },

  gemini: {
    endpoint: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${key}`,
    headers: () => ({ 'content-type': 'application/json' }),
    body: ({ messages, tools, system }) => ({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      })),
      tools: tools ? [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }] : undefined
    }),
    parse: (r) => {
      const parts = r.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('');
      const tool_calls = parts.filter(p => p.functionCall).map(p => ({
        id: crypto.randomUUID(), name: p.functionCall.name, arguments: p.functionCall.args
      }));
      return { text, tool_calls, usage: r.usageMetadata };
    }
  },

  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' }),
    body: ({ messages, tools, model, system }) => ({
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      tools: tools ? tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined
    }),
    parse: (r) => {
      const msg = r.choices?.[0]?.message || {};
      const tool_calls = (msg.tool_calls || []).map(tc => ({
        id: tc.id, name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
      }));
      return { text: msg.content || '', tool_calls };
    }
  },

  mistral: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' }),
    body: ({ messages, tools, model, system }) => ({
      model: model || 'mistral-large-latest',
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      tools: tools ? tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined
    }),
    parse: (r) => {
      const msg = r.choices?.[0]?.message || {};
      const tool_calls = (msg.tool_calls || []).map(tc => ({
        id: tc.id, name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
      }));
      return { text: msg.content || '', tool_calls };
    }
  },

  webllm: {
    /* Local browser LLM (botler pattern · MLC WebLLM · Llama 3.1 8B).
     * Free tier · runs on user's GPU · no key needed · no data leaves device.
     * Loaded lazily via importScripts in a worker so first call triggers a ~4GB download.
     */
    endpoint: null,
    _engine: null,
    async _lazyInit(model) {
      if (this._engine) return this._engine;
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
      this._engine = await CreateMLCEngine(model || 'Llama-3.1-8B-Instruct-q4f16_1-MLC');
      return this._engine;
    },
    async chatDirect({ messages, system, model }) {
      const eng = await this._lazyInit(model);
      const r = await eng.chat.completions.create({
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ]
      });
      const msg = r.choices?.[0]?.message || {};
      return { text: msg.content || '', tool_calls: [] };
    }
  }
};

export async function chat({ provider, model, key, messages, tools, system, max_tokens, fallback }) {
  const order = fallback ? [{ provider, model, key }, ...fallback] : [{ provider, model, key }];
  let lastErr;
  for (const cfg of order) {
    try {
      return await _chatOne(cfg.provider, cfg.model, cfg.key, { messages, tools, system, max_tokens });
    } catch (e) {
      lastErr = e;
      console.warn(`[adapter] ${cfg.provider} failed:`, e.message);
    }
  }
  throw lastErr || new Error('all providers failed');
}

async function _chatOne(provider, model, key, { messages, tools, system, max_tokens }) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`unknown provider: ${provider}`);
  if (provider === 'webllm') return p.chatDirect({ messages, system, model });

  const endpoint = typeof p.endpoint === 'function' ? p.endpoint(model, key) : p.endpoint;
  const headers = p.headers(key);
  const body = p.body({ messages, tools, model, system, max_tokens });
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`${provider} ${res.status}: ${errTxt.slice(0, 200)}`);
  }
  return p.parse(await res.json());
}

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);
export const DEFAULT_MODELS = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4.1',
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
  webllm: 'Llama-3.1-8B-Instruct-q4f16_1-MLC'
};
