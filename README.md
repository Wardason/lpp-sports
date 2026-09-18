# lap-sports

Website fuer LPP Sports. Statische Seite mit KI-gestuetztem Trainingsplan-Generator.

## Struktur

- `index.html`, `ki-plan.html`: Seiten der Website
- `assets/`: Styles, JavaScript, Logo und Bilder
- `api/plan.php`: PHP-Backend fuer den Plan-Generator (klassisches Hosting)
- `netlify/functions/plan.mjs`: Serverless-Function fuer Netlify-Hosting
- `netlify.toml`: Netlify-Konfiguration

## KI-Konfiguration

Der API-Schluessel wird nie eingecheckt.

- **PHP-Hosting:** `api/ki-config.beispiel.php` nach `api/ki-config.php` kopieren und ausfuellen (per `.gitignore` ausgeschlossen).
- **Netlify:** Environment-Variablen setzen (`KI_ANBIETER`, `OPENAI_API_KEY` bzw. `ANTHROPIC_API_KEY`, optional `KI_MODELL`).

Details siehe `ANLEITUNG-KI.md`.
