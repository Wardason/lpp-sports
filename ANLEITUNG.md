# LPP Sports – Website online stellen

## Inhalt
- `index.html` – die Startseite (Guides, Coaching, FAQ)
- `ki-plan.html` – eigene Seite für den KI-Konfigurator
- `assets/` – Design (`styles.css`), Skripte und die Seitenvorschauen (WebP)
- `versand-pdfs/` – die drei Guide-PDFs für den E-Mail-Versand (nicht öffentlich abrufbar)
- `netlify/functions/plan.mjs` – Serverfunktion für den KI-Plan (siehe ANLEITUNG-KI.md)
- `netlify.toml` – Einstellungen für Netlify

## Variante A: Schnell online (ohne KI) – 2 Minuten
1. Auf https://app.netlify.com/drop gehen.
2. Den ganzen Ordner `lppp-sports-website` ins Fenster ziehen.
3. Fertig: Netlify zeigt dir eine Adresse wie `https://irgendwas.netlify.app`.

Die Website, die Guides (Lesen und Download) und alle Abschnitte funktionieren.
Der KI-Konfigurator zeigt eine Musteransicht, weil Drag & Drop keine Serverfunktionen ausführt.

## Variante B: Mit funktionierendem KI-Plan
Dafür gibt es eine eigene Schritt-für-Schritt-Anleitung: **ANLEITUNG-KI.md**
(GitHub, Netlify, Schlüssel beim KI-Anbieter, Kosten, Absicherung).

## Vor dem echten Start noch nötig
- Bezahlung (z. B. Stripe) vor der Plan-Erstellung, siehe TODO in `plan.mjs` und ANLEITUNG-KI.md
- **E-Mail-Versand für die Guides** (z. B. Brevo, Mailchimp, MailerLite):
  1. Dort eine Liste anlegen und die drei PDFs aus `versand-pdfs/` hochladen.
  2. Double-Opt-in einschalten: Der Interessent bekommt zuerst eine Bestätigungsmail, erst danach die Guides. In Deutschland ist das für Werbemails Pflicht.
  3. Das Formular auf der Startseite mit der Liste verbinden (der Anbieter gibt dir dafür ein Code-Schnipsel).
- Weiterleitung der Coaching-Anfragen (z. B. Netlify Forms)
- Impressum, Datenschutzerklärung, AGB (in Deutschland Pflicht)
- Eigene Domain (in Netlify unter "Domain management")
