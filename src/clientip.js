// Client-IP hinter einem Reverse-Proxy korrekt bestimmen.
//
// X-Forwarded-For ist eine Liste "client, proxy1, proxy2, ...". Jeder Proxy
// haengt die von ihm gesehene IP RECHTS an. Der linke Wert ist vom Client frei
// gesetzt, also spoofbar. Wer split(",")[0] nimmt, liest den erfundenen Wert und
// jede IP-basierte Grenze (Rate-Limit, Sperre) laesst sich durch Rotieren des
// Headers umgehen.
//
// Richtig: so viele Eintraege von rechts ueberspringen, wie es vertrauenswuerdige
// Proxys gibt. Bei Coolify/Traefik ist das genau einer, also der rechteste Wert.
// Konfigurierbar per TRUSTED_PROXY_HOPS. hops=0 ignoriert X-Forwarded-For ganz.
//
// Quelle: gradient-brain security-x-forwarded-for-trusted-proxy-hops-login-sperre
export function clientIpFrom(xffHeader, hops, fallback = 'unknown') {
  const h = Number.isFinite(hops) ? Math.max(0, Math.floor(hops)) : 1;
  if (h > 0 && typeof xffHeader === 'string' && xffHeader.trim()) {
    const list = xffHeader.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list[Math.max(0, list.length - h)];
  }
  return fallback;
}
