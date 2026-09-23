// completeChat: Request-Form und Antwort-Auswertung fuer beide Anbieter, ohne Netzwerk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { completeChat } from '../src/llm.js';

const messages = [{ role: 'user', content: 'Ich habe wenig Zeit' }];

test('OpenAI: System-Prompt als erste Nachricht, Text aus choices[0].message', async () => {
  config.anbieter = 'openai';
  config.openaiKey = 'k';
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return { ok: true, body: {}, json: async () => ({ choices: [{ message: { content: ' Passt.\nEMPFEHLUNG: basis ' } }] }) };
  };
  const out = await completeChat({ system: 'SYS', messages });
  assert.equal(out, 'Passt.\nEMPFEHLUNG: basis');
  assert.equal(sent.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(sent.auth, 'Bearer k');
  assert.deepEqual(sent.body.messages[0], { role: 'system', content: 'SYS' });
  assert.equal(sent.body.messages.length, 2);
  assert.equal(sent.body.max_tokens, 500);
  assert.equal(sent.body.stream, undefined);
});

test('Anthropic: system als Feld, Text aus content[]', async () => {
  config.anbieter = 'anthropic';
  config.anthropicKey = 'k';
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body), key: init.headers['x-api-key'] };
    return { ok: true, body: {}, json: async () => ({ content: [{ type: 'text', text: 'Hallo' }] }) };
  };
  assert.equal(await completeChat({ system: 'SYS', messages }), 'Hallo');
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.body.system, 'SYS');
  assert.deepEqual(sent.body.messages, messages);
});

test('leere Antwort und HTTP-Fehler werden als UPSTREAM gemeldet', async () => {
  config.anbieter = 'openai';
  config.openaiKey = 'k';
  globalThis.fetch = async () => ({ ok: true, body: {}, json: async () => ({ choices: [{ message: { content: '' } }] }) });
  await assert.rejects(() => completeChat({ system: 's', messages }), (e) => e.code === 'UPSTREAM');
  globalThis.fetch = async () => ({ ok: false, status: 500, body: {}, text: async () => 'boom' });
  await assert.rejects(() => completeChat({ system: 's', messages }), (e) => e.code === 'UPSTREAM');
});

test('ohne Schluessel: NO_KEY', async () => {
  config.anbieter = 'openai';
  config.openaiKey = '';
  await assert.rejects(() => completeChat({ system: 's', messages }), (e) => e.code === 'NO_KEY');
});
