# ADR 0002: Guides per Resend, Guide 3 nur per E-Mail

Status: Accepted
Datum: 2026-09-21

## Context

Guide 1 und 2 sollen direkt auf der Website lesbar sein. Guide 3 (mit dem
4-Tage-Trainingsplan) bleibt gesperrt: verschwommene Vorschau, Freischaltung nur
ueber die Eintragung einer E-Mail-Adresse. Danach gehen alle drei Guides als
PDF-Anhang per Mail raus.

Das GitHub-Repo ist oeffentlich. Alles, was im Repo liegt, ist fuer jeden
lesbar.

## Decision

- **Guide 1 und 2** liegen in `public/guides/` und werden statisch ausgeliefert.
  Die Seite verlinkt sie direkt (PDF im Browser-Viewer). Fuer diese Pfade
  entfallen CSP und X-Frame-Options, weil sie den Browser-PDF-Viewer teils
  blockieren.
- **Guide 3** liegt nicht im Repo. Der Server liest es aus `PDF_DIR` (Standard
  `./private-pdfs`). In Coolify wird der Ordner als Persistent Storage gemountet.
  Er steht in `.gitignore` und `.dockerignore` und wird nie ueber eine Route
  ausgeliefert. Das ersetzt Variante 1 aus `docs/mailversand-resend.md`
  (PDFs committieren), die nur bei privatem Repo taugt.
- **Versand** ueber die Resend-REST-API ohne SDK, gekapselt in `src/mail.js`.
- **Route** `POST /api/lead` mit Anti-Spam ohne Captcha: Honeypot `_website`,
  Zeitfalle (`landedAt`, unter 5 Sekunden gilt als Bot, weniger streng als die
  10 Sekunden im Handoff, damit Autofill-Nutzer nicht still verlieren),
  Rate-Limit pro (IP, E-Mail) 3 pro Stunde und pro IP 10 pro Stunde. Bots
  bekommen einen vorgetaeuschten Erfolg (200), echte Fehler 400, Limit 429.
- **Testmodus:** Ohne `RESEND_API_KEY` sendet der Server lokal nichts und
  antwortet mit `simulated: true`. In Produktion liefert das 503.

## Coaching-Anfrage

`POST /api/coaching` (Name, E-Mail, Grund, optional Telefon). Die Anfrage geht an
`MAIL_TO_COACHING` mit `reply_to` auf den Kunden, danach eine Bestaetigung an den
Kunden. Scheitert nur die Bestaetigung, gilt die Anfrage trotzdem als gesendet.
Gleiches Anti-Spam wie `/api/lead` (gemeinsame Funktion `looksLikeBot`), eigene
Rate-Limits. Nutzereingaben werden fuer den Betreff einzeilig gemacht und im
HTML escaped. Ohne `MAIL_TO_COACHING` liefert die Route 503.

## Plan-Berater

`POST /api/berater`: KI-Chat, der per Rueckfragen die passende der drei Stufen
findet. Der System-Prompt entsteht serverseitig, der Client schickt nur den
Verlauf (streng abwechselnd user/assistant, max. 12 Nutzernachrichten, je 500
Zeichen). Schutz wie beim Plan: Origin-Check, Rate-Limit, Proof-of-Work-Captcha
pro Nachricht, `max_tokens` 500. Die Empfehlung kommt als letzte Zeile
`EMPFEHLUNG: <stufe>`, der Server trennt sie ab. Ist die KI nicht erreichbar,
stellt das Frontend vier feste Fragen.

## Offen

- **Double-Opt-in** fuer die Tipps-und-Angebote-Mails (UWG/DSGVO-Nachweis).
  Aktuell geht die Guides-Mail direkt raus, das ist auf Wunsch des Nutzers
  zulaessig, fuer spaetere Werbemails braucht es eine bestaetigte Einwilligung.
- **AVV und Datenschutzerklaerung** mit Resend und dem KI-Anbieter.
- **DNS** (SPF, DKIM, DMARC) fuer die Absenderdomain.
