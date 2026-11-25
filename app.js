import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signInWithRedirect,
  createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,deleteUser} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,collection,collectionGroup,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,writeBatch}
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

'use strict';
const TRADES=[
  {id:'plumber',name:'سباك'},{id:'electric',name:'كهربائي'},{id:'mechanic',name:'ميكانيكي'},{id:'ac',name:'فني تكييف'},
  {id:'carpenter',name:'نجار'},{id:'welder',name:'حداد'},{id:'painter',name:'دهان'},{id:'appliance',name:'فني أجهزة'}
];
const HOODS=[
  {n:'العمارات',c:'الخرطوم'},{n:'الرياض',c:'الخرطوم'},{n:'بري',c:'الخرطوم'},{n:'الصحافة',c:'الخرطوم'},
  {n:'جبرة',c:'الخرطوم'},{n:'كافوري',c:'بحري'},{n:'الثورة',c:'أم درمان'},{n:'بانت',c:'أم درمان'}
];
const STEPS=['أُرسل الطلب','قبل الفني الطلب','تم العمل','تم الدفع','تم التقييم'];
const ORDER=['sent','accepted','done','paid','rated'];
const STATUS_TXT={sent:'بانتظار رد الفني',accepted:'قبل الفني الطلب',rejected:'اعتذر الفني',done:'بانتظار الدفع',paid:'بانتظار التقييم',rated:'مكتمل'};

/* line icons, 24px grid */
const IC={
  plumber:'<path d="M12 3c3.2 4.2 6 7.2 6 10.6a6 6 0 0 1-12 0C6 10.2 8.8 7.2 12 3z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2 2"/>',
  electric:'<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  mechanic:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  ac:'<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8 20.2 7.2"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  carpenter:'<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  welder:'<path d="M12 3c.8 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 2 .8 3 2 3 .5-3-1-6 1-9z"/>',
  painter:'<rect x="4" y="3" width="14" height="6" rx="1.5"/><path d="M18 6h2v5h-8v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>',
  appliance:'<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="13.5" r="4.5"/><path d="M8 6h.01M11 6h.01"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 11h6M9 15h6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  chev:'<path d="m15 6-6 6 6 6"/>'
};
const ico=(id,s=24,sw=1.7)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[id]}</svg>`;

const $=s=>document.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tradeName=id=>(TRADES.find(t=>t.id===id)||{name:''}).name;
const plural=n=>n===0?'لا يوجد فنيون حالياً':n===1?'فني واحد':n===2?'فنيان':n<=10?n+' فنيين':n+' فنياً';
const av=(name,lg)=>{name=String(name||'؟');return `<span class="av t${name.charCodeAt(0)%4}${lg?' lg':''}" aria-hidden="true">${esc(name[0])}</span>`};
function lsGet(k){try{const j=localStorage.getItem(k);return j?JSON.parse(j):null}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

const CONFIGURED=firebaseConfig&&firebaseConfig.apiKey&&!String(firebaseConfig.apiKey).startsWith('PASTE');
let auth=null,db=null;
let USER=null,PROFILE=null,READY=false,NOTE='';
const TERMS_V=3;
const SUPPORT_WA='249117102435'; /* رقم واتساب الدعم بصيغة دولية بدون + ، مثال: 249912345678 */
let D={techs:[],reviews:[],reqsC:[],reqsT:[],verifs:[],bans:[]};
let FEES={amount:0,bankak:''},WALLET=null;
let OWNPH=[],PHC={};
const SLOTS=['p1','p2','p3','p4','p5','p6'];
let ISADMIN=false,MYVREQ=false,ADM={users:[],reports:[],vreqs:[],reqs:[],wallets:[]};
const FEE=()=>+FEES.amount||0;
const BAL=()=>WALLET?(+WALLET.balance||0):0;
const money=n=>(+n||0).toLocaleString('ar-EG')+' جنيه';
let PRIV={};
let ROLE=lsGet('osta-role');
let F={hood:'all'},V={name:'boot'},AUTH={mode:'in',err:'',intent:''},PHOTOS=[];

const uid=()=>USER?USER.uid:null;
const isVerified=id=>D.verifs.some(v=>v.id===id);
const isBannedId=id=>D.bans.some(b=>b.id===id);
const isBanned=()=>!!USER&&isBannedId(USER.uid);
const vbadge=id=>isVerified(id)?'<span class="vbadge" title="موثق من الإدارة">✓ موثق</span>':'';
const here=()=>[V.name,{id:V.id,trade:V.trade}];
const REASONS={fraud:'احتيال أو طلب مال بطريقة مشبوهة',behavior:'إساءة أو سلوك غير لائق',quality:'عمل سيئ أو عدم التزام',info:'معلومات كاذبة في الملف',other:'سبب آخر'};
const dt=t=>t?new Date(t).toLocaleDateString('ar-EG'):'';
const waLink=p=>'https://wa.me/249'+String(p||'').replace(/^0/,'');
const techById=id=>D.techs.find(k=>k.id===id);
const myTech=()=>techById(uid());
const allReqs=()=>{const m=new Map();D.reqsC.concat(D.reqsT).forEach(r=>m.set(r.id,r));return [...m.values()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))};
const myReqs=()=>D.reqsC.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
const inbox=()=>D.reqsT.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

/* ratings come from the reviews collection */
function rateOf(k){
  const rs=D.reviews.filter(r=>r.techId===k.id);
  const n=rs.length;
  return {n,avg:n?rs.reduce((a,r)=>a+(+r.stars||0),0)/n:0};
}
function reviewsOf(k){
  return D.reviews.filter(r=>r.techId===k.id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
    .map(r=>({who:r.who||'عميل',stars:+r.stars||0,text:r.text||'بدون تعليق'}));
}

/* contact details live in a private document per request */
function priv(rid,who){
  const k=rid+'/'+who;
  if(!(k in PRIV)){
    PRIV[k]='loading';
    getDoc(doc(db,'requests',rid,'private',who))
      .then(s=>{PRIV[k]=s.exists()?s.data():null})
      .catch(()=>{PRIV[k]=null})
      .then(()=>{if(READY)onData()});
  }
  return PRIV[k];
}
const hasPriv=r=>r.status!=='sent'&&r.status!=='rejected';

async function run(fn){
  try{await fn();return true}
  catch(e){
    const c=e&&e.code;
    toast(c==='permission-denied'?'ما عندك صلاحية لهذا الإجراء':c==='unavailable'||c==='network-request-failed'?'تعذر الاتصال بالإنترنت':'تعذر الحفظ، حاول مرة ثانية');
    return false;
  }
}

/* ---------- session ---------- */
let unsubs=[],SESS=0;
function stopListen(){unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[]}
function route(){
  if(!PROFILE){go('profile');return}
  if(isBanned()){go('banned');return}
  if(PROFILE.termsV!==TERMS_V){go('accept');return}
  const nx=lsGet('osta-next');
  if(nx&&ROLE==='c'){lsSet('osta-next',null);if(nx.extra&&techById(nx.extra.id)){go(nx.name,nx.extra);return}}
  if(ROLE==='c')go('search');
  else if(ROLE==='t')go(myTech()?'tdash':'signupT');
  else go('welcome');
}
function startGuest(){
  stopListen();READY=false;NOTE='';OWNPH=[];PHC={};
  const my=++SESS;
  V={name:'boot'};render();
  const got=new Set(),NEED=4;
  const finish=()=>{if(!READY&&my===SESS){READY=true;go('search')}};
  const mark=k=>{got.add(k);if(!READY&&got.size>=NEED)finish();else if(READY)onData()};
  const rows=s=>s.docs.map(d=>Object.assign({id:d.id},d.data()));
  const fail=()=>{NOTE='تعذر تحميل القائمة. حاول مرة ثانية.'};
  setTimeout(()=>{if(!READY&&my===SESS){NOTE='تعذر الوصول لكل البيانات بعد.';finish()}},10000);
  unsubs.push(
    onSnapshot(collection(db,'techs'),s=>{D.techs=rows(s);mark('t')},e=>{fail();mark('t')}),
    onSnapshot(collectionGroup(db,'reviews'),s=>{D.reviews=s.docs.map(d=>Object.assign({id:d.id,techId:d.ref.parent.parent.id},d.data()));mark('v')},e=>{fail();mark('v')}),
    onSnapshot(collection(db,'verifications'),s=>{D.verifs=rows(s);mark('f')},e=>{fail();mark('f')}),
    onSnapshot(collection(db,'bans'),s=>{D.bans=rows(s);mark('b')},e=>{fail();mark('b')})
  );
}
async function startSession(){
  SESS++;
  stopListen();READY=false;NOTE='';PRIV={};ISADMIN=false;MYVREQ=false;FEES={amount:0,bankak:''};WALLET=null;ADM={users:[],reports:[],vreqs:[],reqs:[],wallets:[]};
  V={name:'boot'};render();
  const id=USER.uid,got=new Set(),NEED=9;
  const finish=()=>{if(!READY){READY=true;route()}};
  const mark=k=>{got.add(k);if(!READY&&got.size>=NEED)finish();else if(READY)onData()};
  const upd=()=>{if(READY)onData()};
  const rows=s=>s.docs.map(d=>Object.assign({id:d.id},d.data()));
  const fail=e=>{NOTE=e&&e.code==='permission-denied'?'ما عندك صلاحية لقراءة بعض البيانات.':'تعذر تحميل البيانات. قد تكون القائمة قديمة.'};
  setTimeout(()=>{if(!READY){NOTE='تعذر الوصول لكل البيانات بعد. قد تكون القائمة قديمة.';finish()}},10000);
  try{const s=await getDoc(doc(db,'users',id));PROFILE=s.exists()?s.data():null}catch(e){fail(e)}
  try{ISADMIN=(await getDoc(doc(db,'admins',id))).exists()}catch(e){ISADMIN=false}
  unsubs.push(
    onSnapshot(collection(db,'techs'),s=>{D.techs=rows(s);mark('t')},e=>{fail(e);mark('t')}),
    onSnapshot(collectionGroup(db,'reviews'),s=>{D.reviews=s.docs.map(d=>Object.assign({id:d.id,techId:d.ref.parent.parent.id},d.data()));mark('v')},e=>{fail(e);mark('v')}),
    onSnapshot(query(collection(db,'requests'),where('customerId','==',id)),s=>{const nx=rows(s);alertStatus(D.reqsC,nx);D.reqsC=nx;mark('c')},e=>{fail(e);mark('c')}),
    onSnapshot(query(collection(db,'requests'),where('techId','==',id)),s=>{const nx=rows(s);alertNew(D.reqsT,nx);D.reqsT=nx;mark('k')},e=>{fail(e);mark('k')}),
    onSnapshot(collection(db,'verifications'),s=>{D.verifs=rows(s);mark('f')},e=>{fail(e);mark('f')}),
    onSnapshot(collection(db,'bans'),s=>{D.bans=rows(s);mark('b')},e=>{fail(e);mark('b')}),
    onSnapshot(doc(db,'verifyRequests',id),s=>{MYVREQ=s.exists();mark('m')},e=>{mark('m')}),
    onSnapshot(doc(db,'settings','fees'),s=>{FEES=Object.assign({amount:0,bankak:''},s.exists()?s.data():{});mark('s')},e=>{mark('s')}),
    onSnapshot(doc(db,'wallets',id),s=>{WALLET=s.exists()?s.data():null;mark('w')},e=>{mark('w')}),
    onSnapshot(collection(db,'techs',id,'photos'),s=>{OWNPH=rows(s).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));upd()},e=>{})
  );
  if(ISADMIN)unsubs.push(
    onSnapshot(collection(db,'users'),s=>{ADM.users=rows(s);upd()},fail),
    onSnapshot(collection(db,'reports'),s=>{ADM.reports=rows(s);upd()},fail),
    onSnapshot(collection(db,'verifyRequests'),s=>{ADM.vreqs=rows(s);upd()},fail),
    onSnapshot(collection(db,'requests'),s=>{ADM.reqs=rows(s);upd()},fail),
    onSnapshot(collection(db,'wallets'),s=>{ADM.wallets=rows(s);upd()},fail)
  );
}
/* ---------- photos (stored as small compressed images in Firestore) ---------- */
function photosOf(id){
  if(!(id in PHC)){
    PHC[id]='loading';
    getDocs(collection(db,'techs',id,'photos'))
      .then(sn=>{PHC[id]=sn.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))})
      .catch(()=>{PHC[id]=[]})
      .then(()=>{if(READY&&V.name==='tech'&&V.id===id)render()});
  }
  return PHC[id];
}
function shrink(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let side=800,q=.7;
      for(let i=0;i<6;i++){
        const sc=Math.min(1,side/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*sc));c.height=Math.max(1,Math.round(img.height*sc));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        const d=c.toDataURL('image/jpeg',q);
        if(d.length<=240000)return res(d);
        q=Math.max(.35,q-.1);if(i===2)side=600;
      }
      rej(new Error('big'));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('bad'))};
    img.src=url;
  });
}
async function uploadPhotos(files){
  const free=SLOTS.filter(x=>!OWNPH.some(p=>p.id===x));
  files=files.slice(0,free.length);
  if(!files.length){toast('وصلت للحد الأقصى: 6 صور');return}
  toast('جارٍ رفع الصور');
  let n=0,done=0;
  for(const f of files){
    const data=await shrink(f).catch(()=>null);
    if(!data){toast('تعذر قراءة إحدى الصور');continue}
    const ok=await run(()=>setDoc(doc(db,'techs',uid(),'photos',free[n++]),{data,createdAt:Date.now()}));
    if(!ok)break;
    done++;
  }
  if(done)toast(done===1?'تمت إضافة الصورة':'تمت إضافة '+done+' صور');
}
const zoomEl=document.createElement('div');
zoomEl.id='zoom';zoomEl.hidden=true;zoomEl.innerHTML='<img alt="">';
document.body.appendChild(zoomEl);
zoomEl.addEventListener('click',()=>{zoomEl.hidden=true});

/* ---------- alerts (free, in-app) ---------- */
function ping(msg){
  toast(msg);
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}
  try{const A=new (window.AudioContext||window.webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.connect(g);g.connect(A.destination);o.frequency.value=880;g.gain.value=.08;o.start();setTimeout(()=>{o.stop();A.close()},250)}catch(e){}
  try{if(document.hidden&&window.Notification&&Notification.permission==='granted'&&navigator.serviceWorker)navigator.serviceWorker.getRegistration().then(r=>r&&r.showNotification('أسطى',{body:msg,icon:'icon-192.png',badge:'icon-192.png'}))}catch(e){}
}
function alertNew(old,nx){
  if(!READY)return;
  const had=new Set(old.map(r=>r.id));
  const n=nx.filter(r=>r.status==='sent'&&!had.has(r.id)).length;
  if(n)ping(n===1?'وصلك طلب جديد':'وصلتك '+n+' طلبات جديدة');
}
function alertStatus(old,nx){
  if(!READY)return;
  const m=new Map(old.map(r=>[r.id,r.status]));
  for(const r of nx){
    const prev=m.get(r.id);
    if(prev&&prev!==r.status){
      const k=techById(r.techId),nm=k?k.name:'الفني';
      const t={accepted:'قبل '+nm+' طلبك',rejected:'اعتذر '+nm+' عن طلبك',done:nm+' أنهى العمل وبانتظار الدفع'}[r.status];
      if(t){ping(t);break}
    }
  }
}
function setBadge(){
  const n=D.reqsT.filter(r=>r.status==='sent').length;
  document.title=n?'('+n+') أسطى':'أسطى';
  try{if(navigator.setAppBadge){n?navigator.setAppBadge(n):navigator.clearAppBadge()}}catch(e){}
}

function onData(){
  if(!READY)return;
  setBadge();
  const v=V.name;
  if(['boot','login','setup','profile','signupC','signupT','request','accept','report','terms','account'].includes(v))return;
  if(v==='req'){
    const r=allReqs().find(x=>x.id===V.id);
    if(r&&V.sig===sigOf(r))return;
  }
  render();
}
const sigOf=r=>[r.status,typeof PRIV[r.id+'/tech'],typeof PRIV[r.id+'/customer']].join('|');

function go(name,extra){V=Object.assign({name},extra||{});render();window.scrollTo(0,0)}
function toast(msg){const t=$('#toast');t.querySelector('span').textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}
const stars=r=>`<span class="stars" role="img" aria-label="${r.toFixed(1)} من 5"><span class="st-bg">★★★★★</span><span class="st-fg" style="width:${(r/5*100).toFixed(0)}%">★★★★★</span></span>`;
const hoodOpts=sel=>HOODS.map(h=>`<option value="${h.n}" ${sel===h.n?'selected':''}>${h.n} (${h.c})</option>`).join('');
const tradeOpts=sel=>TRADES.map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${t.name}</option>`).join('');
const ratingLine=k=>{const r=rateOf(k);return r.n?`${stars(r.avg)} <span class="small">${r.avg.toFixed(1)}</span> <span class="muted small">(${r.n})</span>`:'<span class="pill good">جديد</span>'};
const pool=()=>D.techs.filter(k=>k.id!==uid()&&!isBannedId(k.id));

