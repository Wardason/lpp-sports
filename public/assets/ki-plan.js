/* Konfigurator */
const form=document.getElementById('planForm');
const panels=[...form.querySelectorAll('.step-panel')];
const stepItems=[...document.querySelectorAll('#stepList li')];
const backBtn=document.getElementById('backBtn'),nextBtn=document.getElementById('nextBtn'),stepMsg=document.getElementById('stepMsg');
let step=0;
const val=n=>{const el=form.elements[n];if(!el)return'';if(el instanceof RadioNodeList){const c=[...el].filter(x=>x.checked);return el[0]?.type==='checkbox'?c.map(x=>x.value):(c[0]?.value||'')}return el.value.trim()};
function data(){return{alter:val('age'),geschlecht:val('sex'),groesse:val('height'),gewicht:val('weight'),erfahrung:val('level'),tage:val('days'),dauer:val('duration'),ziele:val('goals'),ort:val('place'),wunschuebungen:val('fav'),vermeiden:val('avoid'),schwachstellen:val('weak'),beschwerden:val('limits'),allergien:val('allergies'),nichtVerzichten:val('keep'),magNicht:val('dislike'),ernaehrungsweise:val('diet'),mahlzeiten:val('meals'),cheatMeal:val('cheat')}}
function validate(){
  if(step===0){const a=+val('age');if(!a||a<18||a>99)return'Bitte gib ein Alter zwischen 18 und 99 an.'}
  if(step===1&&!val('goals').length)return'Wähle mindestens eine Priorität.';
  return'';
}
function show(){
  panels.forEach((p,i)=>p.classList.toggle('show',i===step));
  stepItems.forEach((li,i)=>{li.classList.toggle('active',i===step);li.classList.toggle('done',i<step)});
  backBtn.hidden=step===0;nextBtn.hidden=step===panels.length-1;
  stepMsg.textContent='';
  if(step===4){primeCaptcha();const d=data();document.getElementById('summary').innerHTML=
    `<b>${d.geschlecht}, ${d.alter} Jahre</b>, ${d.groesse} cm, ${d.gewicht} kg · ${d.erfahrung}<br>
     <b>${d.tage} Tage</b> à ${d.dauer} · ${d.ort} · Ziele: ${d.ziele.join(', ')}<br>
     Schwachstellen: ${d.schwachstellen.join(', ')||'keine angegeben'} · Allergien: ${esc(d.allergien)||'keine'} · ${d.ernaehrungsweise} · ${d.cheatMeal}`}
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
nextBtn.addEventListener('click',()=>{const err=validate();if(err){stepMsg.textContent=err;return}step++;show();document.getElementById('ki-plan').scrollIntoView({block:'start',behavior:'smooth'})});
backBtn.addEventListener('click',()=>{step--;show()});

/* Markdown-light Renderer */
function md(t){
  const lines=esc(t).split('\n');let html='',inList=false,inTable=false,tHead=true;
  const inline=s=>s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  const close=()=>{if(inList){html+='</ul>';inList=false}if(inTable){html+='</table></div>';inTable=false}};
  for(const raw of lines){const l=raw.trim();
    if(/^\|/.test(l)){if(/^\|[\s\-:|]+\|$/.test(l))continue;
      if(!inTable){close();html+='<div class="table-scroll"><table>';inTable=true;tHead=true}
      const cells=l.replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()));
      html+='<tr>'+cells.map(c=>tHead?`<th>${c}</th>`:`<td>${c}</td>`).join('')+'</tr>';tHead=false;continue}
    if(inTable){html+='</table></div>';inTable=false}
    if(/^###\s/.test(l)){close();html+=`<h5>${inline(l.slice(4))}</h5>`}
    else if(/^##?\s/.test(l)){close();html+=`<h4>${inline(l.replace(/^##?\s/,''))}</h4>`}
    else if(/^[-*]\s/.test(l)){if(!inList){html+='<ul>';inList=true}html+=`<li>${inline(l.slice(2))}</li>`}
    else if(!l){close()}
    else{close();html+=`<p>${inline(l)}</p>`}
  }
  close();return html;
}

/* Proof-of-Work-Captcha: Challenge holen und im Browser loesen.
   Startet beim Erreichen von Schritt 5, damit die Loesung fertig ist,
   bevor der Kunde auf "Plan erstellen" klickt. */
async function solveChallenge(ch){
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
  return solveChallenge(await r.json());
}
let captchaPromise=null;
function primeCaptcha(){if(!captchaPromise)captchaPromise=fetchAndSolve().catch(()=>null)}

const genBtn=document.getElementById('genBtn'),out=document.getElementById('output'),status=document.getElementById('genStatus'),planOut=document.getElementById('planOut'),tools=document.getElementById('genTools'),stopBtn=document.getElementById('stopBtn');
const consent=document.getElementById('consent'),genMsg=document.getElementById('genMsg');
let ctl=null;
stopBtn.addEventListener('click',()=>ctl&&ctl.abort());

const DEMO=`## Dein Trainingsplan (Beispielansicht)
Mo: Oberkörper A · Di: Unterkörper B · Do: Oberkörper C · Fr: Unterkörper D
### Tag A – Oberkörper
| Übung | Sätze x Wdh. | Pause | Hinweis |
|---|---|---|---|
| Bankdrücken | 3 x 8-10 | 2-3 Min | Hauptübung |
| Rudern am Kabel | 3 x 8-10 | 2 Min | Schulterblätter zusammen |
| Schulterdrücken + Latziehen | 2 x 10-12 | 90 Sek | Supersatz |
| Bizeps + Trizeps | 2 x 10-12 | 60 Sek | Supersatz |
## Dein Ernährungsplan
- **Morgens:** Rührei mit Avocado, Joghurt mit Nüssen
- **Mittags:** Reis, Hähnchen, Gemüse
- **Vor dem Training:** Banane oder Brot
- **Nach dem Training:** Quark mit Beeren
Diese Ansicht ist ein Muster. Sobald die KI-Anbindung eingerichtet ist, wird der Plan aus deinen Angaben erstellt.`;

genBtn.addEventListener('click',async()=>{
  if(consent&&!consent.checked){genMsg.textContent='Bitte bestätige die Einwilligung, damit wir deinen Plan erstellen dürfen.';return}
  genMsg.textContent='';
  out.classList.add('show');planOut.innerHTML='';genBtn.disabled=true;
  status.textContent='Sicherheitsprüfung läuft …';
  tools.hidden=false;ctl=new AbortController();
  let text='';
  try{
    const captcha=await (captchaPromise||fetchAndSolve());
    if(!captcha){status.textContent='Die KI-Anbindung ist noch nicht eingerichtet. Hier siehst du eine Musteransicht.';planOut.innerHTML=md(DEMO);return}
    status.textContent='Dein Plan wird erstellt. Das dauert etwa eine Minute …';
    const r=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:data(),captcha}),signal:ctl.signal});
    if(r.status===429){status.textContent='Zu viele Anfragen. Bitte in ein paar Minuten erneut.';return}
    if(r.status===503){status.textContent='Die KI-Anbindung ist noch nicht eingerichtet. Hier siehst du eine Musteransicht.';planOut.innerHTML=md(DEMO);return}
    if(!r.ok||!r.body)throw new Error('server');
    const reader=r.body.getReader(),dec=new TextDecoder();
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      text+=dec.decode(value,{stream:true});
      status.textContent='Dein Plan wird geschrieben …';
      planOut.innerHTML=md(text);
    }
    if(!text.trim())throw new Error('leer');
    status.textContent='Dein Plan ist fertig.';
  }catch(e){
    if(e.name==='AbortError'){status.textContent='Erstellung gestoppt.'}
    else if(text.trim()){status.textContent='Die Verbindung ist abgebrochen. Der Plan ist unvollständig, bitte noch einmal erstellen.'}
    else{status.textContent='Es hat nicht geklappt. Bitte lade die Seite neu und versuche es erneut.'}
  }finally{tools.hidden=true;genBtn.disabled=false;captchaPromise=null;primeCaptcha()}
});

show();
