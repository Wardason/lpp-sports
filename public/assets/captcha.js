/* Proof-of-Work-Captcha: Challenge holen und im Browser lösen.
   Gemeinsam genutzt von Konfigurator und Plan-Berater. Jede Lösung gilt nur
   für eine Anfrage, deshalb wird nach dem Verbrauch eine neue vorbereitet. */
window.LPP = window.LPP || {};
(function(){
  async function solve(ch){
    const enc=new TextEncoder();
    for(let n=0;n<=ch.maxnumber;n++){
      const buf=await crypto.subtle.digest('SHA-256',enc.encode(ch.salt+n));
      const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hex===ch.challenge)return{salt:ch.salt,number:n,challenge:ch.challenge,expires:ch.expires,signature:ch.signature};
    }
    throw new Error('captcha');
  }
  async function fetchAndSolve(){
    const r=await fetch('/api/captcha');
    if(!r.ok)throw new Error('captcha');
    return solve(await r.json());
  }
  let pending=null;
  window.LPP.captcha={
    prime(){if(!pending)pending=fetchAndSolve().catch(()=>null)},
    /* liefert die Lösung (oder null, wenn der Dienst nicht eingerichtet ist) und bereitet die nächste vor */
    async take(){
      const p=pending||fetchAndSolve().catch(()=>null);
      pending=null;
      const c=await p;
      window.LPP.captcha.prime();
      return c;
    }
  };
})();
