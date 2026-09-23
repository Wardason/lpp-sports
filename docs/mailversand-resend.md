# Mailversand via Resend, Implementierungs-Handoff

Status: `/api/lead` gebaut (Stand 2026-09-21), siehe `docs/adr/0002-mailversand-resend.md`.
Offen: DNS, AVV. `/api/coaching` ist umgesetzt (siehe ADR 0002). Achtung: Das Repo ist oeffentlich, Variante 1
weiter unten (PDFs committen) ist damit ausgeschlossen, Guide 3 kommt per `PDF_DIR`.

Dieses Dokument ist selbst-enthalten, damit ein spaeterer Agent es ohne weiteren
Kontext umsetzen kann. Die Quellen sind Leonards Gradient Brain, die Kernpunkte
stehen hier inline.

## Ziel

Zwei Formulare, aktuell Prototyp (Meldung statt Versand):

1. Guides-Anmeldung (`signupForm` in `public/index.html`, Handler in
   `public/assets/main.js`): E-Mail plus Einwilligung. Der Kunde bekommt die
   drei Guides aus `private-pdfs/` per Mail als Anhang.
2. Coaching-Anfrage (`coachForm`): Name plus E-Mail, optional Nachricht.
   Benachrichtigung an `MAIL_TO_COACHING`, optional Bestaetigungsmail an den
   Kunden.

## Architektur-Einordnung

- Ein Hono-Service (`src/server.js`), same-origin. Zwei neue Routen:
  `POST /api/lead` und `POST /api/coaching`.
- Kein Captcha fuer diese Formulare. Anders als `/api/plan`, das sein
  Proof-of-Work-Captcha behaelt, weil jeder Aufruf echtes LLM-Geld kostet. Die
  Mail-Formulare kosten fast nichts, deshalb reicht leichtes Anti-Spam.
- Provider austauschbar halten: die gesamte Versandlogik in `src/mail.js`
  kapseln, damit ein Wechsel weg von Resend nur diese Datei betrifft.

## Wichtigster Stolperstein: PDFs im Container

`private-pdfs/` ist bewusst nicht oeffentlich serviert, steht in `.gitignore`
UND `.dockerignore`. Fuer den Mailversand muessen die PDFs aber zur Laufzeit im
Container liegen. Da sie gitignored sind, landen sie nicht im Coolify-Checkout
und damit nicht im Docker-Build-Context. Entscheidung noetig:

- Wenn das GitHub-Repo privat ist (pruefen): die drei PDFs committen (aus
  `.gitignore` nehmen), `COPY private-pdfs ./private-pdfs` ins Dockerfile, aber
  NIE ueber eine Route ausliefern. Einfachster Weg, nur 234K, statisch.
- Wenn sie aus Git rausbleiben sollen: als Coolify-Volume mounten oder in
  S3-kompatiblen Speicher (Hetzner/MinIO) legen und zur Sendezeit laden.

Empfehlung: bei privatem Repo Variante 1.

## Anti-Spam (aus gradient-brain form-anti-spam-ohne-captcha)

Drei leichte Mechanismen, kein Captcha, kein Fremddienst:

- Honeypot: verstecktes Textfeld mit echt klingendem Namen (z. B. `_website`),
  per CSS unsichtbar (`display:none`), `aria-hidden`, `tabindex="-1"`,
  `autocomplete="off"`. Gefuellt heisst Bot.
- Time-Trap: `landedAt` (Zeitpunkt Seitenaufruf, in `sessionStorage`, damit ein
  Reload den Timer nicht resettet) und `submittedAt` mitschicken, serverseitig
  die Differenz pruefen. Unter 10 Sekunden gilt als Bot.
- Rate-Limit: Key aus (IP + E-Mail), nicht nur IP. Reine IP-Keys sperren echte
  Kunden aus, weil hinter Carrier-Grade-NAT (Mobilfunk) viele eine IP teilen.
  `src/ratelimit.js` nutzen, z. B. 5 pro Stunde pro (IP, E-Mail).

Regeln:
- Bot-Erkennung (Honeypot, Time-Trap) NIE mit Fehler beantworten, immer fake 200
  (Erfolg vortaeuschen, keine Mail senden), sonst lernen Bots aus dem Fehler.
