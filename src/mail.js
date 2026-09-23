// Mailversand ueber Resend (REST, ohne SDK). Die gesamte Provider-Logik liegt
// in dieser Datei, ein Wechsel des Anbieters betrifft nur sie.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, isAbsolute } from 'node:path';
import { config } from './config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_GUIDES = join(ROOT, 'public', 'guides');
const PRIVATE_DIR = config.pdfDir
  ? (isAbsolute(config.pdfDir) ? config.pdfDir : join(ROOT, config.pdfDir))
  : join(ROOT, 'private-pdfs');

// Guide 1 und 2 sind oeffentlich lesbar (public/guides), Guide 3 liegt privat.
const GUIDES = [
  { filename: 'Guide 1 - Warum ich trainieren sollte.pdf', path: join(PUBLIC_GUIDES, 'guide-1-warum-ich-trainieren-sollte.pdf') },
  { filename: 'Guide 2 - Warum dein Training nichts bringt.pdf', path: join(PUBLIC_GUIDES, 'guide-2-warum-dein-training-nichts-bringt.pdf') },
  { filename: 'Guide 3 - Wie ich trainieren sollte.pdf', path: join(PRIVATE_DIR, 'guide-3-wie-ich-trainieren-sollte.pdf') },
];

let attachmentCache = null;
async function attachments() {
  if (attachmentCache) return attachmentCache;
  const list = [];
  for (const g of GUIDES) {
    try {
      list.push({ filename: g.filename, content: (await readFile(g.path)).toString('base64') });
    } catch (err) {
      console.error('[mail] PDF nicht lesbar:', g.path, err.code || err.message);
      const e = new Error('PDF fehlt');
      e.code = 'NO_PDF';
      throw e;
    }
  }
  attachmentCache = list;
  return list;
}

export function validEmail(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(v);
}

const SUBJECT = 'Deine drei Guides von LPP Sports';

function bodies() {
  const text = `Hallo,

schön, dass du dabei bist. Im Anhang findest du alle drei Guides als PDF:

1. Warum ich trainieren sollte
2. Warum dein Training nichts bringt
3. Wie ich trainieren sollte (mit dem 4-Tage-Trainingsplan)

Lies sie am besten in dieser Reihenfolge. Wenn du danach Fragen hast, antworte einfach auf diese E-Mail.

Sportliche Grüße
LPP Sports

Du erhältst diese E-Mail, weil du dich auf lpp-sports.de für die Guides eingetragen hast. Wenn du keine weiteren Nachrichten von uns möchtest, antworte mit „Abmelden“.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0D1B2E;max-width:560px">
<p>Hallo,</p>
<p>schön, dass du dabei bist. Im Anhang findest du alle drei Guides als PDF:</p>
<ol><li>Warum ich trainieren sollte</li><li>Warum dein Training nichts bringt</li><li>Wie ich trainieren sollte (mit dem 4-Tage-Trainingsplan)</li></ol>
<p>Lies sie am besten in dieser Reihenfolge. Wenn du danach Fragen hast, antworte einfach auf diese E-Mail.</p>
<p>Sportliche Grüße<br><b>LPP Sports</b></p>
<p style="font-size:12px;color:#56637A;border-top:1px solid #DCE2EA;padding-top:12px">Du erhältst diese E-Mail, weil du dich auf lpp-sports.de für die Guides eingetragen hast. Wenn du keine weiteren Nachrichten von uns möchtest, antworte mit „Abmelden“.</p>
</div>`;
  return { text, html };
}

function mailError(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Ein Versand ueber die Resend-REST-API. Wirft NO_MAIL (nicht konfiguriert) oder UPSTREAM.
async function resendSend(payload) {
  if (!config.mailFrom) throw mailError('MAIL_FROM fehlt', 'NO_MAIL');

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, ...payload }),
    });
  } catch {
    throw mailError('Resend nicht erreichbar', 'UPSTREAM');
  }
  if (!res.ok) {
    console.error('[mail] Resend-Fehler', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw mailError('Mailversand fehlgeschlagen', 'UPSTREAM');
  }
}

// Ohne RESEND_API_KEY: im Entwicklungsmodus Testlauf (keine Mail), in Produktion Fehler.
function simulate(what) {
  if (config.isProd) throw mailError('Mailversand nicht konfiguriert', 'NO_MAIL');
  console.warn(`[mail] Testmodus: keine RESEND_API_KEY, es wird nichts gesendet (${what}).`);
  return { simulated: true };
}

// Schickt die drei Guides an eine bereits validierte Adresse.
export async function sendGuides(to) {
  const files = await attachments();
  if (!config.resendKey) return simulate(`waere an ${to}`);

  const { text, html } = bodies();
  const payload = { to: [to], subject: SUBJECT, text, html, attachments: files };
  if (config.mailBcc) payload.bcc = [config.mailBcc];
  await resendSend(payload);
  return { simulated: false };
}

// Fuer HTML-Mail-Bodies: Nutzereingaben nie ungeprueft interpolieren.
function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Coaching-Anfrage: geht an MAIL_TO_COACHING, Antworten landen beim Kunden.
// Danach eine Bestaetigung an den Kunden, deren Fehler die Anfrage nicht kippt.
// Erwartet bereits validierte und bereinigte Felder.
export async function sendCoaching({ name, email, why, phone }) {
  if (!config.resendKey) return simulate(`Coaching-Anfrage von ${email}`);
  if (!config.mailToCoaching) throw mailError('MAIL_TO_COACHING fehlt', 'NO_MAIL');

  await resendSend({
    to: [config.mailToCoaching],
    reply_to: email,
    subject: `Coaching-Anfrage von ${name}`,
    text: `Name: ${name}\nE-Mail: ${email}\nWoran es hakt: ${why || '-'}\nTelefon: ${phone || '-'}`,
    html: `<h2>Neue Coaching-Anfrage</h2><p><b>Name:</b> ${esc(name)}<br><b>E-Mail:</b> ${esc(email)}<br><b>Woran es hakt:</b> ${esc(why) || '-'}<br><b>Telefon:</b> ${esc(phone) || '-'}</p>`,
  });

  await resendSend({
    to: [email],
    subject: 'Wir haben deine Coaching-Anfrage erhalten',
    text: `Hallo ${name},\n\ndanke für deine Nachricht. Wir melden uns zeitnah bei dir mit einer Einschätzung, welche Stufe zu dir passt.\n\nSportliche Grüße\nLPP Sports`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0D1B2E;max-width:560px"><p>Hallo ${esc(name)},</p><p>danke für deine Nachricht. Wir melden uns zeitnah bei dir mit einer Einschätzung, welche Stufe zu dir passt.</p><p>Sportliche Grüße<br><b>LPP Sports</b></p></div>`,
  }).catch((err) => console.error('[mail] Bestaetigung an Kunden fehlgeschlagen', err.message));

  return { simulated: false };
}
