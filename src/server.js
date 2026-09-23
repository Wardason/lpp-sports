// LPP Sports: ein Service, same-origin. Liefert die statische Seite aus und
// stellt die API bereit (Konfigurator, Plan-Berater, Guides-Versand).
// Sicherheit von Anfang an: serverseitiger Prompt, Rate-Limit, Origin-Check,
// Captcha, Security-Header.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { bodyLimit } from 'hono/body-limit';
import { etag } from 'hono/etag';
import { config } from './config.js';
import { clientIpFrom } from './clientip.js';
import { createChallenge, verifyCaptcha } from './captcha.js';
import { rateLimit } from './ratelimit.js';
import { buildPlan } from './prompt.js';
import { streamPlan, completeChat, providerReady } from './llm.js';
import { buildChat, parseReply } from './berater.js';
import { sendGuides, validEmail } from './mail.js';

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
  // Die oeffentlichen Guide-PDFs werden im Browser-Viewer geoeffnet. CSP mit
  // object-src 'none' und X-Frame-Options blockieren diesen Viewer teils.
  if (!c.req.path.startsWith('/guides/')) {
    h.set('Content-Security-Policy', CSP);
    h.set('X-Frame-Options', 'DENY');
  }
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

// Anzahl vertrauenswuerdiger Proxy-Hops. Coolify/Traefik = 1. Muss zur realen
// Zahl passen: zu hoch macht die IP faelschbar, zu niedrig teilen sich alle
// hinter demselben Proxy eine IP.
const TRUSTED_PROXY_HOPS = Number.isFinite(Number(process.env.TRUSTED_PROXY_HOPS))
  ? Number(process.env.TRUSTED_PROXY_HOPS)
  : 1;

function clientIp(c) {
  const fallback = c.req.header('x-real-ip') || 'unknown';
  return clientIpFrom(c.req.header('x-forwarded-for'), TRUSTED_PROXY_HOPS, fallback);
}

function originAllowed(c) {
  if (!config.allowedOrigin) return true; // nur lokale Entwicklung
  const o = c.req.header('origin') || c.req.header('referer') || '';
  return o.startsWith(config.allowedOrigin);
}

app.get('/api/captcha', (c) => {
  if (!config.captchaSecret) return c.json({ error: 'Nicht konfiguriert' }, 503);
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

  if (!config.captchaSecret) return c.json({ error: 'Nicht konfiguriert' }, 503);

  if (!verifyCaptcha(payload?.captcha)) {
    return c.json({ error: 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden.' }, 403);
  }

  const built = buildPlan(payload?.data);
  if (!built.ok) return c.json({ error: built.error }, 400);

  if (!providerReady()) return c.json({ error: 'Nicht konfiguriert' }, 503);

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
      return c.json({ error: 'Nicht konfiguriert' }, 503);
    }
    return c.json({ error: 'Die Anfrage ist fehlgeschlagen' }, 502);
  }
});


// Plan-Berater: KI-Chat, der die passende Stufe herausfindet.
app.post('/api/berater', bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Anfrage zu groß' }, 413) }), async (c) => {
  if (!originAllowed(c)) return c.json({ error: 'Ungültige Herkunft' }, 403);

  const rl = rateLimit(`berater:${clientIp(c)}`, 30, 10 * 60000);
  if (!rl.allowed) {
    return c.json({ error: 'Zu viele Nachrichten. Bitte in ein paar Minuten erneut.' }, 429, {
      'retry-after': String(rl.retryAfter),
    });
  }

  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Ungültige Anfrage' }, 400);
  }

  if (!config.captchaSecret) return c.json({ error: 'Nicht konfiguriert' }, 503);
  if (!verifyCaptcha(payload?.captcha)) {
    return c.json({ error: 'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden.' }, 403);
  }

  const built = buildChat(payload);
  if (!built.ok) return c.json({ error: built.error }, 400);
  if (!providerReady()) return c.json({ error: 'Nicht konfiguriert' }, 503);

  try {
    const raw = await completeChat({ system: built.system, messages: built.messages });
    return c.json(parseReply(raw));
  } catch (e) {
    if (e.code === 'NO_KEY' || e.code === 'NO_PROVIDER') return c.json({ error: 'Nicht konfiguriert' }, 503);
    return c.json({ error: 'Die Anfrage ist fehlgeschlagen' }, 502);
  }
});

// Guides-Anmeldung: schickt alle drei Guides per Resend. Leichtes Anti-Spam
// statt Captcha (Honeypot, Time-Trap, Rate-Limit), siehe docs/mailversand-resend.md.
const MIN_FILL_MS = 5000;

app.post('/api/lead', bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: 'Anfrage zu groß' }, 413) }), async (c) => {
  if (!originAllowed(c)) return c.json({ error: 'Ungültige Herkunft' }, 403);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Ungültige Anfrage' }, 400);
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!validEmail(email)) return c.json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400);
  if (body?.consent !== true) return c.json({ error: 'Bitte bestätige die Einwilligung.' }, 400);

  // Bots bekommen einen vorgetaeuschten Erfolg, damit sie nichts lernen.
  if (typeof body?._website === 'string' && body._website !== '') return c.json({ ok: true });
  const landedAt = Number(body?.landedAt);
  if (!Number.isFinite(landedAt) || Date.now() - landedAt < MIN_FILL_MS) return c.json({ ok: true });

  const ip = clientIp(c);
  const perMail = rateLimit(`lead:${ip}:${email}`, 3, 60 * 60000);
  const perIp = rateLimit(`leadip:${ip}`, 10, 60 * 60000);
  if (!perMail.allowed || !perIp.allowed) {
    return c.json({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }, 429);
  }

  try {
    const r = await sendGuides(email);
    return c.json({ ok: true, simulated: r.simulated });
  } catch (e) {
    if (e.code === 'NO_MAIL' || e.code === 'NO_PDF') return c.json({ error: 'Der Versand ist noch nicht eingerichtet.' }, 503);
    return c.json({ error: 'Der Versand hat nicht geklappt. Bitte versuche es später erneut.' }, 502);
  }
});

// Alte Adresse des Konfigurators
app.get('/ki-plan.html', (c) => c.redirect('/konfigurator.html', 301));

// Statische Seite. private-pdfs liegt ausserhalb von /public und wird nie serviert.
// Statische Dateien immer per ETag gegen den Server pruefen, damit Besucher nach
// einem Deploy nicht mit altem JS/CSS haengen bleiben. Registriert nach den
// API-Routen, damit gestreamte Antworten nicht gepuffert werden.
app.use('*', etag(), async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'no-cache');
});
app.get('/', serveStatic({ path: './public/index.html' }));
app.use('/*', serveStatic({ root: './public' }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`LPP Sports laeuft auf http://localhost:${info.port}`);
  if (!config.allowedOrigin) {
    console.warn('[config] ALLOWED_ORIGIN nicht gesetzt, Origin-Check ist aus (nur lokal ok).');
  }
  if (!providerReady()) {
    console.warn('[config] Kein Provider-Key gesetzt, /api/plan und /api/berater liefern 503, das Frontend zeigt Musteransicht bzw. feste Fragen.');
  }
  if (!config.resendKey) {
    console.warn(config.isProd ? '[config] RESEND_API_KEY fehlt, /api/lead liefert 503.' : '[config] RESEND_API_KEY fehlt, /api/lead laeuft im Testmodus (keine Mail).');
  }
});
