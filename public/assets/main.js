/* Menü */
const menuBtn=document.querySelector('.menu-btn'),nav=document.getElementById('mainnav');
menuBtn.addEventListener('click',()=>{const o=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',o)});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuBtn.setAttribute('aria-expanded',false)}));

/* Signatur: Steigerungs-Log */
const logData=[["Woche 1",60,8],["Woche 2",60,9],["Woche 3",60,10],["Woche 4",62.5,8],["Woche 5",62.5,10],["Woche 6",65,9],["Woche 7",67.5,8],["Woche 8",70,8]];
const rowsEl=document.getElementById('logRows');
const fmt=n=>String(n).replace('.',',');
logData.forEach(([w,kg,reps],i)=>{
  const up=i>0&&kg>logData[i-1][1];
  const r=document.createElement('div');r.className='log-row'+(up?' up':'');
  r.innerHTML=`<span class="wk">${w}</span><div class="log-track"><div class="log-fill" data-w="${((kg-50)/20)*100}"></div></div><span class="val">${fmt(kg)} kg × ${reps}${up?'<span class="tag-up">+</span>':''}</span>`;
  rowsEl.appendChild(r);
});
requestAnimationFrame(()=>setTimeout(()=>{
  document.querySelectorAll('.log-fill').forEach((f,i)=>setTimeout(()=>f.style.width=f.dataset.w+'%',i*120));
},200));

/* Mehr als Optik: Wörter leuchten nacheinander auf, wenn sichtbar */
const words=[...document.querySelectorAll('#benefitWords span')];
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){words.forEach((w,i)=>setTimeout(()=>w.classList.add('on'),i*260));io.disconnect()}})},{threshold:.4});
io.observe(document.getElementById('benefitWords'));
if(matchMedia('(prefers-reduced-motion: reduce)').matches) words.forEach(w=>w.classList.add('on'));

/* Formulare */
const validMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* Anti-Spam: Zeitpunkt des Seitenaufrufs (sessionStorage, damit ein Reload den Timer nicht zurücksetzt) */
const landedAt=(()=>{try{let t=sessionStorage.getItem('lpp_landed');if(!t){t=String(Date.now());sessionStorage.setItem('lpp_landed',t)}return +t}catch{return Date.now()}})();

/* Guides-Anmeldung: schickt alle drei Guides per E-Mail (Formulare mit data-lead-form) */
document.querySelectorAll('[data-lead-form]').forEach(form=>{
  const msg=form.querySelector('.form-msg'),btn=form.querySelector('button[type=submit]');
  const say=(cls,t)=>{msg.className='form-msg '+cls;msg.textContent=t};
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=form.elements.email.value.trim();
    if(!validMail(email))return say('err','Bitte gib eine gültige E-Mail-Adresse ein.');
    if(!form.elements.consent.checked)return say('err','Bitte bestätige, dass wir dir die Guides per E-Mail schicken dürfen.');
    btn.disabled=true;say('','Wird gesendet …');
    try{
      const r=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,consent:true,_website:form.elements._website.value,landedAt})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){say('err',j.error||'Das hat nicht geklappt. Bitte versuche es später erneut.');btn.disabled=false;return}
      say('ok',j.simulated
        ?'Testmodus: Alles hat geklappt, es wurde aber keine echte E-Mail versendet.'
        :'Geschafft. Wir haben dir alle drei Guides an '+email+' geschickt. Schau auch im Spam-Ordner nach.');
      form.querySelectorAll('input').forEach(i=>{i.disabled=true});return; /* Erfolg: Formular bleibt gesperrt */
    }catch{say('err','Keine Verbindung. Bitte versuche es später erneut.')}
    btn.disabled=false
  });
});

/* Guide 3: verschwommene Vorschau, Freischaltung per E-Mail */
(function(){
  const dlg=document.getElementById('guide3Dialog');if(!dlg)return;
  document.querySelectorAll('[data-open-guide3]').forEach(b=>b.addEventListener('click',()=>{dlg.showModal();setTimeout(()=>dlg.querySelector('input[name=email]').focus(),50)}));
  dlg.querySelector('[data-close-guide3]').addEventListener('click',()=>dlg.close());
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
})();
/* Coaching-Anfrage: geht per E-Mail an uns, der Kunde bekommt eine Bestätigung */
(function(){
  const form=document.getElementById('coachForm');if(!form)return;
  const m=document.getElementById('cMsg'),btn=form.querySelector('button[type=submit]');
  const say=(cls,t)=>{m.className='form-msg '+cls;m.textContent=t};
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=document.getElementById('cName').value.trim(),email=document.getElementById('cMail').value.trim();
    if(!name||!validMail(email))return say('err','Bitte Name und gültige E-Mail-Adresse angeben.');
    btn.disabled=true;say('','Wird gesendet …');
    try{
      const r=await fetch('/api/coaching',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,email,why:document.getElementById('cWhy').value,phone:document.getElementById('cTel').value.trim(),_website:form.elements._website.value,landedAt})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){say('err',j.error||'Das hat nicht geklappt. Bitte versuche es später erneut.');btn.disabled=false;return}
      say('ok',j.simulated
        ?'Testmodus: Alles hat geklappt, es wurde aber keine echte E-Mail versendet.'
        :'Anfrage gesendet. Wir melden uns zeitnah bei dir, eine Bestätigung ist an '+email+' unterwegs.');
      form.querySelectorAll('input,select').forEach(i=>{i.disabled=true});return; /* Erfolg: Formular bleibt gesperrt */
    }catch{say('err','Keine Verbindung. Bitte versuche es später erneut.')}
    btn.disabled=false
  });
})();


/* Mobile Erstgespräch-Leiste: nach dem Hero einblenden, am Formular ausblenden */
(function(){
  const bar=document.getElementById('stickyCta');if(!bar)return;
  document.body.classList.add('has-sticky');
  const hero=document.querySelector('.hero'),coach=document.getElementById('coaching');
  let pastHero=false,atCoach=false;
  const upd=()=>bar.classList.toggle('show',pastHero&&!atCoach);
  new IntersectionObserver(([e])=>{pastHero=!e.isIntersecting;upd()}).observe(hero);
  new IntersectionObserver(([e])=>{atCoach=e.isIntersecting;upd()},{threshold:.15}).observe(coach);
})();

/* Ernährungs-Karteikarten: antippen zeigt die Antwort */
document.querySelectorAll('.fcard').forEach(card=>{
  card.addEventListener('click',()=>{
    const open=card.getAttribute('aria-expanded')==='true';
    document.querySelectorAll('.fcard').forEach(c=>c.setAttribute('aria-expanded','false'));
    card.setAttribute('aria-expanded',open?'false':'true');
  });
});
