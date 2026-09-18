// LPP Sports – Serverfunktion für den KI-Plan
// Läuft auf Netlify (Functions 2.0) unter der Adresse /api/plan.
//
// Der API-Schlüssel steht NUR hier auf dem Server, nie im Browser.
// In Netlify unter "Site configuration > Environment variables" setzen:
//   KI_ANBIETER      openai            (oder: anthropic)
//   OPENAI_API_KEY   sk-...            (bei KI_ANBIETER=openai)
//   ANTHROPIC_API_KEY sk-ant-...       (bei KI_ANBIETER=anthropic)
//   KI_MODELL        gpt-5.6-terra     (optional, sonst Standard unten)
//
// Die Antwort wird gestreamt: Der Kunde sieht den Plan Zeile für Zeile
// entstehen, und die Funktion läuft nicht in eine Zeitüberschreitung.

const ANBIETER = (process.env.KI_ANBIETER || "openai").toLowerCase();

const CONFIG = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    modell: process.env.KI_MODELL || "gpt-5.6-terra",
    key: () => process.env.OPENAI_API_KEY,
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (prompt, modell) => ({
      model: modell,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
    // Text aus einem SSE-Datenblock herausziehen
    text: (json) => json?.choices?.[0]?.delta?.content || "",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    modell: process.env.KI_MODELL || "claude-sonnet-5",
    key: () => process.env.ANTHROPIC_API_KEY,
    headers: (key) => ({
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    body: (prompt, modell) => ({
      model: modell,
      stream: true,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
    text: (json) => (json?.type === "content_block_delta" ? json?.delta?.text || "" : ""),
  },
};

export default async (req) => {
  if (req.method !== "POST") return new Response("Nur POST erlaubt", { status: 405 });

  const cfg = CONFIG[ANBIETER];
  if (!cfg) return fehler("Unbekannter Anbieter in KI_ANBIETER", 500);

  const key = cfg.key();
  if (!key) return fehler("API-Schlüssel fehlt. Environment-Variable in Netlify setzen.", 500);

  let prompt = "";
  try {
    ({ prompt } = await req.json());
  } catch {
    return fehler("Ungültige Anfrage", 400);
  }
  if (typeof prompt !== "string" || prompt.length < 50 || prompt.length > 8000) {
    return fehler("Ungültige Anfrage", 400);
  }

  // TODO vor dem Livegang: hier prüfen, ob der Kunde bezahlt hat
  // (z. B. Stripe-Checkout-Session-ID mitschicken und serverseitig verifizieren).
  // Ohne diese Prüfung kann jeder kostenlos Pläne erzeugen – auf deine Rechnung.

  let upstream;
  try {
    upstream = await fetch(cfg.url, {
      method: "POST",
      headers: cfg.headers(key),
      body: JSON.stringify(cfg.body(prompt, cfg.modell)),
    });
  } catch {
    return fehler("KI-Anbieter nicht erreichbar", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("KI-Fehler", upstream.status, detail.slice(0, 500));
    return fehler("Die KI-Anfrage ist fehlgeschlagen", 502);
  }

  // SSE des Anbieters einlesen und als reinen Text an den Browser weitergeben
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let rest = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          rest += decoder.decode(value, { stream: true });
          const zeilen = rest.split("\n");
          rest = zeilen.pop() || "";
          for (const zeile of zeilen) {
            const z = zeile.trim();
            if (!z.startsWith("data:")) continue;
            const daten = z.slice(5).trim();
            if (!daten || daten === "[DONE]") continue;
            try {
              const stueck = cfg.text(JSON.parse(daten));
              if (stueck) controller.enqueue(encoder.encode(stueck));
            } catch {
              /* unvollständige Zeile überspringen */
            }
          }
        }
      } catch (e) {
        console.error("Stream-Fehler", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
};

function fehler(nachricht, status) {
  return new Response(JSON.stringify({ error: nachricht }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const config = { path: "/api/plan" };