- Echte Validierungsfehler 400, Rate-Limit 429.
- Reihenfolge im Handler: Methode, JSON parsen, Validierung (400), Honeypot
  (fake 200), Time-Trap (fake 200), Rate-Limit (429), erst dann Mail.
- Client-IP IMMER ueber `src/clientip.js` (`clientIpFrom`, rechter Proxy-Hop,
  `TRUSTED_PROXY_HOPS`). NICHT `split(",")[0]`, das ist client-spoofbar und war
  hier schon einmal ein Bug (siehe ADR 0001 und
  gradient-brain security-x-forwarded-for-trusted-proxy-hops-login-sperre).
  Achtung: das aeltere Anti-Spam-Learning nennt "erster Eintrag", das ist
  ueberholt.

## Resend-Integration (ohne SDK)

REST reicht, dependency-arm bleiben:

- `POST https://api.resend.com/emails`
- Header: `Authorization: Bearer ${RESEND_API_KEY}`, `content-type: application/json`
- Body: `{ from, to, subject, html, text, attachments: [{ filename, content }] }`
- Anhang `content` ist base64: `readFileSync(pfad).toString('base64')`.
- Absender-Domain muss in Resend verifiziert sein (DNS, siehe unten).
- Fehlerbehandlung: non-2xx von Resend loggen, dem Nutzer freundliche Meldung.
- E-Mail-Format serverseitig validieren, keine ungeprueften User-Eingaben in
  `subject` oder `from` interpolieren.

## Secrets (Coolify, Runtime-Variablen)

| Name | Zweck |
| --- | --- |
| `RESEND_API_KEY` | Resend-Key |
| `MAIL_FROM` | z. B. `LPP Sports <hallo@lpp-sports.de>`, verifizierte Domain |
| `MAIL_TO_COACHING` | Posteingang fuer Coaching-Anfragen |
| `MAIL_BCC` | optional, Archivkopie |

Alle als Runtime-Variablen setzen, nie ins Repo.

## DNS (einmalig, in der Domain)

SPF, DKIM, DMARC nach Resends Vorgaben eintragen. Ohne diese landen die Mails im
Spam (gradient-brain all-inkl-php-mail-zustellung). Resend zeigt die genauen
Records im Dashboard.

## Frontend (`public/assets/main.js`, `public/index.html`)

- `signupForm`: aktuell `preventDefault` plus Prototyp-Meldung. Umbauen auf
  `POST /api/lead` mit `{ email, consent, _website (Honeypot), landedAt }`.
  Die Consent-Checkbox `suConsent` existiert schon.
- `coachForm`: analog `POST /api/coaching` mit
  `{ name, email, message?, _website, landedAt }`.
- Erfolgs- und Fehlermeldungen in die vorhandenen `.form-msg` Elemente.
- HTML: Honeypot-Feld plus `.honeypot { display:none }` ergaenzen,
  `landedAt` beim Laden in `sessionStorage` schreiben.

## DSGVO

- Resend ist eine US-Firma. Noetig: AVV mit Resend, Absatz in der
  Datenschutzerklaerung (E-Mail und Name gehen an einen US-Dienstleister).
- Einwilligung bei `signupForm` ist ueber `suConsent` vorhanden, bei `coachForm`
  bei Bedarf ergaenzen.
- EU-Alternative, falls gewuenscht: Brevo oder Mailjet (Frankreich) oder SMTP
  ueber den deutschen Hoster. Gleiche Endpoint-Struktur, nur `src/mail.js`
  tauscht den Provider. Das ist gegen den DSGVO-Default, also bewusst abwaegen.

## Reihenfolge beim Bauen

1. ADR `docs/adr/0002-mailversand-resend.md` anlegen (Provider-Wahl,
   DSGVO-Abwaegung, PDF-Verfuegbarkeit im Container).
2. `src/mail.js` (Resend-Client, Attachment-Helper).
3. Routen `/api/lead` und `/api/coaching` mit dem Anti-Spam-Ablauf.
4. PDF-Verfuegbarkeit im Container klaeren (siehe oben).
5. Frontend anbinden.
6. DNS setzen, dann Test mit echtem Versand an eine eigene Adresse.

## Quellen (Leonards Gradient Brain)

- `form-anti-spam-ohne-captcha`
- `all-inkl-php-mail-zustellung`
- `security-x-forwarded-for-trusted-proxy-hops-login-sperre`
- `php-formular-backend-statische-site`
