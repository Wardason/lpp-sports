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

/* Formulare (Prototyp) */
const validMail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
document.getElementById('signupForm').addEventListener('submit',e=>{
  e.preventDefault();const v=document.getElementById('suEmail').value.trim(),m=document.getElementById('suMsg');
  if(!validMail(v)){m.className='form-msg err';m.textContent='Bitte gib eine gültige E-Mail-Adresse ein.';return}
  if(!document.getElementById('suConsent').checked){m.className='form-msg err';m.textContent='Bitte bestätige, dass wir dir die Guides per E-Mail schicken dürfen.';return}
  m.className='form-msg ok';m.textContent='Eingetragen. Prototyp: Der Versand der Guides ist noch nicht angebunden.';
});
document.getElementById('coachForm').addEventListener('submit',e=>{
  e.preventDefault();const n=document.getElementById('cName').value.trim(),v=document.getElementById('cMail').value.trim(),m=document.getElementById('cMsg');
  if(!n||!validMail(v)){m.className='form-msg err';m.textContent='Bitte Name und gültige E-Mail-Adresse angeben.';return}
  m.className='form-msg ok';m.textContent='Anfrage gesendet. Prototyp: Die Anfrage wird noch nicht übermittelt.';
});


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
