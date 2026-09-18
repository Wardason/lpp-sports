# KI-Plan scharf schalten – Schritt für Schritt

Der Code ist fertig. Es fehlen nur noch ein Konto beim KI-Anbieter, ein
Schlüssel und drei Einträge in Netlify.

---

## 1. Wie das Ganze funktioniert

```
Kunde füllt Formular aus
        ↓  (Browser schickt die Antworten an DEINE Adresse)
deine Website  /api/plan   ← hier liegt der API-Schlüssel, unsichtbar für alle
        ↓  (Server fragt den KI-Anbieter)
OpenAI (oder Anthropic)
        ↓  (Antwort kommt Stück für Stück zurück)
Kunde sieht den Plan entstehen
```

Wichtig: Der Schlüssel darf **niemals** in `index.html`, `ki-plan.html` oder
in `assets/` stehen. Alles im Browser kann jeder Besucher auslesen – mit deinem
Schlüssel könnte er dann auf deine Rechnung KI nutzen. Deshalb der Umweg über
die Serverfunktion `netlify/functions/plan.mjs`.

---

## 2. Website mit GitHub verbinden (einmalig)

Serverfunktionen laufen nur bei einer richtigen Veröffentlichung, nicht beim
Hochladen per Drag & Drop.

1. Konto bei https://github.com anlegen.
2. Neues Repository anlegen, z. B. `lpp-sports`, und den Inhalt des Ordners
   hochladen (auf der Repository-Seite: "uploading an existing file").
3. Konto bei https://app.netlify.com anlegen.
4. "Add new site" → "Import an existing project" → GitHub → dein Repository.
5. Einstellungen bestätigen (Netlify liest `netlify.toml` selbst aus) und
   "Deploy" klicken.

Danach hast du eine Adresse wie `https://lpp-sports.netlify.app`.

---

## 3. Schlüssel beim KI-Anbieter holen

Empfehlung: **OpenAI**, weil dort Konto und Abrechnung am schnellsten
eingerichtet sind. Anthropic funktioniert genauso, du änderst später nur eine
Zeile in den Einstellungen.

1. https://platform.openai.com → Konto anlegen.
2. "Billing" → Zahlungsmittel hinterlegen und z. B. 10 $ Guthaben aufladen.
3. **"Spend limit" setzen**, z. B. 20 $ pro Monat. Das ist deine Notbremse.
4. "API keys" → "Create new secret key" → Schlüssel kopieren.
   Er wird nur einmal angezeigt und beginnt mit `sk-`.

Den Schlüssel bitte nirgendwo weiterschicken, auch nicht an mich. Ich kann
für dich keine Konten anlegen und keine Schlüssel eintragen – das musst du
selbst machen, damit Konto und Abrechnung bei dir bleiben.

---

## 4. Schlüssel in Netlify eintragen

In Netlify: **Site configuration → Environment variables → Add a variable**

| Name               | Wert                                      |
| ------------------ | ----------------------------------------- |
| `KI_ANBIETER`      | `openai`                                  |
| `OPENAI_API_KEY`   | dein Schlüssel (`sk-…`)                   |
| `KI_MODELL`        | `gpt-5.6-terra` *(optional)*              |

Danach **Deploys → Trigger deploy → Deploy site**, damit die Variablen
übernommen werden.

Für Anthropic stattdessen: `KI_ANBIETER` = `anthropic`,
`ANTHROPIC_API_KEY` = dein Schlüssel, `KI_MODELL` = `claude-sonnet-5`.

---

## 5. Testen

1. Deine Netlify-Adresse öffnen → `/ki-plan.html`.
2. Alle fünf Schritte ausfüllen → "Plan jetzt erstellen".
3. Der Plan sollte nach wenigen Sekunden Zeile für Zeile erscheinen.

Kommt stattdessen "Die KI-Anbindung ist noch nicht eingerichtet":
in Netlify unter **Logs → Functions** nachsehen. Typische Ursachen:

| Meldung im Log                | Ursache                                      |
| ----------------------------- | -------------------------------------------- |
| `API-Schlüssel fehlt`         | Variable nicht gesetzt oder nicht neu deployt |
| Status 401                    | Schlüssel falsch kopiert                     |
| Status 429                    | Guthaben leer oder Limit erreicht             |
| Status 404 / `model not found`| Modellname in `KI_MODELL` stimmt nicht        |

---

## 6. Was ein Plan kostet

Abgerechnet wird pro Token (etwa 0,75 Wörter). Pro erstelltem Plan fallen
grob 1.500 Token Eingabe und 2.500 Token Ausgabe an.

Preise laut offizieller OpenAI-Preisseite (Stand 17.09.2026, pro 1 Mio. Token):

| Modell          | Eingabe | Ausgabe | Kosten pro Plan (ca.) |
| --------------- | ------- | ------- | --------------------- |
| `gpt-5.6-luna`  | $0,20   | $1,20   | ca. 0,3 Cent          |
| `gpt-5.6-terra` | $2,00   | $12,00  | ca. 3 Cent            |
| `gpt-5.6-sol`   | $4,00   | $20,00  | ca. 5,5 Cent          |

