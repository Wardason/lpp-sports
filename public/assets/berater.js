/* Plan-Berater (Chat). Benötigt captcha.js.
   Ist die KI nicht erreichbar, stellt der Berater stattdessen vier feste Fragen. */
(function(){
const log=document.getElementById('chatLog');if(!log)return;
const quick=document.getElementById('chatQuick'),form=document.getElementById('chatForm'),input=document.getElementById('chatInput'),send=document.getElementById('chatSend'),reset=document.getElementById('chatReset');

const PLANS={
  konfigurator:{name:'Konfigurator-Plan',href:'konfigurator.html',cta:'Zum Konfigurator'},
  basis:{name:'Basis-Coaching',href:'#coaching',cta:'Coaching anfragen'},
  premium:{name:'Premium-Coaching',href:'#coaching',cta:'Coaching anfragen'}
};
const GREETING='Hallo, ich bin der Plan-Berater von LPP Sports, eine KI. Ich stelle dir ein paar kurze Fragen und sage dir dann, welche der drei Stufen zu dir passt. Wo stehst du gerade?';
const STARTERS=['Ich habe wenig Zeit','Ich sehe keine Ergebnisse','Ich weiß nicht, wo ich anfangen soll','Ich schaffe es kaum ins Training'];

let history=[];   // {role, content} für die KI
let busy=false;
let fallback=null; // Zustand der festen Fragen, sobald die KI nicht erreichbar ist

function bubble(text,who){
  const d=document.createElement('div');d.className='msg'+(who==='me'?' me':'');d.textContent=text;
  log.appendChild(d);log.scrollTop=log.scrollHeight;return d;
}
function setQuick(options,onPick){
  quick.replaceChildren();
  (options||[]).forEach(o=>{const b=document.createElement('button');b.type='button';b.className='chat-chip';b.textContent=o;b.addEventListener('click',()=>onPick(o));quick.appendChild(b)});
}
function lock(v){busy=v;input.disabled=v;send.disabled=v;quick.querySelectorAll('button').forEach(b=>b.disabled=v)}

function showRecommendation(key){
  const p=PLANS[key];if(!p)return;
  const box=document.createElement('div');box.className='chat-rec';
  const t=document.createElement('span');t.textContent='Unsere Empfehlung für dich';
  const n=document.createElement('b');n.textContent=p.name;
  const a=document.createElement('a');a.className='btn btn-primary';a.href=p.href;a.textContent=p.cta;
  box.append(t,n,a);log.appendChild(box);log.scrollTop=log.scrollHeight;
  setQuick([],()=>{});
}

function start(){
  history=[];fallback=null;busy=false;log.replaceChildren();
  bubble(GREETING,'bot');setQuick(STARTERS,text=>userSays(text));
  input.disabled=false;send.disabled=false;input.value='';
}

async function userSays(text){
  text=text.trim();if(!text||busy)return;
  bubble(text,'me');input.value='';
  if(fallback)return fallbackAnswer(text);
  history.push({role:'user',content:text});
  setQuick([],()=>{});lock(true);
  const typing=bubble('…','bot');typing.classList.add('typing');
  try{
    const captcha=await LPP.captcha.take();
    if(!captcha)throw new Error('offline');
    const r=await fetch('/api/berater',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,captcha})});
    if(r.status===429){typing.remove();bubble('Du hast viele Nachrichten geschickt. Bitte versuch es in ein paar Minuten noch einmal.','bot');history.pop();lock(false);return}
    if(!r.ok)throw new Error('offline');
    const j=await r.json();
    typing.remove();bubble(j.reply,'bot');
    history.push({role:'assistant',content:j.reply});
    lock(false);
    if(j.recommendation)showRecommendation(j.recommendation);
    else if(history.length>=23){bubble('Das Gespräch wird zu lang. Ich starte für dich neu.','bot');setTimeout(start,1500)}
    else input.focus();
  }catch{
    typing.remove();lock(false);startFallback();
  }
}

/* Feste Fragen, wenn die KI nicht erreichbar ist */
const FIXED=[
  {q:'Wie viel Erfahrung hast du mit Krafttraining?',o:[['Ich fange gerade an oder starte neu',1],['Ich trainiere schon länger',0]]},
  {q:'Wie zuverlässig kommst du aktuell zum Training?',o:[['Ich schaffe es kaum',2],['Mal ja, mal nein',1],['Ich bin regelmäßig dabei',0]]},
  {q:'Wie wichtig ist dir, dass jemand nachfragt und dich begleitet?',o:[['Das brauche ich',2],['Wäre schön',1],['Nicht nötig, ich treibe mich selbst an',0]]},
  {q:'Wie sicher bist du bei der Technik der Übungen?',o:[['Unsicher',2],['Es geht so',1],['Sicher',0]]}
];
function startFallback(){
  fallback={i:0,score:0};
  bubble('Der Chat-Assistent ist gerade nicht erreichbar. Ich stelle dir stattdessen vier feste Fragen.','bot');
  askFixed();
}
function askFixed(){
  const f=FIXED[fallback.i];bubble(f.q,'bot');
  setQuick(f.o.map(o=>o[0]),text=>userSays(text));
  input.disabled=true;send.disabled=true;
}
function fallbackAnswer(text){
  const f=FIXED[fallback.i],hit=f.o.find(o=>o[0]===text);
  if(!hit){bubble('Bitte wähle eine der Antworten oben aus.','bot');return}
  fallback.score+=hit[1];fallback.i++;
  if(fallback.i<FIXED.length)return askFixed();
  const s=fallback.score,key=s>=5?'premium':s>=2?'basis':'konfigurator';
  const why={
    premium:'Du brauchst Begleitung, um dranzubleiben, und Sicherheit bei der Technik. Genau dafür ist das Premium-Coaching gemacht.',
    basis:'Du kannst trainieren, profitierst aber von regelmäßigem Nachhaken und einem Plan, der mitwächst. Das bietet das Basis-Coaching.',
    konfigurator:'Du treibst dich selbst an und brauchst vor allem den passenden Plan. Der Konfigurator-Plan reicht dir.'
  }[key];
  bubble(why,'bot');showRecommendation(key);
}

form.addEventListener('submit',e=>{e.preventDefault();if(!fallback||!input.disabled)userSays(input.value)});
reset.addEventListener('click',start);
/* Captcha erst vorbereiten, wenn der Chat sichtbar wird (spart Aufwand für Besucher, die ihn nie öffnen) */
new IntersectionObserver((es,o)=>{if(es[0].isIntersecting){LPP.captcha.prime();o.disconnect()}},{threshold:.2}).observe(log);
start();
})();
