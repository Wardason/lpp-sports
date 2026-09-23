// Mailversand: Payload an Resend, ohne echten Netzwerkaufruf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Guide 3 liegt nicht im (oeffentlichen) Repo, deshalb eine Attrappe bereitstellen.
const dir = mkdtemp();
function mkdtemp() {
  const d = mkdtempSync(join(tmpdir(), 'lpp-pdf-'));
  writeFileSync(join(d, 'guide-3-wie-ich-trainieren-sollte.pdf'), '%PDF-1.4 attrappe');
  return d;
}
process.env.PDF_DIR = dir;
process.env.RESEND_API_KEY = 'test-key';
process.env.MAIL_FROM = 'LPP Sports <hallo@example.com>';
process.env.MAIL_BCC = 'archiv@example.com';
process.env.MAIL_TO_COACHING = 'coach@example.com';
const { sendGuides, sendCoaching, validEmail } = await import('../src/mail.js');

test('validEmail lehnt Header-Injection und Mehrfachadressen ab', () => {
  assert.equal(validEmail('a@b.de'), true);
  assert.equal(validEmail('a@b.de\nBcc: x@y.de'), false);
  assert.equal(validEmail('a@b.de, c@d.de'), false);
  assert.equal(validEmail('kein-at.de'), false);
  assert.equal(validEmail('a@b'), false);
});

test('sendGuides schickt drei PDF-Anhaenge an genau eine Adresse', async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return { ok: true, text: async () => '' };
  };
  const r = await sendGuides('kunde@example.com');
  assert.equal(r.simulated, false);
  assert.equal(call.url, 'https://api.resend.com/emails');
  assert.equal(call.init.headers.authorization, 'Bearer test-key');
  const body = JSON.parse(call.init.body);
  assert.deepEqual(body.to, ['kunde@example.com']);
  assert.deepEqual(body.bcc, ['archiv@example.com']);
  assert.equal(body.attachments.length, 3);
  for (const att of body.attachments) {
    assert.ok(att.filename.endsWith('.pdf'));
    assert.equal(Buffer.from(att.content, 'base64').subarray(0, 4).toString(), '%PDF');
  }
});

test('sendGuides meldet Resend-Fehler als UPSTREAM', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 422, text: async () => 'bad' });
  await assert.rejects(() => sendGuides('kunde@example.com'), (e) => e.code === 'UPSTREAM');
});

test('sendCoaching schickt Anfrage an uns und Bestaetigung an den Kunden, HTML escaped', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, text: async () => '' };
  };
  const r = await sendCoaching({ name: '<b>Max</b>', email: 'kunde@example.com', why: 'Ich sehe keine Ergebnisse', phone: '' });
  assert.equal(r.simulated, false);
  assert.equal(calls.length, 2);
  const [anfrage, bestaetigung] = calls;
  assert.deepEqual(anfrage.to, ['coach@example.com']);
  assert.equal(anfrage.reply_to, 'kunde@example.com');
  assert.ok(anfrage.html.includes('&lt;b&gt;Max&lt;/b&gt;'));
  assert.ok(!anfrage.html.includes('<b>Max</b>'));
  assert.equal(anfrage.from, 'LPP Sports <hallo@example.com>');
  assert.deepEqual(bestaetigung.to, ['kunde@example.com']);
});

test('sendCoaching: fehlgeschlagene Bestaetigung kippt die Anfrage nicht', async () => {
  let n = 0;
  globalThis.fetch = async () => (++n === 1 ? { ok: true, text: async () => '' } : { ok: false, status: 500, text: async () => 'x' });
  const r = await sendCoaching({ name: 'Max', email: 'kunde@example.com', why: '', phone: '' });
  assert.equal(r.simulated, false);
});

test('sendCoaching meldet Fehler der Anfrage-Mail als UPSTREAM', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 422, text: async () => 'bad' });
  await assert.rejects(() => sendCoaching({ name: 'Max', email: 'kunde@example.com' }), (e) => e.code === 'UPSTREAM');
});
