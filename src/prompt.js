// Prompt-Bau auf dem Server. Der Browser schickt nur die Formularfelder, nicht
// den fertigen Prompt. Jedes Feld wird gegen eine Allowlist geprueft, damit der
// Endpoint kein offener LLM-Proxy ist.

const ONE_OF = {
  geschlecht: ['Männlich', 'Weiblich', 'Divers'],
  erfahrung: ['Einsteiger', 'Wiedereinsteiger', 'Fortgeschritten (1+ Jahr)'],
  tage: ['2', '3', '4', '5'],
  dauer: ['45 Minuten', '60 Minuten', '75 Minuten'],
  ort: ['Fitnessstudio', 'Zuhause mit Kurzhanteln', 'Zuhause ohne Geräte'],
  ernaehrungsweise: ['Alles', 'Vegetarisch', 'Vegan', 'Pescetarisch'],
  mahlzeiten: ['2', '3', '4', '5'],
  cheatMeal: ['Ja, ein Cheat Meal pro Woche', 'Kein Cheat Meal'],
};

const SUBSET_OF = {
  ziele: ['Muskelaufbau', 'Fett verlieren', 'Maximalkraft', 'Gesundheit und Rücken', 'Mehr Energie im Alltag'],
  wunschuebungen: ['Bankdrücken', 'Kniebeugen', 'Kreuzheben', 'Klimmzüge', 'Schulterdrücken', 'Rudern', 'Beinpresse', 'Bizeps- und Trizepsübungen'],
  schwachstellen: ['Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Bauch und Rumpf'],
};

const NUM = { alter: [18, 99], groesse: [120, 230], gewicht: [40, 250] };

const FREE_TEXT = ['vermeiden', 'beschwerden', 'allergien', 'nichtVerzichten', 'magNicht'];

function clean(s) {
  return String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
}

export function buildPlan(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Ungültige Anfrage' };
  const d = {};

  for (const [k, [min, max]] of Object.entries(NUM)) {
    const n = Number(input[k]);
    if (!Number.isFinite(n) || n < min || n > max) return { ok: false, error: `Feld ${k} ungültig` };
    d[k] = Math.round(n);
  }
  for (const [k, list] of Object.entries(ONE_OF)) {
    const v = String(input[k] ?? '');
    if (!list.includes(v)) return { ok: false, error: `Feld ${k} ungültig` };
    d[k] = v;
  }
  for (const [k, list] of Object.entries(SUBSET_OF)) {
    const arr = Array.isArray(input[k]) ? input[k] : [];
    d[k] = arr.filter((x) => list.includes(x));
  }
  if (d.ziele.length < 1) return { ok: false, error: 'Mindestens ein Ziel wählen' };
  for (const k of FREE_TEXT) d[k] = clean(input[k]);

  return { ok: true, prompt: render(d) };
}

function render(d) {
  return `Du bist ein erfahrener deutscher Krafttrainer und Ernährungscoach. Erstelle auf Deutsch einen individuellen Trainingsplan und einen vereinfachten Ernährungsplan.

KUNDENDATEN:
${JSON.stringify(d, null, 2)}

TRAININGSPRINZIPIEN (verbindlich):
- Jede Muskelgruppe möglichst 2x pro Woche (bei 4 Tagen: Oberkörper/Unterkörper-Split; bei 2-3 Tagen: Ganzkörper).
- Mehrgelenksübungen zuerst, je Übung 2-4 Arbeitssätze, 6-15 Wiederholungen, meist 8-10.
- Mindestens 4 fordernde Sätze pro Muskelgruppe pro Woche, Schwachstellen etwas mehr.
- Steigerungsregel: Wer alle Sätze mit dem oberen Wiederholungsziel sauber schafft, erhöht beim nächsten Mal das Gewicht (Oberkörper +1-2,5 kg, Beine +2,5-5 kg).
- Einheit passt in die angegebene Dauer; kleine Übungen als Supersätze, um Zeit zu sparen. Kurzes übungsspezifisches Aufwärmen.
- Wunschübungen einbauen, zu vermeidende Übungen weglassen, Beschwerden berücksichtigen (schonende Alternativen, Hinweis auf ärztliche Abklärung).
- Trainingsort beachten (nur verfügbare Geräte).

ERNÄHRUNGSPRINZIPIEN (verbindlich):
- Tagesstruktur: morgens Schwerpunkt Fette + Eiweiß, mittags Kohlenhydrate + Eiweiß, vor dem Training Kohlenhydrate, nach dem Training Eiweiß. Diese Reihenfolge ist Komfort und Planbarkeit - die Tagesmenge ist wichtiger und hat Vorrang vor dem Timing.
- Genug Eiweiß: ca. 1,6 g pro kg Körpergewicht pro Tag, verteilt auf mindestens 4 Portionen (ca. 0,4 g/kg pro Mahlzeit, etwa alle 3-4 Stunden). Genug gesunde Fette, Mikronährstoffe über Gemüse und Obst zu jeder Mahlzeit.
- Allergien und Unverträglichkeiten strikt ausschließen. Abneigungen und Ernährungsweise beachten. Das, worauf der Kunde nicht verzichten will, sinnvoll einplanen. Cheat Meal nach Wunsch.
- Keine extremen Diäten, keine Kalorienzahlen unter einer gesunden Größenordnung, keine Nahrungsergänzungs-Pflicht.

FORMAT (Markdown, knapp, keine Einleitung):
## Dein Trainingsplan
Kurze Übersicht der Woche (welcher Tag was).
Für jeden Trainingstag: ### Tagesname, dann eine Tabelle | Übung | Sätze x Wdh. | Pause | Hinweis |
## Deine Steigerungsregel
2-3 Stichpunkte.
## Dein Ernährungsplan
Tagesstruktur passend zur Anzahl Mahlzeiten als Stichpunkte mit konkreten Beispielen (Trainingstag). Danach ### Ruhetag (kurz), ### Cheat Meal (kurz), ### Einkaufsliste (Stichpunkte).
## Worauf du achten solltest
3 kurze Stichpunkte.`;
}
