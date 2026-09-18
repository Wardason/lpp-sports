# LPP Sports Website

Statische Marketing-Seite plus KI-Plan-API in einem Node-Service (Hono),
same-origin. Deploy per Docker auf Coolify. Architektur und Begruendung stehen
im ADR unter `docs/adr/0001-coolify-single-app-same-origin.md`.

## Struktur

```
public/         statische Seite (index.html, ki-plan.html, assets/)
src/            Server (server.js, prompt.js, llm.js, captcha.js, ratelimit.js)
private-pdfs/   Guides, werden nicht oeffentlich ausgeliefert
Dockerfile      Build fuer Coolify
```

## Lokal starten

```
npm install
node src/server.js
```

Ohne Provider-Key laeuft die Seite trotzdem, `/api/plan` liefert dann 503 und
das Frontend zeigt die Musteransicht. Fuer echte Plaene eine `.env` aus
`.env.example` anlegen (mindestens `OPENAI_API_KEY`).

## Deploy auf Coolify

1. Repo bei GitHub anlegen und pushen.
2. In Coolify: neue Application, Source ist das GitHub-Repo, Build Pack
   "Dockerfile", Port 3000.
3. Domain setzen (z. B. `https://lpp-sports.de`), TLS uebernimmt Traefik.
4. Env-Variablen setzen (siehe unten).
5. Deploy.

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
| `STRIPE_SECRET_KEY` | spaeter | erst bei Zahlschranke |
| `STRIPE_WEBHOOK_SECRET` | spaeter | erst bei Zahlschranke |

## Sicherheit

- Prompt wird serverseitig aus geprueften Feldern gebaut, kein offener LLM-Proxy.
- Rate-Limit pro IP (10 Plaene / 10 min), Origin-Check, Proof-of-Work-Captcha.
- `max_tokens` gesetzt, Security-Header inkl. CSP.
- Offen bis zum Verkaufsstart: Zahlschranke (Stripe) als naechste Schicht,
  Details im ADR.
