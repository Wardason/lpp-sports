// Zentrale Konfiguration aus Env-Variablen. Secrets stehen nur hier auf dem
// Server, nie im Browser und nie im Repo (siehe .gitignore).
import { randomBytes } from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

function captchaSecret() {
  const v = process.env.CAPTCHA_HMAC_KEY;
  if (v) return v;
  if (isProd) {
    // Nicht crashen: die statische Seite muss laufen. Ohne Schluessel bleibt nur
    // der KI-Plan aus (503), bis die Variable in Coolify gesetzt ist.
    console.error(
      '[config] CAPTCHA_HMAC_KEY fehlt. Der KI-Plan bleibt aus (503), bis der Schluessel in Coolify gesetzt ist. Erzeugen mit: openssl rand -hex 32',
    );
    return '';
  }
  console.warn('[config] CAPTCHA_HMAC_KEY nicht gesetzt, nutze einen zufaelligen Dev-Schluessel.');
  return randomBytes(32).toString('hex');
}

export const config = {
  anbieter: (process.env.KI_ANBIETER || 'openai').toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  modell: process.env.KI_MODELL || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '',
  captchaSecret: captchaSecret(),
  port: (() => {
    const p = Number(process.env.PORT);
    return Number.isInteger(p) && p > 0 ? p : 3000;
  })(),
  isProd,
};
