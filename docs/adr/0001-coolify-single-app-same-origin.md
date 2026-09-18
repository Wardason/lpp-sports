# ADR 0001: Ein Coolify-Service, Frontend und API same-origin

Status: Accepted
Datum: 2026-09-18

## Context

Die LPP-Sports-Website ist eine statische Marketing-Seite plus ein einzelner
Endpoint, der Formulardaten in einen Trainings- und Ernaehrungsplan uebersetzt
und die Antwort eines LLM-Anbieters (OpenAI oder Anthropic) streamt.

Bisher gab es zwei parallele Deploy-Pfade: Netlify Functions (`netlify/`) und
klassisches PHP-Hosting (`api/*.php`). Beide bringen Probleme mit:

- Netlify ist ein US-Anbieter, gegen den DSGVO-Default (EU/Self-Hosted).
- Der Netlify-Redirect fuer `versand-pdfs` greift nicht, weil er nicht geforct
  ist und die Dateien real im Publish-Ordner liegen (Shadowing).
- Der PHP-Pfad braucht `ki-config.php` mit dem Key, was ohne `.gitignore` eine
  Key-Leak-Falle ist und auf Netlify als Klartext ausgeliefert wuerde.
- Der Endpoint ist ein offener LLM-Proxy: kein Auth, kein Rate-Limit, und der
  fertige Prompt wird vom Browser geschickt und unveraendert weitergereicht.

Coolify auf Hetzner ist bereits Teil unseres Stacks. Die Frage war Subdomain
(`api.lpp-sports.de`) versus Pfad (`/api`) versus ein gemeinsamer Service.

## Decision

Ein einzelnes GitHub-Repo, eine Coolify-App, per Dockerfile deployt. Ein
Node-Service (Hono) liefert die statische Seite aus und stellt `POST /api/plan`
auf derselben Origin bereit. Kein Subdomain, kein CORS.

Begruendung gegen die Subdomain: Der Sicherheitsunterschied ist fuer das
Bedrohungsszenario (Skript- und curl-Missbrauch) praktisch null, weil ein
Origin-Header serverseitig spoofbar ist. Same-origin spart aber CORS und
haelt den Weg fuer spaetere Cookie-Sessions frei. Ein einziger Endpoint
rechtfertigt keine zwei getrennten Deployments.

Die Netlify- und PHP-Pfade werden entfernt.

## Sicherheitsmassnahmen (von Anfang an)

1. Prompt serverseitig bauen. Der Browser schickt nur die strukturierten,
   validierten Formularfelder. Der Server prueft jedes Feld gegen eine
   Allowlist und konstruiert den Prompt. Damit ist der Endpoint kein offener
   LLM-Proxy mehr.
2. Rate-Limit pro IP (Sliding Window, `X-Forwarded-For` von Traefik). In-Memory
   fuer eine Instanz; bei Skalierung auf Redis umstellen.
3. Origin- und Referer-Allowlist als billige erste Huerde.
4. Altcha (self-hosted Proof-of-Work-Captcha, kein externer Dienst, kein
   Datenabfluss). Passt zum DSGVO-Default, kostet nichts, braucht nur ein
   HMAC-Secret.
5. `max_tokens` bei beiden Anbietern gesetzt (Kostenobergrenze pro Request).
6. Security-Header: CSP (`default-src 'self'`, Google Fonts erlaubt),
   `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, minimale
   `Permissions-Policy`.
7. `versand-pdfs` liegt ausserhalb des oeffentlichen Web-Roots und wird nicht
   statisch ausgeliefert.
8. Einwilligung (Art. 9 DSGVO, Gesundheitsdaten) als Pflicht-Checkbox auf
   `ki-plan.html` vor dem Absenden.
9. Zahlschranke (Stripe) ist die naechste Schutzschicht. Sie wird als sauberer
   Integrationspunkt dokumentiert, nicht mit Dummy-Logik im kritischen Pfad
   vorgetaeuscht. Der Endpoint funktioniert ohne sie korrekt und ist durch
   1 bis 4 gegen Massenmissbrauch geschuetzt.
10. Keine Secrets im Repo. `.gitignore` und `.dockerignore` schliessen sie aus,
    der Key kommt ausschliesslich aus Coolify-Env-Variablen.

## Secrets und Env-Variablen

Zur Laufzeit an der Coolify-App gesetzt:

| Name                | Pflicht        | Zweck                                          |
| ------------------- | -------------- | ---------------------------------------------- |
| `KI_ANBIETER`       | ja             | `openai` oder `anthropic`                      |
| `OPENAI_API_KEY`    | bei openai     | Provider-Key, Spend-Limit im Konto setzen      |
| `ANTHROPIC_API_KEY` | bei anthropic  | Provider-Key                                   |
| `KI_MODELL`         | optional       | Modellname, sonst Standard                     |
| `ALLOWED_ORIGIN`    | ja             | z. B. `https://lpp-sports.de`, fuer Origin und CSP |
| `CAPTCHA_HMAC_KEY`  | ja             | Zufalls-Secret zum Signieren der Captcha-Challenges |
| `PORT`              | optional       | Standard 3000                                  |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | optional | seitenweiter Schutz fuer den privaten Prototyp |
| `STRIPE_SECRET_KEY` | spaeter        | erst bei Zahlschranke                          |
| `STRIPE_WEBHOOK_SECRET` | spaeter    | erst bei Zahlschranke                          |

`CAPTCHA_HMAC_KEY` erzeugt Leonard selbst mit `openssl rand -hex 32` und traegt
ihn nur in Coolify ein, nie ins Repo. Provider-Key kommt vom Anbieter. Die
optionale Basic Auth wurde aus dem frueheren PHP-Apache-Setup in den Hono-Server
uebernommen und schuetzt den Prototyp vor dem oeffentlichen Launch.

GitHub braucht keine Repo-Secrets. Coolify verbindet sich per GitHub-App mit dem
Repo und deployt per Webhook.

## Consequences

Positiv:
- EU-Hosting fuer die Website, passt zum DSGVO-Default.
- Ein Origin, kein CORS, `fetch('/api/plan')` bleibt relativ.
- Netlify-Shadowing, PHP-Key-Falle und `test.php`-Infoleck fallen weg.
- Offener-Proxy-Problem ist durch serverseitigen Prompt plus Rate-Limit,
  Origin-Check und Captcha entschaerft.

Negativ und offen:
- Gradient betreibt die Box, ist also fuer Uptime und Updates zustaendig.
- In-Memory-Rate-Limit haelt nur bei einer Instanz. Skalierung braucht Redis.
- Zahlschranke fehlt noch. Sie bleibt die eigentliche Absicherung gegen
  gezielten Kostenmissbrauch und muss vor dem Verkaufsstart dazukommen.

## Superseded

Keine.
