'use strict';
const api=window.mini;
const $=id=>document.getElementById(id);
const names={'nightmare':'Nightmare attempts','odyle-energy':'Odyle Energy','shugo-server':'Shugo Festival','shugo-character':'Shugo personal','invasion':'Dimensional Invasion','ascension':'Ascension Trial','subjugation':'Subjugation','unknown-fissure':'Unknown Fissure'};
let updating=false;
const n=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const fmt=x=>x===null||x===undefined?'—':n.format(x);
const idOf=x=>String(x.server||'').toLowerCase()+'/'+String(x.character||'').toLowerCase();
function periodStarts(){
 const d=new Date(),base=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),7);
 const day=86400000, daily=Date.now()>=base?base:base-day;
 return {daily,weekly:daily-((new Date(daily).getUTCDay()+4)%7)*day};
}
function render(s){
 const active=s.activeCharacter||null;
 $('character').textContent=active?.character||'Waiting for character';
 $('server').textContent=active?.server||'Open Aion 2 to detect your character';
 const capture=s.capture?.state||'idle';
 const ok=capture==='connected', running=['starting','listening','connected','unmapped'].includes(capture);
 const health=s.capture?.health;
 $('capture-status').textContent=ok?'Reading character data':capture==='listening'
  ?health?.gameRunning===false?'Waiting for AION2.exe'
   :health?.packets===0?'No packets · open full diagnostics'
   :health?.frames===0?'Packets only · decoder needs attention'
   :health?.characterPackets>0 && health?.identities===0?'Character packet parse mismatch'
   :health?.bundles>0 && health?.bundlesDecoded===0?'Compressed data needs updating'
   :health?.lobbyRosterCharacters>0 && health?.identities===0?'Account roster seen · world identity pending'
   :health?.identities===0 && health?.bundlesDecoded>0?'Compressed frames · identity pending'
   :health?.identities===0?'Frames decoded · identity not seen'
   :'Checking character identity'
  :capture==='error'?'Capture error · open full companion'
   :running?'Initializing Npcap':s.settings?.autoCapture===false?'Tracking paused':'Waiting for capture';
 $('status-dot').className=ok?'ok':capture==='error'?'fail':'';
 const events=(s.events||[]).filter(e=>active&&idOf(e)===idOf(active)&&Date.parse(e.occurred_at)<=Date.now())
   .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
 let regular=null,bound=null,regularFirst=null,regularLatest=null,regularReadings=0;
 const periods=periodStarts(), counters=new Map();
 for (const e of events) {
   const when=Date.parse(e.occurred_at);
   if(e.type==='wallet_snapshot'){
     if(e.currency_kind==='bound')bound=e.balance;
     if(e.currency_kind==='unbound'){
       regular=e.balance;
       if(when>=periods.daily){
         if(regularFirst===null)regularFirst=e.balance;
         regularLatest=e.balance;
         regularReadings++;
       }
     }
   }
   if(e.type==='counter'&&when>=(e.frequency==='weekly'?periods.weekly:periods.daily))
     counters.set(e.key,e);
 }
 $('regular').textContent=fmt(regular);
 $('bound').textContent=fmt(bound);
 const observedNet=regularReadings>=2?regularLatest-regularFirst:null;
 $('net').textContent=observedNet===null?'—':(observedNet>0?'+':'')+fmt(observedNet);
 $('counter-caption').textContent=counters.size?'Live / last seen':'Awaiting game data';
 const holder=$('counter-list');holder.replaceChildren();
 const preferred=['nightmare','odyle-energy','ascension','subjugation','invasion','unknown-fissure','shugo-server'];
 const rows=[...counters.values()].sort((a,b)=>{
   const ar=preferred.indexOf(a.key), br=preferred.indexOf(b.key);
   return (ar<0?99:ar)-(br<0?99:br);
 }).slice(0,3);
 if(!rows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Counters appear after character login';holder.append(empty);}
 for(const e of rows){
   const row=document.createElement('div');row.className='counter';
   const title=document.createElement('span');title.className='counter-name';title.textContent=names[e.key]||e.key;
   const value=document.createElement('span');value.className='counter-number';value.textContent=fmt(e.current)+' / '+fmt(e.maximum);
   const rail=document.createElement('span');rail.className='rail';
   const progress=document.createElement('i');progress.style.width=(e.maximum?Math.max(0,Math.min(100,100*e.current/e.maximum)):0)+'%';
   rail.append(progress);row.append(title,value,rail);holder.append(row);
 }
}
async function refresh(){
 if(updating)return;
 updating=true;
 try{render(await api.state());}catch{ $('capture-status').textContent='Connection interrupted';}
 finally{updating=false;}
}
$('open-main').addEventListener('click',()=>api.openMain());
$('view-details').addEventListener('click',()=>api.openMain());
$('hide-mini').addEventListener('click',()=>api.hide());
api.onChange(refresh);
refresh();setInterval(refresh,30000);
