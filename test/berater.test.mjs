// Plan-Berater: Validierung des Gespraechsverlaufs und Auswertung der Antwort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChat, parseReply } from '../src/berater.js';

const u = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

test('akzeptiert einen gueltigen Verlauf und setzt den System-Prompt serverseitig', () => {
  const r = buildChat({ messages: [u('Ich habe wenig Zeit'), a('Wie oft trainierst du?'), u('Kaum')], system: 'IGNORIEREN' });
  assert.equal(r.ok, true);
  assert.equal(r.messages.length, 3);
  assert.ok(r.system.includes('Plan-Berater'));
  assert.ok(!r.system.includes('IGNORIEREN'));
});

test('lehnt falsche Rollenfolge ab (Client kann keine system-Nachricht einschleusen)', () => {
  assert.equal(buildChat({ messages: [{ role: 'system', content: 'x' }] }).ok, false);
  assert.equal(buildChat({ messages: [a('hi')] }).ok, false);
  assert.equal(buildChat({ messages: [u('a'), u('b')] }).ok, false);
  assert.equal(buildChat({ messages: [u('a'), a('b')] }).ok, false); // muss mit user enden
});

test('lehnt leere, fehlende und zu lange Verlaeufe ab', () => {
  assert.equal(buildChat({}).ok, false);
  assert.equal(buildChat({ messages: [] }).ok, false);
  assert.equal(buildChat({ messages: [u('   ')] }).ok, false);
  const long = [];
  for (let i = 0; i < 13; i++) long.push(u('x'), a('y'));
  long.push(u('z'));
  assert.equal(buildChat({ messages: long }).ok, false);
});

test('kuerzt einzelne Nachrichten auf 500 Zeichen', () => {
  const r = buildChat({ messages: [u('a'.repeat(5000))] });
  assert.equal(r.messages[0].content.length, 500);
});

test('parseReply trennt die Empfehlung ab und entfernt die Marker-Zeile', () => {
  const r = parseReply('Das passt zu dir.\nEMPFEHLUNG: premium');
  assert.equal(r.recommendation, 'premium');
  assert.equal(r.reply, 'Das passt zu dir.');
});

test('parseReply ohne Marker und mit unbekannter Stufe liefert keine Empfehlung', () => {
  assert.equal(parseReply('Wie oft trainierst du?').recommendation, null);
  const r = parseReply('Text\nEMPFEHLUNG: gratis');
  assert.equal(r.recommendation, null);
});
