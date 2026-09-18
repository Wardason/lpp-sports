// Zentrale Konfiguration aus Env-Variablen. Secrets stehen nur hier auf dem
// Server, nie im Browser und nie im Repo (siehe .gitignore).
import { randomBytes } from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

function captchaSecret() {
  const v = process.env.CAPTCHA_HMAC_KEY;
  if (v) return v;
  if (isProd) {
    throw new Error(
      'CAPTCHA_HMAC_KEY fehlt. Mit "openssl rand -hex 32" erzeugen und in Coolify setzen.',
    );
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
  port: Number(process.env.PORT || 3000),
  isProd,
};