Also selbst bei 100 Plänen im Monat reden wir über wenige Euro. Starte mit
`gpt-5.6-terra` und vergleiche die Qualität mit `luna` – wenn Luna gute Pläne
schreibt, sparst du den Faktor zehn. Preise ändern sich; aktuell nachsehen
unter https://developers.openai.com/api/docs/pricing

---

## 7. Vor dem Verkaufsstart unbedingt erledigen

1. **Bezahlung vorschalten.** Im Moment kann jeder Besucher unbegrenzt Pläne
   erzeugen – auf deine Rechnung. In `plan.mjs` steht an der richtigen Stelle
   ein `TODO`. Üblicher Weg: Stripe Checkout, und die Funktion prüft vor dem
   KI-Aufruf serverseitig, ob die Zahlung erfolgt ist.
2. **Spend limit** beim Anbieter setzen (siehe Schritt 3).
3. **Rate Limiting** in Netlify aktivieren, damit niemand das Formular
   automatisiert hundertfach abschickt.
4. **Datenschutz:** Die Angaben der Kunden (Alter, Gewicht, Allergien) gehen an
   den KI-Anbieter in die USA. Dafür brauchst du
   - einen Auftragsverarbeitungsvertrag mit dem Anbieter (bei OpenAI im
     Konto unter "Data processing agreement" abschließbar),
   - einen entsprechenden Absatz in deiner Datenschutzerklärung,
   - und idealerweise keine Speicherung dieser Daten bei dir. Aktuell speichert
     die Funktion nichts – lass das am besten so.
5. **Pläne stichprobenartig gegenlesen**, besonders am Anfang. Die KI hält sich
   an die Vorgaben im Prompt, aber sie ist kein Trainer.

---

## 8. Wo der Prompt steht

Die Regeln, nach denen die KI Pläne schreibt (Frequenz, Steigerung,
Wiederholungsbereiche, Ernährungsprinzipien, Allergien), stehen in
`assets/ki-plan.js` in der Funktion `buildPrompt`. Wenn du etwas an eurer
Methodik änderst, änderst du sie dort – und die Pläne ändern sich mit.

---

## 9. Andere Anbieter statt Netlify

Netlify ist ein US-Unternehmen: Vertrag und Auftragsverarbeitungsvertrag auf
Englisch, Rechnung in Dollar, Server meist außerhalb Deutschlands. Wenn du es
dir bürokratisch einfacher machen willst, gibt es zwei Wege.

### Weg A: Deutscher Hoster mit Node.js (Code bleibt, wie er ist)

**mittwald** (Espelkamp, Rechenzentrum in Deutschland) bietet managed
Node.js-Hosting, deutschen Telefon-Support, AVV und Rechnung auf Deutsch.
Rund 10–25 € pro Monat. Dort läuft die Funktion aus
`netlify/functions/plan.mjs` mit kleiner Anpassung als Node-App.

### Weg B: Klassisches Webhosting mit PHP (am einfachsten, ab ca. 5 €/Monat)

Anbieter wie **All-Inkl**, **webgo**, **netcup** oder **IONOS**: Server in
Deutschland, AVV per Klick im Kundenkonto, Rechnung mit deutscher
Umsatzsteuer, Support auf Deutsch. Kein GitHub nötig – du lädst die Dateien
einfach per FTP hoch.

Dafür liegt im Ordner `api/` bereits alles bereit:

1. Den kompletten Inhalt des Website-Ordners per FTP hochladen
   (ohne `netlify/`, `netlify.toml` und `versand-pdfs/`).
2. `api/ki-config.beispiel.php` in `api/ki-config.php` umbenennen und deinen
   Schlüssel eintragen.
3. Fertig. Die Datei `api/.htaccess` sorgt dafür, dass `/api/plan`
   funktioniert und die Konfigurationsdatei nicht abrufbar ist.

Voraussetzungen beim Tarif: PHP 8 und die cURL-Erweiterung – beides ist bei
allen genannten Anbietern Standard. Prüfe außerdem in den
Tarif-Einstellungen, dass die maximale Skriptlaufzeit bei mindestens
120 Sekunden liegt.

### Was sich dadurch nicht ändert

Der KI-Anbieter selbst (OpenAI oder Anthropic) sitzt weiterhin in den USA.
Der Auftragsverarbeitungsvertrag mit ihm und der Absatz in der
Datenschutzerklärung bleiben also in jedem Fall nötig. Das Hosting in
Deutschland vereinfacht nur den Vertragsteil für die Website selbst.

### Wovon ich abrate

Vercel und Cloudflare Pages sind technisch super, aber genauso US-Firmen wie
Netlify – der bürokratische Aufwand bleibt derselbe. Ein eigener Server bei
Hetzner ist günstig, verlangt aber, dass du dich selbst um Updates,
Sicherheit und Zertifikate kümmerst.
