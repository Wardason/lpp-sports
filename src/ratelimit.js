// In-Memory Sliding-Window Rate-Limit pro Schluessel (z. B. IP). Haelt nur bei
// einer Instanz. Bei Skalierung auf mehrere Instanzen auf Redis umstellen.
const hits = new Map(); // key -> number[] (Zeitstempel)

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    const retryAfter = Math.ceil((windowMs - (now - arr[0])) / 1000);
    return { allowed: false, retryAfter };
  }
  arr.push(now);
  hits.set(key, arr);
  return { allowed: true, retryAfter: 0 };
}

// Alte Eintraege regelmaessig aufraeumen, damit die Map nicht waechst.
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) {
    const keep = arr.filter((t) => now - t < 3600000);
    if (keep.length) hits.set(k, keep);
    else hits.delete(k);
  }
}, 600000).unref();
