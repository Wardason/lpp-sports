# LPP Sports Website

Statische Marketing-Seite plus API (Konfigurator, Plan-Berater, Guides-Versand) in einem Node-Service (Hono),
same-origin. Deploy per Docker auf Coolify. Architektur und Begruendung stehen
im ADR unter `docs/adr/0001-coolify-single-app-same-origin.md`.

## Struktur

```
public/         statische Seite (index, konfigurator, impressum, datenschutz, agb, kontakt, assets/)
public/guides/  Guide 1 und 2 als PDF, oeffentlich lesbar
src/            Server (server.js, prompt.js, berater.js, llm.js, mail.js, captcha.js, ratelimit.js)
private-pdfs/   Guide 3, nicht im Repo (oeffentlich!), nur lokal bzw. als Volume
Dockerfile      Build fuer Coolify
```

## Lokal starten

```
npm install
node src/server.js
```

Ohne Provider-Key laeuft die Seite trotzdem: `/api/plan` liefert dann 503 und
das Frontend zeigt die Musteransicht, der Plan-Berater stellt feste Fragen.
Fuer echte Plaene eine `.env` aus `.env.example` anlegen (mindestens `OPENAI_API_KEY`).

Guide 3 fuer den Mailversand lokal nach `private-pdfs/guide-3-wie-ich-trainieren-sollte.pdf`
legen. Ohne `RESEND_API_KEY` laeuft der Versand im Testmodus (es wird nichts gesendet).

Tests: `npm test`.

## Deploy auf Coolify

1. Repo bei GitHub anlegen und pushen.
2. In Coolify: neue Application, Source ist das GitHub-Repo, Build Pack
   "Dockerfile", Port 3000.
3. Domain setzen (z. B. `https://lpp-sports.de`), TLS uebernimmt Traefik.
4. Env-Variablen setzen (siehe unten).
5. Guide 3 als Persistent Storage mounten (Datei `guide-3-wie-ich-trainieren-sollte.pdf`
   in einen Ordner, z. B. `/data/pdfs`) und `PDF_DIR=/data/pdfs` setzen.
6. Resend: Domain verifizieren (SPF/DKIM/DMARC), Key und `MAIL_FROM` setzen.
7. Deploy.

## Env-Variablen (in Coolify, nie ins Repo)

| Name | Pflicht | Zweck |
| --- | --- | --- |
| `KI_ANBIETER` | ja | `openai` oder `anthropic` |
| `OPENAI_API_KEY` | bei openai | Provider-Key, Spend-Limit im Konto setzen |
| `ANTHROPIC_API_KEY` | bei anthropic | Provider-Key |
| `KI_MODELL` | optional | Modellname, sonst Standard |
| `ALLOWED_ORIGIN` | ja | finale Domain, fuer Origin-Check und CSP |
| `CAPTCHA_HMAC_KEY` | ja | `openssl rand -hex 32`, nur in Coolify |
| `PORT` | optional | Standard 3000 |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | optional | seitenweiter Schutz fuer den privaten Prototyp, beide setzen zum Aktivieren |
| `RESEND_API_KEY` | ja fuer Mailversand | Resend-Key, ohne ihn liefert `/api/lead` in Produktion 503 |
| `MAIL_FROM` | ja fuer Mailversand | Absender auf verifizierter Domain |
| `MAIL_BCC` | optional | Archivkopie der Guides-Mails |
| `PDF_DIR` | ja fuer Mailversand | Ordner mit Guide 3 (Coolify-Volume) |
| `STRIPE_SECRET_KEY` | spaeter | erst bei Zahlschranke |
| `STRIPE_WEBHOOK_SECRET` | spaeter | erst bei Zahlschranke |

## Sicherheit

- Prompt wird serverseitig aus geprueften Feldern gebaut, kein offener LLM-Proxy.
- Rate-Limit pro IP (10 Plaene / 10 min, 30 Chat-Nachrichten / 10 min), Origin-Check, Proof-of-Work-Captcha.
- Guides-Formular: Honeypot, Zeitfalle (5 s), Rate-Limit pro IP und E-Mail. Bots bekommen einen vorgetaeuschten Erfolg.
- `max_tokens` gesetzt, Security-Header inkl. CSP.
- Offen bis zum Verkaufsstart: Zahlschranke (Stripe) als naechste Schicht,
  Details im ADR.