/* ---------- views ---------- */
const heroHtml=`<section class="hero">
  <span class="eyebrow">الخرطوم · بحري · أم درمان</span>
  <h1>اعثر على فني موثوق في الخرطوم</h1>
  <p>سباك، كهربائي، ميكانيكي وغيرهم. اختر الفني، اتفق معه على السعر، وقيّم العمل بعد الإنجاز.</p>
  <span class="bg-ic" aria-hidden="true">${ico('mechanic',230,1.2)}</span>
</section>`;

let INSTALL=null;
const isInstalled=()=>window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();INSTALL=e;if(['welcome','login'].includes(V.name))render()});
window.addEventListener('appinstalled',()=>{INSTALL=null;toast('تم تثبيت أسطى على جوالك');if(['welcome','login'].includes(V.name))render()});
const installCard=()=>INSTALL&&!isInstalled()?`<section class="card"><h3>ثبّت أسطى على جوالك</h3><p class="muted small">يظهر كتطبيق على الشاشة الرئيسية ويفتح بسرعة بدون المتصفح.</p><button class="btn pri block" data-act="install">تثبيت التطبيق</button></section>`:'';

function vBoot(){return `<div class="skel"></div><div class="skel"></div><div class="skel"></div><p class="note">جارٍ التحميل</p>`}

function vSetup(){return `<div class="card"><h2>الربط مع Firebase لم يكتمل</h2>
<p>افتح الملف <b style="direction:ltr;unicode-bidi:isolate">firebase-config.js</b> والصق فيه إعدادات مشروعك بدل الكلمات التي تبدأ بـ PASTE، ثم أعد رفع الملفات.</p>
<p class="muted small">الخطوات كاملة في ملف دليل-النشر.md.</p></div>`}

