// Self-hosted Proof-of-Work-Captcha (Altcha-Schema), kein externer Dienst, kein
// Datenabfluss. Der Server signiert eine Challenge per HMAC. Der Browser sucht
// die Zahl, deren Hash die Challenge ergibt. Das ist Reibung gegen Skript-
// Missbrauch, keine Authentifizierung. Die eigentliche Grenze ist das Rate-Limit.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

const MAX_NUMBER = 20000; // Aufwand fuer den Browser, unter einer Sekunde
const TTL_MS = 5 * 60 * 1000;
const used = new Map(); // challenge -> expiresAt (Replay-Schutz)

function sign(challenge, expires) {
  return createHmac('sha256', config.captchaSecret).update(`${challenge}.${expires}`).digest('hex');
}

function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function createChallenge() {
  const salt = randomBytes(12).toString('hex');
  const number = Math.floor(Math.random() * MAX_NUMBER);
  const challenge = sha256Hex(salt + number);
  const expires = Date.now() + TTL_MS;
  return { algorithm: 'SHA-256', salt, challenge, maxnumber: MAX_NUMBER, expires, signature: sign(challenge, expires) };
}

export function verifyCaptcha(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const { salt, number, challenge, expires, signature } = payload;
  if (typeof salt !== 'string' || typeof challenge !== 'string' || typeof signature !== 'string') return false;
  if (!Number.isInteger(number) || number < 0 || number > MAX_NUMBER) return false;
  if (!Number.isInteger(expires) || expires < Date.now()) return false;
  if (!safeEqualHex(signature, sign(challenge, expires))) return false;
  if (!safeEqualHex(sha256Hex(salt + number), challenge)) return false;

  const now = Date.now();
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  if (used.has(challenge)) return false; // schon benutzt
  used.set(challenge, expires);
  return true;
}
