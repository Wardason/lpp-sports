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

// Schickt die drei Guides an eine bereits validierte Adresse.
// Ohne RESEND_API_KEY: im Entwicklungsmodus Testlauf (keine Mail), in Produktion Fehler.
export async function sendGuides(to) {
  const files = await attachments();

  if (!config.resendKey) {
    if (config.isProd) {
      const e = new Error('Mailversand nicht konfiguriert');
      e.code = 'NO_MAIL';
      throw e;
    }
    console.warn(`[mail] Testmodus: keine RESEND_API_KEY, es wird nichts gesendet (waere an ${to}).`);
    return { simulated: true };
  }
  if (!config.mailFrom) {
    const e = new Error('MAIL_FROM fehlt');
    e.code = 'NO_MAIL';
    throw e;
  }

  const { text, html } = bodies();
  const payload = { from: config.mailFrom, to: [to], subject: SUBJECT, text, html, attachments: files };
  if (config.mailBcc) payload.bcc = [config.mailBcc];

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    const e = new Error('Resend nicht erreichbar');
    e.code = 'UPSTREAM';
    throw e;
  }
  if (!res.ok) {
    console.error('[mail] Resend-Fehler', res.status, (await res.text().catch(() => '')).slice(0, 300));
    const e = new Error('Mailversand fehlgeschlagen');
    e.code = 'UPSTREAM';
    throw e;
  }
  return { simulated: false };
}