function vLogin(){
  const up=AUTH.mode==='up';
  return `${heroHtml}${installCard()}
<section class="card">
  ${AUTH.intent==='c'?'<p class="banner">سجّل دخولك لإرسال طلبك للفني.</p>':AUTH.intent==='t'?'<p class="banner">أنشئ حساباً لتسجّل كفني وتستقبل الطلبات.</p>':''}
  <h2>${up?'إنشاء حساب':'تسجيل الدخول'}</h2>
  <button class="btn sec block google" data-act="google">المتابعة بحساب جوجل</button>
  <p class="note">أو بالإيميل</p>
  <form data-form="auth">
    <label class="f">الإيميل<input type="email" name="email" required autocomplete="email" inputmode="email" dir="ltr"></label>
    <label class="f">كلمة السر<input type="password" name="password" required minlength="6" autocomplete="${up?'new-password':'current-password'}" dir="ltr"></label>
    ${AUTH.err?`<div class="errmsg" role="alert">${esc(AUTH.err)}</div>`:''}
    <button class="btn pri block" type="submit">${up?'إنشاء الحساب':'دخول'}</button>
  </form>
  <div class="row between">
    <button class="linkbtn" data-act="toggle-auth">${up?'عندي حساب. تسجيل الدخول':'ما عندي حساب. إنشاء حساب'}</button>
    ${up?'':'<button class="linkbtn" data-act="reset">نسيت كلمة السر؟</button>'}
  </div>
</section>
<p class="note">إذا فتحت الرابط من داخل واتساب أو فيسبوك وما اشتغل دخول جوجل، افتحه في متصفح كروم.</p>`}

function vProfile(){return `
<h2>أكمل بياناتك</h2>
<form data-form="profile" class="card">
  <label class="f">الاسم<input type="text" name="name" required autocomplete="name" value="${esc((USER&&USER.displayName)||'')}" placeholder="مثال: أحمد محمد"></label>
  <label class="f">رقم الهاتف<input type="tel" name="phone" required inputmode="tel" pattern="0[19][0-9]{8}" title="رقم سوداني من 10 أرقام يبدأ بـ 09 أو 01" placeholder="09XXXXXXXX"></label>
  <p class="muted small">رقمك يصل للفني فقط بعد ما يقبل طلبك.</p>
  <label class="chk"><input type="checkbox" name="agree" required><span>قرأت <button type="button" class="linkbtn" data-act="terms">شروط الاستخدام وسياسة الخصوصية</button> وأوافق عليها</span></label>
  <button class="btn pri block" type="submit">حفظ ومتابعة</button>
</form>`}

function vWelcome(){return `${heroHtml}${installCard()}
<div class="stack">
  <button class="btn pri block" data-act="role-c">أحتاج إلى فني</button>
  <button class="btn sec block" data-act="role-t">أنا فني وأبحث عن عمل</button>
</div>
<section class="card">
  <h3>المهن المتوفرة</h3>
  <div class="kit">${TRADES.map(t=>`<div class="kit-i"><span class="ico">${ico(t.id,23)}</span><span>${t.name}</span></div>`).join('')}</div>
</section>
<section class="card how">
  <h3>كيف يعمل</h3>
  <ol>
    <li><span class="n">1</span><span>اختر الفني حسب المهنة والحي، وشوف تقييمات العملاء قبله.</span></li>
    <li><span class="n">2</span><span>أرسل طلبك واتفق مع الفني على السعر بعد المعاينة.</span></li>
    <li><span class="n">3</span><span>ادفع كاش أو عبر بنكك، ثم قيّم العمل.</span></li>
  </ol>
</section>`}

function vSignupT(){
  const m=PROFILE||{};
  return `
<h2>حساب فني جديد</h2>
<form data-form="signupT" class="card">
  <label class="f">الاسم<input type="text" name="name" required autocomplete="name" value="${esc(m.name||'')}"></label>
  <label class="f">المهنة<select name="trade">${tradeOpts('plumber')}</select></label>
  <label class="f">الحي<select name="hood">${hoodOpts('العمارات')}</select></label>
  <label class="f">سنوات الخبرة<input type="number" name="years" min="0" max="60" value="3" required inputmode="numeric"></label>
  <label class="f">نبذة عن خبرتك<textarea name="bio" required maxlength="400" placeholder="ما الأعمال التي تجيدها؟"></textarea></label>
  <label class="f">رقم حسابك في بنكك (اختياري)<input type="text" name="bankak" inputmode="numeric" value="${esc(m.bankak||'')}" placeholder="لاستلام التحويلات"></label>
  <p class="muted small">هاتفك (${esc(m.phone||'')}) ورقم بنكك يصلان للعميل فقط بعد ما تقبل طلبه.</p>
  <button class="btn pri block" type="submit">إنشاء ملفي</button>
</form>`}

function vSearch(){
  const all=pool();
  const tiles=TRADES.map(t=>{
    const n=all.filter(k=>k.trade===t.id&&(F.hood==='all'||k.hood===F.hood)).length;
    return `<button class="tile" data-act="trade" data-id="${t.id}"><span class="ico">${ico(t.id,24)}</span><span><span class="tn">${t.name}</span><br><span class="tc">${plural(n)}</span></span></button>`;
  }).join('');
  const first=PROFILE&&PROFILE.name?String(PROFILE.name).split(' ')[0]:'بك';
  return `
${USER?`<div><div class="muted">أهلاً ${esc(first)}</div><h2>ماذا تحتاج اليوم؟</h2></div>`:heroHtml+installCard()}
${!all.length?`<div class="card"><h3>لا يوجد فنيون مسجلون بعد</h3><p class="muted">سيظهرون هنا فور تسجيلهم.</p></div>`:''}
<label class="f">الحي<select id="hood"><option value="all">كل الأحياء</option>${hoodOpts(F.hood)}</select></label>
<div class="tiles">${tiles}</div>
${USER?'':`<section class="card"><h3>هل أنت فني؟</h3><p class="muted small">سجّل في أسطى واستقبل طلبات العملاء في الخرطوم.</p><button class="btn pri block" data-act="guest-tech">سجّل كفني</button><button class="linkbtn" data-act="login">عندي حساب. تسجيل الدخول</button></section>`}`}

function techCard(k){return `
<button class="tcard" data-act="tech" data-id="${esc(k.id)}">
  ${av(k.name)}
  <span class="info">
    <b>${esc(k.name)}${vbadge(k.id)}</b>
    <span class="meta">${ico(k.trade,15)}<span>${tradeName(k.trade)} · ${esc(k.hood)}</span></span>
    <span>${ratingLine(k)}${k.avail===false?' <span class="pill warn">غير متاح حالياً</span>':''}</span>
  </span>
  <span class="chev">${ico('chev',20)}</span>
</button>`}

function vTechs(){
  const list=pool().filter(k=>k.trade===V.trade&&(F.hood==='all'||k.hood===F.hood)).sort((a,b)=>rateOf(b).avg-rateOf(a).avg);
  const hoodTxt=F.hood==='all'?'كل الأحياء':F.hood;
  return `
<div><h2>${tradeName(V.trade)}</h2><div class="muted">${hoodTxt}، الأعلى تقييماً أولاً</div></div>
${list.length?list.map(techCard).join(''):`<div class="empty"><p>لا يوجد ${tradeName(V.trade)} في هذا الحي حالياً.</p>${F.hood!=='all'?'<button class="btn sec" data-act="allhoods">عرض كل الأحياء</button>':''}</div>`}`}

function vTech(){
  const k=techById(V.id),r=rateOf(k),revs=reviewsOf(k);
  return `
<div class="card">
  <div class="row">${av(k.name,true)}
    <div><h2>${esc(k.name)}</h2>${vbadge(k.id)}<div class="muted">${tradeName(k.trade)} · ${esc(k.hood)}</div></div></div>
  <div class="stats">
    <div><b>${r.n?r.avg.toFixed(1):'جديد'}</b><span>التقييم</span></div>
    <div><b>${r.n}</b><span>عدد التقييمات</span></div>
    <div><b>${esc(k.years)}</b><span>سنوات الخبرة</span></div>
  </div>
  <p>${esc(k.bio)}</p>
  <p class="muted small">السعر يُتفق عليه مع الفني بعد معاينة العمل.</p>
</div>
${(()=>{const ph=photosOf(k.id);return Array.isArray(ph)&&ph.length?`<h3>صور من أعماله</h3><div class="card"><div class="ph">${ph.map(x=>`<div class="phw"><button class="phb" data-act="zoom" aria-label="تكبير الصورة"><img src="${x.data}" alt="من أعمال ${esc(k.name)}" loading="lazy"></button>${ISADMIN?`<button class="phx" data-act="a-delphoto" data-id="${esc(k.id)}" data-slot="${esc(x.id)}" aria-label="حذف الصورة">×</button>`:''}</div>`).join('')}</div></div>`:''})()}
<h3>تقييمات العملاء</h3>
<div class="card">${revs.length?revs.map(x=>`<div class="rev"><div class="row between"><b>${esc(x.who)}</b>${stars(x.stars)}</div><p>${esc(x.text)}</p></div>`).join(''):'<p class="muted">لا توجد تقييمات بعد.</p>'}</div>
${USER?`<button class="linkbtn" data-act="report" data-id="${esc(k.id)}" data-name="${esc(k.name)}">الإبلاغ عن هذا الفني</button>`:''}`}

