// Regressionstest zum Rate-Limit-Bypass ueber X-Forwarded-For.
// Stellt den Angriff nach: rotierender linker Header darf die gebuchte IP nicht
// aendern. Siehe gradient-brain
// security-x-forwarded-for-trusted-proxy-hops-login-sperre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIpFrom } from '../src/clientip.js';

test('nimmt bei einem Proxy die rechteste (echte) IP', () => {
  assert.equal(clientIpFrom('9.9.9.9, 203.0.113.5', 1), '203.0.113.5');
});

test('rotierender Spoof links aendert die gebuchte IP nicht', () => {
  const a = clientIpFrom('1.1.1.1, 203.0.113.5', 1);
  const b = clientIpFrom('2.2.2.2, 203.0.113.5', 1);
  assert.equal(a, b);
  assert.equal(a, '203.0.113.5');
});

test('hops=2 ueberspringt zwei Eintraege von rechts', () => {
  assert.equal(clientIpFrom('spoof, 203.0.113.5, 198.51.100.1', 2), '203.0.113.5');
});

test('hops=0 ignoriert X-Forwarded-For und nutzt den Fallback', () => {
  assert.equal(clientIpFrom('9.9.9.9', 0, '127.0.0.1'), '127.0.0.1');
});

test('leeres Feld nutzt den Fallback', () => {
  assert.equal(clientIpFrom('', 1, '127.0.0.1'), '127.0.0.1');
});
