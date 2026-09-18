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
  },
};

export function providerReady() {
  const p = providers[config.anbieter];
  return Boolean(p && p.key());
}

export async function streamPlan(prompt) {
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
  const model = config.modell || p.defaultModel;

  let upstream;
  try {
    upstream = await fetch(p.url, {
      method: 'POST',
      headers: p.headers(key),
      body: JSON.stringify(p.body(prompt, model)),
    });
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