function vRequest(){
  const k=techById(V.id);
  const hd=F.hood!=='all'?F.hood:k.hood;
  return `
<h2>طلب خدمة من ${esc(k.name)}</h2>
<form data-form="request" class="card">
  <label class="f">وصف المشكلة<textarea name="desc" required minlength="5" maxlength="500" placeholder="مثال: تسريب مياه تحت حوض المطبخ"></textarea></label>
  <label class="f">الحي<select name="hood">${hoodOpts(hd)}</select></label>
  <fieldset><legend>متى تحتاج الفني؟</legend>
    <div class="chips">
      <label class="chip"><input type="radio" name="when" value="الآن" checked><span>الآن</span></label>
      <label class="chip"><input type="radio" name="when" value="اليوم"><span>اليوم</span></label>
      <label class="chip"><input type="radio" name="when" value="غداً"><span>غداً</span></label>
    </div></fieldset>
  <fieldset><legend>طريقة الدفع</legend>
    <div class="opts">
      <label class="chip"><input type="radio" name="pay" value="كاش" checked><span>كاش بعد إنجاز العمل</span></label>
      <label class="chip"><input type="radio" name="pay" value="بنكك"><span>تحويل عبر بنكك</span></label>
    </div></fieldset>
  <button class="btn pri block" type="submit">إرسال الطلب</button>
  <p class="muted small">سيتواصل معك الفني على ${esc(PROFILE.phone)} بعد قبول الطلب.</p>
</form>`}

function vReqs(){
  const mine=myReqs();
  if(!mine.length)return `<h2>طلباتي</h2><div class="empty"><p>لم ترسل أي طلب بعد.</p><button class="btn pri" data-act="home">ابحث عن فني</button></div>`;
  return `<h2>طلباتي</h2>`+mine.map(r=>{
    const k=techById(r.techId)||{name:'فني',trade:'mechanic'};
    return `<button class="tcard" data-act="req" data-id="${esc(r.id)}">
      ${av(k.name)}
      <span class="info"><b>${esc(k.name)}</b><span class="meta">${ico(k.trade,15)}<span>${tradeName(k.trade)}</span></span><span class="muted small">${esc(r.desc)}</span>
      <span><span class="pill ${r.status==='rated'?'good':r.status==='done'||r.status==='paid'||r.status==='rejected'?'warn':''}">${STATUS_TXT[r.status]||''}</span></span></span>
      <span class="chev">${ico('chev',20)}</span></button>`;
  }).join('')}

function vReq(){
  const r=D.reqsC.find(x=>x.id===V.id),k=techById(r.techId)||{name:'فني',trade:'mechanic'};
  const tp=hasPriv(r)?priv(r.id,'tech'):null;
  V.sig=sigOf(r);
  const idx=ORDER.indexOf(r.status);
  const tl=STEPS.map((s,i)=>`<li class="${i<idx?'done':i===idx?'now':''}">${s}</li>`).join('');
  let panel='';
  if(r.status==='sent')panel=`<p>أرسلنا طلبك إلى ${esc(k.name)}. ستتحدث الحالة هنا عندما يرد، ويصلك تنبيه وأنت فاتح التطبيق.</p><p class="muted small">إذا تأخر الرد كثيراً تقدر ترجع وتختار فنياً آخر.</p>`;
  else if(r.status==='rejected')panel=`<p>اعتذر ${esc(k.name)} عن هذا الطلب. تقدر تختار فنياً آخر.</p><button class="btn pri block" data-act="home">ابحث عن فني آخر</button>`;
  else if(r.status==='accepted')panel=`<p>قبل ${esc(k.name)} طلبك. تواصل معه لتتفقوا على الموعد والسعر.</p>
    ${tp&&tp!=='loading'&&tp.phone?`<div class="acct"><div><div class="muted small">هاتف الفني</div><b id="tphone">${esc(tp.phone)}</b></div><button class="btn sec" data-act="copy" data-t="#tphone">نسخ</button></div><a class="btn sec block" href="${waLink(tp.phone)}" target="_blank" rel="noopener">مراسلة الفني على واتساب</a>`:''}`;
  else if(r.status==='done'){
    if(r.pay==='كاش')panel=`<h3>الدفع</h3><p>تأكد من إنجاز العمل ثم ادفع للفني نقداً المبلغ المتفق عليه.</p>
      <button class="btn pri block" data-act="pay-cash" data-id="${esc(r.id)}">دفعت نقداً</button>`;
    else panel=`<h3>الدفع عبر بنكك</h3><p>حوّل المبلغ المتفق عليه إلى حساب الفني، ثم ارفع صورة إشعار التحويل.</p>
      ${tp&&tp!=='loading'&&tp.bankak?`<div class="acct"><div><div class="muted small">حساب ${esc(k.name)}</div><b id="acct">${esc(tp.bankak)}</b></div><button class="btn sec" data-act="copy" data-t="#acct">نسخ</button></div>`:'<p class="banner">لم يضف الفني رقم حسابه. تواصل معه لتأخذ الرقم.</p>'}
      <div class="filebox"><label for="receipt" class="muted small">صورة إشعار التحويل</label><input type="file" id="receipt" accept="image/*"><span id="recName" class="small muted">لم يتم اختيار صورة</span></div>
      <button class="btn pri block" id="payBank" data-act="pay-bank" data-id="${esc(r.id)}" disabled>أكدت التحويل</button>
      <p class="muted small">الصورة تبقى عندك للتأكيد ولا تُرفع. الدفع المباشر داخل التطبيق يحتاج اتفاقية مع مزود الخدمة، وسنضيفه لاحقاً.</p>`;
  }
  else if(r.status==='paid')panel=`<h3>كيف كان العمل؟</h3>
    <div class="rate" role="radiogroup" aria-label="التقييم">${[1,2,3,4,5].map(n=>`<button class="rbtn" type="button" data-act="rate" data-n="${n}" aria-label="${n} من 5">★</button>`).join('')}</div>
    <label class="f">تعليقك (اختياري)<textarea id="comment" maxlength="300" placeholder="ما الذي أعجبك أو لم يعجبك؟"></textarea></label>
    <button class="btn pri block" id="sendRate" data-act="send-rate" data-id="${esc(r.id)}" disabled>إرسال التقييم</button>`;
  else panel=`<p>شكراً لتقييمك.</p><p>${stars(+r.stars||0)}</p>${r.comment?`<p class="muted">${esc(r.comment)}</p>`:''}`;
  return `
<div class="card">
  <div class="row">${av(k.name)}<div><h3>${esc(k.name)}</h3><div class="muted small">${tradeName(k.trade)} · ${esc(r.hood)} · ${esc(r.when)} · دفع ${esc(r.pay)}</div></div></div>
  <p>${esc(r.desc)}</p>
</div>
${r.status==='rejected'?'':`<div class="card"><ol class="tl">${tl}</ol></div>`}
<div class="card">${panel}</div>
<button class="linkbtn" data-act="report" data-id="${esc(r.techId)}" data-name="${esc(k.name)}" data-rid="${esc(r.id)}">الإبلاغ عن هذا الفني</button>`}

function trCard(r){
  const cp=hasPriv(r)?priv(r.id,'customer'):null;
  const pills={
    accepted:'<span class="pill good">قبلت الطلب</span>',
    rejected:'<span class="pill">رفضت الطلب</span>',
    done:'<span class="pill warn">بانتظار دفع العميل</span>',
    paid:'<span class="pill good">دفع العميل</span>',
    rated:`<span class="pill good">مكتمل</span> ${stars(+r.stars||0)}`
  };
  let act='';
  if(r.status==='sent'){
    const f=FEE(),short=f>0&&BAL()<f;
    act=short?`<p class="banner">رصيدك لا يكفي لقبول الطلب (الرسوم ${money(f)}). اشحن رصيدك من أعلى الصفحة.</p><button class="btn sec block" data-act="t-reject" data-id="${esc(r.id)}">رفض</button>`
      :`<div class="row"><button class="btn pri grow" data-act="t-accept" data-id="${esc(r.id)}">قبول${f>0?' ('+money(f)+')':''}</button><button class="btn sec grow" data-act="t-reject" data-id="${esc(r.id)}">رفض</button></div>`;
  }
  if(r.status==='accepted')act=`<button class="btn pri block" data-act="t-done" data-id="${esc(r.id)}">تم إنجاز العمل</button>`;
  return `<article class="card">
    <div class="row"><div class="row">${av(r.customerName)}<b>${esc(r.customerName)}</b></div></div>
    <p>${esc(r.desc)}</p>
    <div class="muted small">${esc(r.hood)} · ${esc(r.when)} · دفع ${esc(r.pay)}</div>
    ${cp&&cp!=='loading'&&cp.phone?`<div class="small">هاتف العميل: <b style="direction:ltr;unicode-bidi:isolate">${esc(cp.phone)}</b></div><a class="btn sec block" href="${waLink(cp.phone)}" target="_blank" rel="noopener">مراسلة العميل على واتساب</a>`:''}
    ${pills[r.status]?`<div>${pills[r.status]}</div>`:''}${act}
    <button class="linkbtn" data-act="report" data-id="${esc(r.customerId)}" data-name="${esc(r.customerName)}" data-rid="${esc(r.id)}">الإبلاغ عن هذا العميل</button></article>`}

