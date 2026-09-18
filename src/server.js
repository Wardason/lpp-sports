// LPP Sports: ein Service, same-origin. Liefert die statische Seite aus und
// stellt die KI-API bereit. Sicherheit von Anfang an: serverseitiger Prompt,
// Rate-Limit, Origin-Check, Captcha, Security-Header.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { config } from './config.js';
import { createChallenge, verifyCaptcha } from './captcha.js';
import { rateLimit } from './ratelimit.js';
import { buildPlan } from './prompt.js';
import { streamPlan, providerReady } from './llm.js';

const app = new Hono();

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

app.use('*', async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set('Content-Security-Policy', CSP);
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Optionaler seitenweiter Schutz fuer den privaten Prototyp. Aktiv, sobald
// BASIC_AUTH_USER und BASIC_AUTH_PASSWORD gesetzt sind (in Coolify, nicht im Repo).
if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD) {
  app.use('*', basicAuth({ username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASSWORD }));
  console.log('[config] Basic Auth aktiv fuer Benutzer', process.env.BASIC_AUTH_USER);
}

function clientIp(c) {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return c.req.header('x-real-ip') || 'unknown';
}

function originAllowed(c) {
  if (!config.allowedOrigin) return true; // nur lokale Entwicklung
  const o = c.req.header('origin') || c.req.header('referer') || '';
  return o.startsWith(config.allowedOrigin);
}

app.get('/api/captcha', (c) => {
  const rl = rateLimit(`cap:${clientIp(c)}`, 30, 60000);
  if (!rl.allowed) return c.json({ error: 'Zu viele Anfragen' }, 429);
  return c.json(createChallenge());
});

app.post('/api/plan', async (c) => {
  if (!originAllowed(c)) return c.json({ error: 'Ungültige Herkunft' }, 403);

  const rl = rateLimit(`plan:${clientIp(c)}`, 10, 10 * 60000);
  if (!rl.allowed) {
    return c.json({ error: 'Zu viele Anfragen. Bitte in ein paar Minuten erneut.' }, 429, {
      'retry-after': String(rl.retryAfter),
    });
  }

  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Ungültige Anfrage' }, 400);
  }

  if (!verifyCaptcha(payload?.captcha)) {
    return c.json({ error: 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden.' }, 403);
  }

  const built = buildPlan(payload?.data);
  if (!built.ok) return c.json({ error: built.error }, 400);

  if (!providerReady()) return c.json({ error: 'KI-Anbindung nicht konfiguriert' }, 503);

  try {
    const stream = await streamPlan(built.prompt);
    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      },
    });
  } catch (e) {
    if (e.code === 'NO_KEY' || e.code === 'NO_PROVIDER') {
      return c.json({ error: 'KI-Anbindung nicht konfiguriert' }, 503);
    }
    return c.json({ error: 'Die KI-Anfrage ist fehlgeschlagen' }, 502);
  }
});

// Statische Seite. versand-pdfs liegt ausserhalb von /public und wird nie serviert.
app.get('/', serveStatic({ path: './public/index.html' }));
app.use('/*', serveStatic({ root: './public' }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`LPP Sports laeuft auf http://localhost:${info.port}`);
  if (!config.allowedOrigin) {
    console.warn('[config] ALLOWED_ORIGIN nicht gesetzt, Origin-Check ist aus (nur lokal ok).');
  }
  if (!providerReady()) {
    console.warn('[config] Kein Provider-Key gesetzt, /api/plan liefert 503 und das Frontend zeigt die Musteransicht.');
  }
});
