// Proxy zum KI-Anbieter. Der Schluessel bleibt hier auf dem Server. Die Antwort
// wird als reiner Text zum Browser gestreamt (SSE des Anbieters wird geparst).
import { config } from './config.js';

const providers = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-5.6-terra',
    key: () => config.openaiKey,
    headers: (key) => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` }),
    body: (prompt, model) => ({
      model,
      stream: true,
      max_tokens: 3500,
      messages: [{ role: 'user', content: prompt }],
    }),
    extract: (json) => json?.choices?.[0]?.delta?.content || '',
    chatBody: (system, messages, model, maxTokens) => ({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    chatExtract: (json) => json?.choices?.[0]?.message?.content || '',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-5',
    key: () => config.anthropicKey,
    headers: (key) => ({
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
    body: (prompt, model) => ({
      model,
      stream: true,
      max_tokens: 3500,
      messages: [{ role: 'user', content: prompt }],
    }),
    extract: (json) => (json?.type === 'content_block_delta' ? json?.delta?.text || '' : ''),
    chatBody: (system, messages, model, maxTokens) => ({ model, max_tokens: maxTokens, system, messages }),
    chatExtract: (json) => (json?.content || []).map((b) => b?.text || '').join(''),
  },
};

export function providerReady() {
  const p = providers[config.anbieter];
  return Boolean(p && p.key());
}

function pick() {
  const p = providers[config.anbieter];
  if (!p) {
    const e = new Error('Unbekannter KI-Anbieter');
    e.code = 'NO_PROVIDER';
    throw e;
  }
  const key = p.key();
  if (!key) {
    const e = new Error('KI nicht konfiguriert');
    e.code = 'NO_KEY';
    throw e;
  }
  return { p, key, model: config.modell || p.defaultModel };
}

async function callUpstream(p, key, body) {
  let upstream;
  try {
    upstream = await fetch(p.url, { method: 'POST', headers: p.headers(key), body: JSON.stringify(body) });
  } catch {
    const e = new Error('KI-Anbieter nicht erreichbar');
    e.code = 'UPSTREAM';
    throw e;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('KI-Fehler', upstream.status, detail.slice(0, 300));
    const e = new Error('KI-Anfrage fehlgeschlagen');
    e.code = 'UPSTREAM';
    throw e;
  }
  return upstream;
}

// Kurze Chat-Antwort ohne Streaming (Plan-Berater).
export async function completeChat({ system, messages, maxTokens = 500 }) {
  const { p, key, model } = pick();
  const upstream = await callUpstream(p, key, p.chatBody(system, messages, model, maxTokens));
  const text = p.chatExtract(await upstream.json().catch(() => null));
  if (!text.trim()) {
    const e = new Error('Leere KI-Antwort');
    e.code = 'UPSTREAM';
    throw e;
  }
  return text.trim();
}

export async function streamPlan(prompt) {
  const { p, key, model } = pick();
  const upstream = await callUpstream(p, key, p.body(prompt, model));

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let rest = '';

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          rest += decoder.decode(value, { stream: true });
          const lines = rest.split('\n');
          rest = lines.pop() || '';
          for (const line of lines) {
            const z = line.trim();
            if (!z.startsWith('data:')) continue;
            const data = z.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const piece = p.extract(JSON.parse(data));
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {
              /* unvollstaendige Zeile ueberspringen */
            }
          }
        }
      } catch (e) {
        console.error('Stream-Fehler', e);
      } finally {
        controller.close();
      }
    },
  });
}