function walletCard(m){
  const f=FEE();
  if(!f&&!WALLET)return '';
  const low=f>0&&BAL()<f;
  return `<div class="card"><div class="row between"><h3>رصيدي</h3><b>${money(BAL())}</b></div>
  ${f>0?`<p class="muted small">يُخصم ${money(f)} من رصيدك عند قبول كل طلب. الرسوم لا تُسترد بعد القبول.</p>`:''}
  ${low?'<p class="banner">رصيدك لا يكفي لقبول طلبات جديدة. اشحن رصيدك.</p>':''}
  ${f>0?`<details><summary>كيف أشحن رصيدي؟</summary>
    <p>1) حوّل المبلغ عبر بنكك إلى الحساب: <b class="ltr">${esc(FEES.bankak||'يحدده الدعم')}</b></p>
    <p>2) أرسل صورة إشعار التحويل على واتساب الدعم، ونضيف الرصيد.</p>
    <a class="btn sec block" href="https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent('أرغب بشحن رصيدي في أسطى. الاسم: '+m.name+'، الهاتف: '+PROFILE.phone)}" target="_blank" rel="noopener">إرسال الإشعار على واتساب</a></details>`:''}
  </div>`}

function vTDash(){
  const m=myTech(),box=inbox();
  const n=box.filter(r=>r.status==='sent').length,on=m.avail!==false;
  return `
<div class="card">
  <div class="row between"><div><div class="muted">مرحباً</div><h2>${esc(m.name)}</h2>${vbadge(m.id)}<div class="muted">${tradeName(m.trade)} · ${esc(m.hood)}</div></div>
  <button class="toggle" data-act="avail" aria-pressed="${on}">${on?'متاح للعمل':'غير متاح'}</button></div>
</div>
${walletCard(m)}
${window.Notification&&Notification.permission==='default'?'<div class="card"><h3>فعّل التنبيهات</h3><p class="muted small">يصلك تنبيه بالطلبات الجديدة وصوت واهتزاز وأنت فاتح التطبيق، أو وهو في الخلفية.</p><button class="btn pri block" data-act="notif">تفعيل التنبيهات</button></div>':''}
<div class="row between"><h3>الطلبات</h3>${n?`<span class="pill good">${n} جديد</span>`:''}</div>
${box.length?box.map(trCard).join(''):'<div class="empty"><p>لا توجد طلبات بعد. ستظهر هنا فور وصولها.</p></div>'}`}

function vTProfile(){
  const m=myTech(),r=rateOf(m),revs=reviewsOf(m);
  const photos=OWNPH.length?`<div class="ph">${OWNPH.map(x=>`<div class="phw"><button class="phb" data-act="zoom" aria-label="تكبير الصورة"><img src="${x.data}" alt="من أعمال ${esc(m.name)}"></button><button class="phx" data-act="delphoto" data-id="${esc(x.id)}" aria-label="حذف الصورة">×</button></div>`).join('')}</div>`:`<p class="muted">لم تضف صوراً بعد. الصور تزيد ثقة العملاء بك.</p>`;
  return `
<div class="card">
  <div class="row">${av(m.name,true)}<div><h2>${esc(m.name)}</h2>${vbadge(m.id)}<div class="muted">${tradeName(m.trade)} · ${esc(m.hood)}</div></div></div>
  <div class="stats">
    <div><b>${r.n?r.avg.toFixed(1):'جديد'}</b><span>التقييم</span></div>
    <div><b>${r.n}</b><span>عدد التقييمات</span></div>
    <div><b>${esc(m.years)}</b><span>سنوات الخبرة</span></div>
  </div>
  <p>${esc(m.bio)}</p>
  <div class="muted small">هاتف ${esc(PROFILE.phone)}${PROFILE.bankak?' · بنكك '+esc(PROFILE.bankak):''}</div>
</div>
<h3>التوثيق</h3>
<div class="card">${isVerified(m.id)?'<p><span class="vbadge">✓ موثق</span> حسابك موثق، وتظهر الشارة للعملاء بجانب اسمك.</p>':MYVREQ?'<p>طلب التوثيق قيد المراجعة. ستتواصل معك الإدارة على هاتفك.</p>':'<p>الحساب الموثق يحصل على ثقة أكبر وطلبات أكثر. تتواصل معك الإدارة على هاتفك للتحقق من هويتك وخبرتك.</p><button class="btn pri block" data-act="vreq">اطلب توثيق حسابي</button>'}</div>
<h3>صور أعمالي</h3>
<div class="card">${photos}
  ${OWNPH.length<SLOTS.length?`<label class="btn sec" for="photo">إضافة صور</label><input type="file" id="photo" accept="image/*" multiple hidden>`:'<p class="muted small">وصلت للحد الأقصى (6 صور). احذف صورة لإضافة غيرها.</p>'}
  <p class="muted small">تظهر الصور لكل زوار التطبيق على صفحتك. أضف حتى 6 صور واضحة لأعمالك.</p>
</div>
<h3>تقييمات العملاء</h3>
<div class="card">${revs.length?revs.map(x=>`<div class="rev"><div class="row between"><b>${esc(x.who)}</b>${stars(x.stars)}</div><p>${esc(x.text)}</p></div>`).join(''):`<p class="muted">لا توجد تقييمات بعد. ستظهر هنا بعد أول عمل.</p>`}</div>`}


const supportLink=()=>SUPPORT_WA?`<a class="btn sec block" href="https://wa.me/${SUPPORT_WA}" target="_blank" rel="noopener">تواصل مع الدعم عبر واتساب</a>`:'';
function vBanned(){return `<section class="card"><h2>تم إيقاف حسابك</h2>
<p>أوقفت الإدارة هذا الحساب لمخالفة شروط الاستخدام، ولا يمكنك إرسال الطلبات أو استقبالها حالياً.</p>
<p class="muted small">${SUPPORT_WA?'إذا تعتقد أن الإيقاف حدث بالخطأ، تواصل مع الدعم.':'إذا تعتقد أن الإيقاف حدث بالخطأ، تواصل مع إدارة أسطى.'}</p>
${supportLink()}<button class="btn sec block" data-act="account">حسابي وحذفه</button></section>`}

function vAccept(){return `<h2>شروط الاستخدام</h2>
<form data-form="accept" class="card">
  <p>قبل المتابعة، اقرأ شروط الاستخدام وسياسة الخصوصية لأسطى ووافق عليها.</p>
  <label class="chk"><input type="checkbox" name="agree" required><span>قرأت <button type="button" class="linkbtn" data-act="terms">الشروط وسياسة الخصوصية</button> وأوافق عليها</span></label>
  <button class="btn pri block" type="submit">موافق ومتابعة</button>
</form>`}

function vTerms(){return `<h2>الشروط والخصوصية</h2>
<section class="card terms">
<details open><summary>شروط الاستخدام</summary><ol>
<li>أسطى منصة تعرّف العملاء بالفنيين فقط. ليس طرفاً في الاتفاق بين العميل والفني، ولا يضمن جودة العمل ولا السعر ولا الالتزام بالموعد.</li>
<li>الفنيون يعملون لحسابهم الخاص وليسوا موظفين عند أسطى. الفني مسؤول عن عمله وعن أي ضرر ينتج عنه.</li>
<li>السعر يُتفق عليه بين العميل والفني. الدفع نقداً أو بتحويل بنكك يتم بينهما مباشرة، ولا يأخذ أسطى أي مبلغ من العميل.</li>
<li>رسوم الفنيين: قد تُخصم من رصيد الفني رسوم خدمة ثابتة عن كل طلب يقبله. تحددها الإدارة وتظهر للفني في صفحته قبل القبول. لا تُسترد بعد قبول الطلب إلا بقرار من الإدارة. شحن الرصيد يتم بتحويل بنكك وتأكيد الإدارة.</li>
<li>شارة «موثق» تعني أن الإدارة تواصلت مع الفني وتحققت من هويته وخبرته حسب ما قدمه. لا تعني ضماناً لجودة أي عمل.</li>
<li>يُمنع: تقديم معلومات كاذبة، الاحتيال، الإساءة والتهديد، كتابة تقييمات مزيفة، واستخدام بيانات التواصل لغير الطلب الذي وصلت بسببه.</li>
<li>التقييم يكتبه العميل بعد الدفع. يجوز للإدارة حذف التقييم المسيء أو المزيف.</li>
<li>يمكن لأي مستخدم الإبلاغ عن حساب. للإدارة إيقاف أي حساب يخالف هذه الشروط.</li>
<li>الاستخدام لمن عمره 18 سنة فأكثر.</li>
<li>عند تغيير الشروط تغييراً جوهرياً سنطلب موافقتك عليها من جديد.</li>
</ol></details>
<details><summary>سياسة الخصوصية</summary><ul>
<li><b>ما نحفظه:</b> اسمك ورقم هاتفك وإيميل الدخول، ورقم بنكك إن أضفته كفني، وبيانات الطلبات والتقييمات، وملف الفني (المهنة والحي والخبرة والنبذة).</li>
<li><b>من يراه:</b> ملف الفني العام (الاسم والمهنة والحي والخبرة والنبذة والتقييمات) يراه أي زائر للتطبيق حتى بدون تسجيل، ولا يظهر فيه هاتفه. هاتف العميل لا يراه الفني إلا بعد قبول الطلب، وهاتف الفني ورقم بنكك لا يراهما العميل إلا بعد القبول. تطّلع الإدارة على البيانات عند مراجعة البلاغات وطلبات التوثيق.</li>
<li><b>الصور:</b> الصور التي يضيفها الفني لأعماله تظهر لأي زائر. لا ترفع صوراً فيها بيانات شخصية.</li>
<li><b>لا نبيع بياناتك</b> ولا نشاركها مع أي جهة إعلانية.</li>
<li><b>التخزين:</b> البيانات محفوظة عند خدمة Firebase التابعة لشركة جوجل.</li>
<li><b>الحذف:</b> من صفحة «حسابي» تحذف حسابك وبياناتك الشخصية (الاسم والهاتف وملف الفني). قد يبقى في سجل الطرف الآخر الطلب القديم والتقييم الذي كتبته.</li>
</ul></details>
</section>`}

function vReport(){return `<h2>إبلاغ</h2>
<form data-form="report" class="card">
  <p>الإبلاغ عن <b>${esc(V.targetName)}</b></p>
  <label class="f">سبب البلاغ<select name="reason">${Object.keys(REASONS).map(k=>`<option value="${k}">${REASONS[k]}</option>`).join('')}</select></label>
  <label class="f">التفاصيل<textarea name="text" required minlength="5" maxlength="500" placeholder="اشرح ما حدث"></textarea></label>
  <button class="btn pri block" type="submit">إرسال البلاغ</button>
  <p class="muted small">يصل البلاغ للإدارة فقط ولا يراه الطرف الذي أبلغت عنه.</p>
</form>`}

function vAccount(){
  const p=PROFILE||{};
  return `<h2>حسابي</h2>
<section class="card">
  <div class="kv"><span>الاسم</span><b>${esc(p.name)}</b></div>
  <div class="kv"><span>الهاتف</span><b class="ltr">${esc(p.phone)}</b></div>
  <div class="kv"><span>الإيميل</span><b class="ltr">${esc((USER&&USER.email)||'—')}</b></div>
  ${ISADMIN?'<div class="kv"><span>الصلاحية</span><span class="pill good">مدير</span></div>':''}
  <div class="acct"><div><div class="muted small">معرّف الحساب</div><b id="myuid" style="font-size:13px;letter-spacing:0">${esc(uid())}</b></div><button class="btn sec" data-act="copy" data-t="#myuid">نسخ</button></div>
</section>
<section class="card"><h3>حذف الحساب</h3>
<p class="muted small">يحذف اسمك ورقم هاتفك وملفك كفني نهائياً، ولا يمكن التراجع. قد يبقى في سجل الطرف الآخر الطلب القديم والتقييم.</p>
${V.confirm?`<div class="errmsg">هل أنت متأكد من حذف حسابك؟</div><div class="row"><button class="btn pri grow" data-act="del2">نعم، احذف</button><button class="btn sec grow" data-act="del0">إلغاء</button></div>`:'<button class="btn sec block" data-act="del1">حذف حسابي</button>'}
</section>`}

function vAdmin(){
  const t=V.tab||'reports';
  const openN=ADM.reports.filter(r=>r.status==='open').length;
  const tabs=[['reports','البلاغات'+(openN?' ('+openN+')':'')],['verify','التوثيق'+(ADM.vreqs.length?' ('+ADM.vreqs.length+')':'')],['people','الحسابات'],['money','المحفظة'],['stats','أرقام']];
  const seg=`<div class="seg">${tabs.map(([k,l])=>`<button data-act="atab" data-id="${k}" ${k===t?'aria-current="true"':''}>${l}</button>`).join('')}</div>`;
  const userOf=id=>ADM.users.find(x=>x.id===id)||{};
  const phoneLine=id=>{const u=userOf(id);return u.phone?`<a class="linkbtn ltr" href="${waLink(u.phone)}" target="_blank" rel="noopener">${esc(u.phone)} واتساب</a>`:''};
  const banBtn=id=>id===uid()?'':isBannedId(id)?`<button class="btn sec grow" data-act="a-unban" data-id="${esc(id)}">رفع الإيقاف</button>`:`<button class="btn sec grow" data-act="a-ban" data-id="${esc(id)}">إيقاف الحساب</button>`;
  const none=m=>`<div class="empty"><p>${m}</p></div>`;
  let body='';
  if(t==='reports'){
    const rs=ADM.reports.slice().sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||(b.createdAt||0)-(a.createdAt||0));
    body=rs.length?rs.map(r=>`<article class="card">
      <div class="row between"><b>${esc(REASONS[r.reason]||r.reason)}</b><span class="pill ${r.status==='open'?'warn':'good'}">${r.status==='open'?'مفتوح':'تمت المعالجة'}</span></div>
      <p>${esc(r.text)}</p>
      <div class="muted small">المُبلِغ: ${esc(r.reporterName)} · المُبلَغ عنه: ${esc(r.targetName)}${isBannedId(r.targetId)?' (موقوف)':''} · ${dt(r.createdAt)}</div>
      ${phoneLine(r.targetId)}
      <div class="row">${r.status==='open'?`<button class="btn pri grow" data-act="a-close" data-id="${esc(r.id)}">تمت المعالجة</button>`:`<button class="btn sec grow" data-act="a-reopen" data-id="${esc(r.id)}">إعادة فتح</button>`}${banBtn(r.targetId)}</div>
    </article>`).join(''):none('لا توجد بلاغات.');
  }else if(t==='verify'){
    const reqs=ADM.vreqs.filter(q=>techById(q.id));
    body='<h3>طلبات التوثيق</h3>'+(reqs.length?reqs.map(q=>{const k=techById(q.id);return `<article class="card">
      <div class="row">${av(k.name)}<div><b>${esc(k.name)}</b><div class="muted small">${tradeName(k.trade)} · ${esc(k.hood)} · ${esc(k.years)} سنوات</div></div></div>
      <p>${esc(k.bio)}</p>${phoneLine(k.id)}
      <div class="row"><button class="btn pri grow" data-act="a-verify" data-id="${esc(k.id)}">توثيق</button><button class="btn sec grow" data-act="a-vdeny" data-id="${esc(k.id)}">رفض الطلب</button></div>
    </article>`}).join(''):none('لا توجد طلبات توثيق.'))
    +'<h3>الفنيون الموثقون</h3>'+(D.verifs.length?D.verifs.map(v=>{const k=techById(v.id);return k?`<article class="card"><div class="row between"><div><b>${esc(k.name)}</b><div class="muted small">${tradeName(k.trade)} · ${esc(k.hood)}</div></div><button class="btn sec" data-act="a-unverify" data-id="${esc(k.id)}">سحب التوثيق</button></div></article>`:''}).join(''):none('لا يوجد موثقون بعد.'));
  }else if(t==='money'){
    const ts=D.techs.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
    body=`<form data-form="fees" class="card"><h3>رسوم قبول الطلب</h3>
      <label class="f">الرسوم على الفني عن كل طلب يقبله (جنيه). اكتب 0 لإيقاف الرسوم<input type="number" name="amount" min="0" max="1000000" required inputmode="numeric" value="${FEE()}"></label>
      <label class="f">رقم حساب بنكك لاستلام شحن الرصيد<input type="text" name="bankak" inputmode="numeric" maxlength="60" value="${esc(FEES.bankak||'')}"></label>
      <button class="btn pri block" type="submit">حفظ</button>
      <p class="muted small">${FEE()>0?'الرسوم مفعّلة. الفني بدون رصيد كافٍ لا يستطيع قبول الطلبات.':'الرسوم متوقفة حالياً. الفنيون يقبلون الطلبات مجاناً.'}</p></form>
      <h3>أرصدة الفنيين</h3>`+(ts.length?ts.map(k=>{const w=ADM.wallets.find(x=>x.id===k.id);return `<article class="card"><div class="row between"><div><b>${esc(k.name)}</b><div class="muted small">${tradeName(k.trade)} · الرصيد ${money(w?w.balance:0)}</div></div><button class="btn sec" data-act="a-topup" data-id="${esc(k.id)}" data-name="${esc(k.name)}">شحن / خصم</button></div>${phoneLine(k.id)}</article>`}).join(''):none('لا يوجد فنيون.'));
  }else if(t==='people'){
    const us=ADM.users.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
    body=us.length?us.map(u=>{const k=techById(u.id);return `<article class="card">
      <div class="row between"><div><b>${esc(u.name)}</b>${vbadge(u.id)}<div class="muted small">${k?'فني · '+tradeName(k.trade)+' · '+esc(k.hood):'عميل'}${isBannedId(u.id)?' · موقوف':''}</div></div></div>
      ${phoneLine(u.id)}<div class="row">${banBtn(u.id)}</div></article>`}).join(''):none('لا توجد حسابات.');
  }else{
    const rq=ADM.reqs,c=s=>rq.filter(r=>r.status===s).length;
    body=`<section class="card">
      <div class="kv"><span>إجمالي الحسابات</span><b>${ADM.users.length}</b></div>
      <div class="kv"><span>الفنيون</span><b>${D.techs.length}</b></div>
      <div class="kv"><span>الفنيون الموثقون</span><b>${D.verifs.length}</b></div>
      <div class="kv"><span>الحسابات الموقوفة</span><b>${D.bans.length}</b></div>
      <div class="kv"><span>بلاغات مفتوحة</span><b>${openN}</b></div></section>
    <h3>الطلبات</h3><section class="card">
      <div class="kv"><span>الإجمالي</span><b>${rq.length}</b></div>
      ${['sent','accepted','rejected','done','paid','rated'].map(s=>`<div class="kv"><span>${STATUS_TXT[s]}</span><b>${c(s)}</b></div>`).join('')}
      <div class="kv"><span>طلبات تم دفعها (مدفوع + مكتمل)</span><b>${c('paid')+c('rated')}</b></div></section>`;
  }
  return `<h2>الإدارة</h2>${seg}${body}`}

/* ---------- shell ---------- */
function backOf(){
  switch(V.name){
    case 'techs':return ['search'];
    case 'tech':return ['techs',{trade:V.trade}];
    case 'request':return ['tech',{id:V.id,trade:V.trade}];
    case 'req':return ['reqs'];
    case 'signupT':return ['welcome'];
    case 'login':return ['search'];
    case 'terms':case 'report':return V.from||[USER?'search':'login'];
    case 'account':case 'admin':return ROLE==='t'?['tdash']:ROLE==='c'?['search']:['welcome'];
    default:return null;
  }
}
const footer=()=>`<footer class="foot"><button class="linkbtn" data-act="terms">الشروط والخصوصية</button>${USER&&PROFILE?'<button class="linkbtn" data-act="account">حسابي</button>':''}${SUPPORT_WA?`<a class="linkbtn" href="https://wa.me/${SUPPORT_WA}" target="_blank" rel="noopener">الدعم</a>`:''}</footer>`;
const tab=(a,icon,label,cur)=>`<button class="tab" data-act="${a}" ${cur?'aria-current="page"':''}>${ico(icon,22)}<span>${label}</span></button>`;
function render(){
  setBadge();
  if(READY&&USER&&isBanned()&&!['banned','terms','account'].includes(V.name))V={name:'banned'};
  const v=V.name;
  if(v==='admin'&&!ISADMIN){route();return}
  if((v==='tech'||v==='request')&&!techById(V.id)){go('search');return}
  if(v==='req'&&!D.reqsC.find(r=>r.id===V.id)){go('reqs');return}
  if((v==='tdash'||v==='tprofile')&&!myTech()){go('signupT');return}
  const views={boot:vBoot,setup:vSetup,login:vLogin,profile:vProfile,welcome:vWelcome,signupT:vSignupT,search:vSearch,techs:vTechs,tech:vTech,request:vRequest,reqs:vReqs,req:vReq,tdash:vTDash,tprofile:vTProfile,banned:vBanned,accept:vAccept,terms:vTerms,report:vReport,account:vAccount,admin:vAdmin};
  const b=backOf();
  let bar='';
  if(v==='tech'){
    const k=techById(V.id),off=k.avail===false;
    bar=`<div class="bar"><div class="wrap"><div class="dock"><button class="btn pri grow" data-act="request" data-id="${esc(V.id)}" ${off?'disabled':''}>${off?'غير متاح حالياً':USER?'اطلب الخدمة':'سجّل دخولك واطلب الخدمة'}</button></div></div></div>`;
  }else if(USER&&ROLE==='c'&&['search','techs','reqs','req'].includes(v)){
    const home=v==='search'||v==='techs',n=D.reqsC.length;
    bar=`<nav class="bar" aria-label="التنقل"><div class="wrap"><div class="dock">${tab('home','mechanic','الفنيون',home)}${tab('reqs','clip','طلباتي'+(n?' ('+n+')':''),!home)}</div></div></nav>`;
  }else if(ROLE==='t'&&['tdash','tprofile'].includes(v)){
    bar=`<nav class="bar" aria-label="التنقل"><div class="wrap"><div class="dock">${tab('tdash','clip','الطلبات'+(D.reqsT.some(r=>r.status==='sent')?' ('+D.reqsT.filter(r=>r.status==='sent').length+' جديد)':''),v==='tdash')}${tab('tprofile','user','ملفي',v==='tprofile')}</div></div></nav>`;
  }
  const signed=USER&&!['boot','login','setup'].includes(v);
  const ends=signed?`${ISADMIN?'<button class="link" data-act="admin">الإدارة</button>':''}${ROLE&&v!=='profile'?'<button class="link" data-act="switch">تغيير الحساب</button>':''}<button class="link" data-act="logout">خروج</button>`:(!USER&&!['boot','login','setup'].includes(v)?'<button class="link" data-act="login">تسجيل الدخول</button>':'');
  app.innerHTML=`
<header class="top"><div class="wrap"><div class="brand"><span class="mark">${ico('mechanic',21,1.9)}</span><span>أسطى<small>فنيون في الخرطوم</small></span></div><div class="end">${ends}</div></div></header>
<main class="wrap main">${NOTE?`<div class="banner">${esc(NOTE)}</div>`:''}${b?`<button class="back" data-act="back">→ رجوع</button>`:''}${views[v]()}${['boot','setup'].includes(v)?'':footer()}</main>${bar}`;
}

/* ---------- auth ---------- */
const AUTHERR={
  'auth/invalid-credential':'الإيميل أو كلمة السر غير صحيحة.','auth/wrong-password':'الإيميل أو كلمة السر غير صحيحة.','auth/user-not-found':'الإيميل أو كلمة السر غير صحيحة.',
  'auth/email-already-in-use':'هذا الإيميل مسجل من قبل. جرّب تسجيل الدخول.','auth/weak-password':'كلمة السر ضعيفة. استخدم 6 أحرف على الأقل.',
  'auth/invalid-email':'صيغة الإيميل غير صحيحة.','auth/network-request-failed':'تعذر الاتصال بالإنترنت.','auth/too-many-requests':'محاولات كثيرة. انتظر قليلاً ثم حاول.',
  'auth/unauthorized-domain':'هذا الدومين غير مضاف في إعدادات Firebase.','auth/popup-closed-by-user':'','auth/cancelled-popup-request':''
};
function authFail(e){
  const c=e&&e.code;
  AUTH.err=c in AUTHERR?AUTHERR[c]:'تعذر تسجيل الدخول. حاول مرة ثانية.';
  if(V.name==='login')render();
}

/* ---------- events ---------- */
async function act(a,id,el){
  switch(a){
    case 'install':{
      if(!INSTALL)break;
      INSTALL.prompt();
      try{await INSTALL.userChoice}catch(e){}
      INSTALL=null;render();break}
    case 'google':{
      AUTH.err='';
      const p=new GoogleAuthProvider();
      try{await signInWithPopup(auth,p)}
      catch(e){
        if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')){try{await signInWithRedirect(auth,p)}catch(e2){authFail(e2)}}
        else authFail(e);
      }
      break}
    case 'toggle-auth':AUTH.mode=AUTH.mode==='in'?'up':'in';AUTH.err='';render();break;
    case 'reset':{
      const em=(document.querySelector('input[name=email]')||{}).value||'';
      if(!em.trim()){AUTH.err='اكتب الإيميل أولاً ثم اضغط "نسيت كلمة السر".';render();break}
      try{await sendPasswordResetEmail(auth,em.trim());AUTH.err='';toast('أرسلنا رابط تغيير كلمة السر لإيميلك')}catch(e){authFail(e)}
      break}
    case 'logout':ROLE=null;lsSet('osta-role',null);await signOut(auth);break;
    case 'role-c':ROLE='c';lsSet('osta-role',ROLE);go('search');break;
    case 'role-t':ROLE='t';lsSet('osta-role',ROLE);go(myTech()?'tdash':'signupT');break;
    case 'switch':ROLE=null;lsSet('osta-role',null);go('welcome');break;
    case 'back':{const b=backOf();if(b)go(b[0],b[1]);break}
    case 'home':go('search');break;
    case 'allhoods':F.hood='all';render();break;
    case 'trade':go('techs',{trade:id});break;
    case 'tech':go('tech',{id,trade:V.trade});break;
    case 'request':
      if(!USER){lsSet('osta-next',{name:'request',extra:{id,trade:V.trade}});ROLE='c';lsSet('osta-role','c');AUTH.intent='c';AUTH.mode='up';AUTH.err='';go('login');break}
      go('request',{id,trade:V.trade});break;
    case 'login':lsSet('osta-next',null);AUTH.intent='';AUTH.mode='in';AUTH.err='';go('login');break;
    case 'guest-tech':lsSet('osta-next',null);ROLE='t';lsSet('osta-role','t');AUTH.intent='t';AUTH.mode='up';AUTH.err='';go('login');break;
    case 'reqs':go('reqs');break;
    case 'req':go('req',{id});break;
    case 'pay-cash':case 'pay-bank':
      if(await run(()=>updateDoc(doc(db,'requests',id),{status:'paid'})))toast(a==='pay-cash'?'تم تسجيل الدفع':'تم تسجيل التحويل');
      break;
    case 'copy':{
      const t=$(el.dataset.t||'#acct');if(!t)break;const txt=t.textContent;
      const sel=()=>{const rg=document.createRange();rg.selectNodeContents(t);const s=getSelection();s.removeAllRanges();s.addRange(rg)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(()=>toast('تم النسخ')).catch(()=>{sel();toast('حدد الرقم وانسخه')})}
      else{sel();toast('حدد الرقم وانسخه')}
      break}
    case 'rate':
      V.rate=+el.dataset.n;
      document.querySelectorAll('.rbtn').forEach(b=>b.classList.toggle('on',+b.dataset.n<=V.rate));
      $('#sendRate').disabled=false;break;
    case 'send-rate':{
      const r=D.reqsC.find(x=>x.id===id),c=($('#comment').value||'').trim(),n=V.rate;
      const ok=await run(async()=>{
        const b=writeBatch(db);
        b.set(doc(db,'techs',r.techId,'reviews',id),{stars:n,text:c,who:String(PROFILE.name).split(' ')[0],customerId:uid(),createdAt:Date.now()});
        b.update(doc(db,'requests',id),{status:'rated',stars:n,comment:c});
        await b.commit();
      });
      if(ok){V.rate=0;toast('شكراً لتقييمك')}
      break}
    case 'avail':{const m=myTech();await run(()=>updateDoc(doc(db,'techs',m.id),{avail:m.avail===false}));break}
    case 't-accept':{
      const f=FEE();
      if(f>0&&BAL()<f){toast('رصيدك لا يكفي لقبول الطلب');break}
      await run(async()=>{
        const b=writeBatch(db);
        b.update(doc(db,'requests',id),{status:'accepted'});
        b.set(doc(db,'requests',id,'private','tech'),{phone:PROFILE.phone,bankak:PROFILE.bankak||''});
        if(f>0)b.update(doc(db,'wallets',uid()),{balance:BAL()-f,lastRid:id});
        await b.commit();
      });break}
    case 't-reject':await run(()=>updateDoc(doc(db,'requests',id),{status:'rejected'}));break;
    case 't-done':await run(()=>updateDoc(doc(db,'requests',id),{status:'done'}));break;
    case 'terms':go('terms',{from:here()});break;
    case 'report':if(!USER){toast('سجّل دخولك أولاً للإبلاغ');break}
      go('report',{targetId:id,targetName:el.dataset.name,rid:el.dataset.rid||'',from:here()});break;
    case 'account':go('account');break;
    case 'del1':V.confirm=true;render();break;
    case 'del0':V.confirm=false;render();break;
    case 'del2':{
      const u=auth.currentUser;if(!u)break;
      const last=u.metadata&&u.metadata.lastSignInTime?Date.parse(u.metadata.lastSignInTime):0;
      if(Date.now()-last>5*60*1000){V.confirm=false;render();toast('لأمانك: اضغط خروج ثم ادخل من جديد، وبعدها احذف الحساب مباشرة');break}
      const ok=await run(async()=>{
        const b=writeBatch(db);
        b.delete(doc(db,'verifyRequests',u.uid));
        if(myTech()){SLOTS.forEach(x=>b.delete(doc(db,'techs',u.uid,'photos',x)));b.delete(doc(db,'techs',u.uid))}
        b.delete(doc(db,'users',u.uid));
        await b.commit();
      });
      if(!ok)break;
      ROLE=null;lsSet('osta-role',null);
      try{await deleteUser(u)}catch(e){toast('تم حذف بياناتك، لكن تعذر حذف الدخول. تواصل مع الإدارة')}
      break}
    case 'notif':try{await Notification.requestPermission()}catch(e){}render();break;
    case 'zoom':{const im=el.querySelector('img');if(im){zoomEl.querySelector('img').src=im.src;zoomEl.hidden=false}break}
    case 'delphoto':if(confirm('حذف هذه الصورة؟'))await run(()=>deleteDoc(doc(db,'techs',uid(),'photos',id)));break;
    case 'a-delphoto':if(confirm('حذف هذه الصورة من ملف الفني؟')){if(await run(()=>deleteDoc(doc(db,'techs',id,'photos',el.dataset.slot)))){delete PHC[id];render()}}break;
    case 'vreq':if(await run(()=>setDoc(doc(db,'verifyRequests',uid()),{at:Date.now()})))toast('وصل طلب التوثيق للإدارة');break;
    case 'admin':go('admin');break;
    case 'atab':V.tab=id;render();break;
    case 'a-close':await run(()=>updateDoc(doc(db,'reports',id),{status:'closed'}));break;
    case 'a-reopen':await run(()=>updateDoc(doc(db,'reports',id),{status:'open'}));break;
    case 'a-ban':if(confirm('إيقاف هذا الحساب؟ لن يستطيع إرسال أو استقبال الطلبات.'))await run(()=>setDoc(doc(db,'bans',id),{at:Date.now(),reason:''}));break;
    case 'a-unban':await run(()=>deleteDoc(doc(db,'bans',id)));break;
    case 'a-verify':
      await run(async()=>{const b=writeBatch(db);b.set(doc(db,'verifications',id),{at:Date.now()});b.delete(doc(db,'verifyRequests',id));await b.commit()});break;
    case 'a-topup':{
      const raw=prompt('المبلغ المراد إضافته لرصيد '+el.dataset.name+' بالجنيه (اكتب رقماً سالباً للخصم):');
      if(raw==null)break;
      const amt=Math.round(Number(String(raw).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g,'')));
      if(!amt||!isFinite(amt)){toast('اكتب رقماً صحيحاً');break}
      const w=ADM.wallets.find(x=>x.id===id),nb=(w?+w.balance||0:0)+amt;
      if(nb<0){toast('الرصيد لا يمكن أن يصير سالباً');break}
      if(!confirm('تأكيد: '+(amt>0?'إضافة ':'خصم ')+money(Math.abs(amt))+' — الرصيد بعد العملية '+money(nb)))break;
      if(await run(async()=>{
        const b=writeBatch(db);
        b.set(doc(db,'wallets',id),{balance:nb});
        b.set(doc(collection(db,'wallets',id,'log')),{at:Date.now(),amount:amt,note:amt>0?'شحن':'خصم'});
        await b.commit();
      }))toast('تم تحديث الرصيد');
      break}
    case 'a-vdeny':await run(()=>deleteDoc(doc(db,'verifyRequests',id)));break;
    case 'a-unverify':if(confirm('سحب شارة التوثيق من هذا الفني؟'))await run(()=>deleteDoc(doc(db,'verifications',id)));break;
    case 'tdash':go('tdash');break;
    case 'tprofile':go('tprofile');break;
  }
}
app.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  act(el.dataset.act,el.dataset.id,el).catch(()=>{});
});
app.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='hood'){F.hood=t.value;render()}
  else if(t.id==='receipt'){
    const f=t.files&&t.files[0];
    $('#recName').textContent=f?f.name:'لم يتم اختيار صورة';
    $('#payBank').disabled=!f;
  }else if(t.id==='photo'){
    const fl=[...t.files];t.value='';
    uploadPhotos(fl);
  }
});
app.addEventListener('submit',async e=>{
  e.preventDefault();
  const f=e.target,d=Object.fromEntries(new FormData(f)),btn=f.querySelector('button[type=submit]');
  if(btn)btn.disabled=true;
  let ok=false;
  switch(f.dataset.form){
    case 'auth':
      AUTH.err='';
      try{
        if(AUTH.mode==='up')await createUserWithEmailAndPassword(auth,d.email.trim(),d.password);
        else await signInWithEmailAndPassword(auth,d.email.trim(),d.password);
        ok=true;
      }catch(er){authFail(er)}
      break;
    case 'profile':{
      const p={name:d.name.trim(),phone:d.phone.trim(),bankak:'',termsV:TERMS_V,termsAt:Date.now()};
      ok=await run(()=>setDoc(doc(db,'users',uid()),p));
      if(ok){PROFILE=p;route()}
      break}
    case 'signupT':{
      const p=Object.assign({},PROFILE,{name:d.name.trim(),bankak:(d.bankak||'').trim()});
      const t={name:p.name,trade:d.trade,hood:d.hood,years:+d.years,bio:d.bio.trim(),avail:true,createdAt:Date.now()};
      ok=await run(async()=>{
        const b=writeBatch(db);
        b.set(doc(db,'users',uid()),p);
        b.set(doc(db,'techs',uid()),t);
        await b.commit();
      });
      if(ok){PROFILE=p;go('tdash')}
      break}
    case 'fees':{
      const x={amount:Math.max(0,Math.round(+d.amount||0)),bankak:(d.bankak||'').trim()};
      ok=await run(()=>setDoc(doc(db,'settings','fees'),x));
      if(ok)toast('تم حفظ الإعدادات');
      break}
    case 'accept':{
      const x={termsV:TERMS_V,termsAt:Date.now()};
      ok=await run(()=>updateDoc(doc(db,'users',uid()),x));
      if(ok){PROFILE=Object.assign({},PROFILE,x);route()}
      break}
    case 'report':{
      const r={reporterId:uid(),reporterName:PROFILE.name,targetId:V.targetId,targetName:String(V.targetName||'').slice(0,60),requestId:V.rid||'',reason:d.reason,text:d.text.trim(),status:'open',createdAt:Date.now()};
      ok=await run(()=>setDoc(doc(collection(db,'reports')),r));
      if(ok){toast('وصل بلاغك للإدارة. شكراً');const b=V.from||['search'];go(b[0],b[1])}
      break}
    case 'request':{
      const rid=doc(collection(db,'requests')).id;
      const r={techId:V.id,customerId:uid(),customerName:PROFILE.name,desc:d.desc.trim(),hood:d.hood,when:d.when,pay:d.pay,status:'sent',createdAt:Date.now()};
      ok=await run(async()=>{
        const b=writeBatch(db);
        b.set(doc(db,'requests',rid),r);
        b.set(doc(db,'requests',rid,'private','customer'),{phone:PROFILE.phone});
        await b.commit();
      });
      if(ok){toast('تم إرسال طلبك');go('reqs')}
      break}
  }
  if(!ok&&btn&&f.isConnected)btn.disabled=false;
});

/* ---------- start ---------- */
render();
if(!CONFIGURED){go('setup')}
else{
  const fb=initializeApp(firebaseConfig);
  auth=getAuth(fb);db=getFirestore(fb);
  onAuthStateChanged(auth,u=>{
    USER=u;
    if(!u){stopListen();PROFILE=null;READY=true;D={techs:[],reviews:[],reqsC:[],reqsT:[],verifs:[],bans:[]};ISADMIN=false;MYVREQ=false;FEES={amount:0,bankak:''};WALLET=null;ADM={users:[],reports:[],vreqs:[],reqs:[],wallets:[]};PRIV={};startGuest()}
    else startSession();
  });
}
