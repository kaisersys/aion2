'use strict';
const api=window.companion;
const $=id=>document.getElementById(id);
let state=null, active=null, followedCapture=null, portLoaded=false;
const labels={'nightmare':'Nightmare attempts','invasion':'Dimensional Invasion','shugo-server':'Shugo Festival · server','shugo-character':'Shugo Festival · character',
'ascension':'Ascension Trial','subjugation':'Subjugation','duty':'Duty Missions','unknown-fissure':'Daeva Bio-Research',
'raid-ludra':'Abyssal Forge · Ludra'};
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const num=v=>v===null||v===undefined?'—':n.format(v);
const idOf=p=>(p.server+'/'+p.character).toLowerCase();
const match=(e,p)=>p&&idOf(p)===(e.server+'/'+e.character).toLowerCase();
function currentPeriods(){
 const ms=Date.now(),d=new Date(ms),day=86400000;
 const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),7);
 const daily=ms>=start?start:start-day;
 const weekly=daily-((new Date(daily).getUTCDay()+4)%7)*day;
 return {daily,weekly,nextDaily:daily+day,nextWeekly:weekly+7*day};
}
function show(message,error=false){
 const el=$('alert');el.textContent=message;el.style.borderColor=error?'#be7578':'#6180a5';el.hidden=false;
}
function entryKind(){
 const counter=$('entry-type').value==='counter';
 $('key-field').hidden=!counter;$('frequency-field').hidden=!counter;
 $('scope-field').hidden=!counter;$('max-field').hidden=!counter;
 $('amount-field').firstChild.textContent=$('entry-type').value==='wallet_snapshot'?'Balance':counter?'Current value':'Amount';
 $('entry-amount').min=counter?'0':'0';
}
function render(){
 if(!state)return;
 const combined=[...state.profiles];
 if(state.remote)for(const c of state.remote.characters){
   if(!combined.some(p=>idOf(p)===idOf({character:c.name,server:c.server_name}) ||
       (p.character.toLowerCase()===c.name.toLowerCase() &&
        p.serverId && p.server.split(' - ').at(-1)?.toLowerCase()===c.server_name.toLowerCase())))
     combined.push({character:c.name,server:c.server_name});
 }
 const captured=state.activeCharacter ? idOf(state.activeCharacter):null;
 if(captured && captured!==followedCapture && combined.some(p=>idOf(p)===captured)) {
   active=captured; followedCapture=captured;
 }
 if(!active||!combined.some(p=>idOf(p)===active))active=combined.length?idOf(combined[0]):null;
 const select=$('character-select');select.replaceChildren();
 for(const p of combined){
   const option=document.createElement('option');option.value=idOf(p);
   option.textContent=p.character+' · '+p.server;select.appendChild(option);
 }
 if(active)select.value=active;
 if(!combined.length) {
  const placeholder=document.createElement('option');
  placeholder.value=''; placeholder.textContent='Characters appear after login';
  select.append(placeholder);
 }
 const profile=combined.find(p=>idOf(p)===active)||null;
 $('connection-status').textContent=state.remote?'Connected · '+state.remote.email:'Local-only mode';
 $('show-login').textContent=state.remote?'Disconnect account':'Connect account';
 $('sync-now').disabled=!state.remote;
 $('feed-label').textContent=state.feedPath?'Also watching '+state.feedPath+' for decoded JSONL events':'Read-only Npcap capture; decoded events are stored locally.';
 $('capture-detail').textContent=state.capture?.message||'Npcap initializing...';
 const h=state.capture?.health;
 const hasIdentity=state.capture?.state==='connected';
 $('diagnostic-process').textContent=!h?'Checking':h.gameRunning?'Detected':'Not running';
 $('diagnostic-connections').textContent=h?String(h.connections):'—';
 $('diagnostic-adapters').textContent=h?String(h.adapters):'—';
 $('diagnostic-packets').textContent=h?String(h.packets):'—';
 $('diagnostic-frames').textContent=h?String(h.frames):'—';
 $('diagnostic-bundles').textContent=h?String(h.bundlesDecoded)+' / '+String(h.bundles):'—';
 $('diagnostic-bundle-errors').textContent=h?String(h.bundleFailures):'—';
 $('diagnostic-inner').textContent=h?String(h.innerFrames):'—';
 $('diagnostic-identity').textContent=h?String(h.identities+h.rosters):'—';
 $('diagnostic-identity-packets').textContent=h?String(h.characterPackets+h.rosterPackets):'—';
 $('diagnostic-ticket-packets').textContent=h?String(h.ticketPackets):'—';
 $('diagnostic-opcodes').textContent=h?.popularOpcodes?.length
   ? h.popularOpcodes.map(x=>x.opcode+' ('+x.count+')').join(' · ') : 'Awaiting frames';
 $('detection-instructions').hidden=hasIdentity;
 $('detection-instructions').textContent=state.capture?.state==='error'
   ?'Capture error. Check the exact message above. Npcap may need reinstalling without administrator-only access.'
   :state.settings?.autoCapture===false
   ?'Tracking is paused. Resume automatic tracking to receive game data.'
   :h && !h.gameRunning
   ?'Launch Aion 2 on this PC and enter the game world. If you play through cloud streaming, the game traffic may not be accessible locally.'
   :h && h.packets===0
   ?'The companion sees no game packets. Check Npcap, administrator-only capture settings, and VPN/loopback routing; teleporting repeatedly will not help.'
   :h && h.frames===0
   ?'Packets are arriving, but the decoder has not produced game frames. This indicates a capture/protocol mismatch that requires investigation.'
   :h && h.bundles>0 && h.bundlesDecoded===0
   ?'Compressed bundles were detected but failed to decompress; the decoder needs a format update.'
   :h && h.bundlesDecoded>0 && h.characterPackets===0 && h.rosterPackets===0
   ?'Compressed game data was unpacked successfully; character identification is still pending.'
   :h && h.characterPackets>0 && h.identities===0
   ?'Character packets are reaching us but the parser is rejecting them. No additional teleport is necessary; the decoder must be updated.'
   :h && h.rosterPackets>0 && h.rosters===0
   ?'Account roster packets are reaching us, but their layout is not being recognized by this build.'
   :h && h.frames>0
   ?'Frame decoding is working. The opcode counts below show whether character messages are present in this game build.'
   :'Listening for Aion 2 data…';
 if(!portLoaded) { $('game-port').value=state.settings?.gamePort||13328; portLoaded=true; }
 $('overlay-toggle').textContent=state.settings?.overlayEnabled?'Hide mini overlay':'Show mini overlay';
 const capturing=['starting','listening','connected','unmapped'].includes(state.capture?.state);
 $('capture-toggle').textContent=capturing?'Pause automatic tracking':'Resume automatic tracking';
 $('capture-toggle').dataset.capturing=String(capturing);
 $('activity-status').textContent=state.capture?.state==='connected'?'Game connected':state.capture?.state==='listening'?'Listening for game':state.feedPath?'Test feed connected':'Local history active';
 const p=currentPeriods();
 $('daily-reset').textContent='Next '+new Date(p.nextDaily).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 $('weekly-reset').textContent='Next '+new Date(p.nextWeekly).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 const events=(state.events||[]).filter(e=>match(e,profile) && Date.parse(e.occurred_at)<=Date.now())
   .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
 const t={dayEarned:0,daySpent:0,weekEarned:0,weekSpent:0};
 let wallet=null, boundWallet=null;
 const counters=new Map();
 for(const e of events){
   const at=Date.parse(e.occurred_at);
   if(e.type==='wallet_snapshot'){
     if(e.currency_kind==='bound')boundWallet=e;
     else wallet=e;
   }
   if(e.type==='kinah_earned'||e.type==='kinah_spent'){
     const field=e.type==='kinah_earned'?'Earned':'Spent';
     if(at>=p.daily)t['day'+field]+=e.amount;
     if(at>=p.weekly)t['week'+field]+=e.amount;
   }
   if(e.type==='counter'&&at>=(e.frequency==='daily'?p.daily:p.weekly))counters.set(e.frequency+':'+e.key,e);
 }
 const shownWallet=boundWallet||wallet;
 $('wallet-title').textContent=boundWallet?'BOUND KINAH (OBSERVED)':'OBSERVED KINAH';
 $('wallet').textContent=shownWallet?num(shownWallet.balance):'—';
 $('wallet-note').textContent=shownWallet?(boundWallet?'Bound Kinah only · ':'')+'Last seen '+new Date(shownWallet.occurred_at).toLocaleString():'Awaiting wallet snapshot';
 $('today-earned').textContent=num(t.dayEarned);
 $('today-spent').textContent=num(t.daySpent);
 const net=t.weekEarned-t.weekSpent;
 $('week-net').textContent=(net>0?'+':'')+num(net);
 $('week-net').className=net<0?'down':net>0?'up':'';
 $('week-note').textContent=num(t.weekEarned)+' earned · '+num(t.weekSpent)+' spent';
 for(const period of ['daily','weekly']){
  const holder=$(period+'-counters');holder.replaceChildren();
  const matching=[...counters.values()].filter(e=>e.frequency===period);
  if(!matching.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No '+period+' counters observed yet.';holder.append(empty);continue;}
  for(const e of matching){
   const row=document.createElement('div');row.className='counter-row';
   const pct=e.maximum>0?Math.max(0,Math.min(100,100*e.current/e.maximum)):0;
   row.innerHTML='<div class="counter-title"><span>'+escapeHtml(labels[e.key]||e.key)+'</span><span class="counter-number">'+num(e.current)+' / '+num(e.maximum)+'</span></div>'+
    '<div class="track"><i></i></div>';
   row.querySelector('.track i').style.width=pct+'%';
   holder.appendChild(row);
  }
 }
 $('ledger-count').textContent=events.length+' records';
 const recent=$('activity-rows');recent.replaceChildren();
 if(!events.length){const div=document.createElement('div');div.className='empty';div.textContent='Choose a character and record an entry to see your summary.';recent.append(div);}
 for(const e of events.slice(-6).reverse()){
  const row=document.createElement('div');row.className='activity-row';
  const name=e.type==='kinah_earned'?'Kinah earned':e.type==='kinah_spent'?'Kinah spent':
      e.type==='wallet_snapshot'?'Wallet observed':labels[e.key]||e.key;
  const amount=e.type==='kinah_earned'?'+'+num(e.amount):e.type==='kinah_spent'?'−'+num(e.amount):
     e.type==='wallet_snapshot'?num(e.balance):num(e.current)+' / '+num(e.maximum);
  const cls=e.type==='kinah_earned'?'up':e.type==='kinah_spent'?'down':'';
  row.innerHTML='<div><span class="activity-name">'+escapeHtml(name)+'</span><span class="activity-detail">'+
    escapeHtml(e.source==='decoded'?'Decoded observation':'Manual / imported entry')+'</span></div>'+
    '<span class="activity-amount '+cls+'">'+escapeHtml(amount)+'</span>'+
    '<span class="activity-time">'+new Date(e.occurred_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</span>';
  recent.append(row);
 }
}
async function refresh(){try{state=await api.state();render();}catch(e){show(e.message,true);}}
$('character-select').addEventListener('change',e=>{active=e.target.value;render();});
$('show-add').addEventListener('click',()=>{$('add-character').hidden=!$('add-character').hidden;});
$('add-character').addEventListener('submit',async e=>{
 e.preventDefault();try{const character=$('character-name').value.trim(),server=$('character-server').value.trim();
 await api.addProfile({character,server});active=idOf({character,server});
 $('add-character').reset();$('add-character').hidden=true;await refresh();}catch(err){show(err.message,true);}
});
$('toggle-entry').addEventListener('click',()=>{$('entry-panel').hidden=!$('entry-panel').hidden;});
$('entry-type').addEventListener('change',entryKind);
$('event-form').addEventListener('submit',async e=>{
 e.preventDefault();const p=(state.profiles||[]).find(x=>idOf(x)===active)||
   (state.remote?.characters||[]).map(c=>({character:c.name,server:c.server_name})).find(x=>idOf(x)===active);
 if(!p){show('Add or select a character first.',true);return;}
 const type=$('entry-type').value,amount=Number($('entry-amount').value);
 const record={character:p.character,server:p.server,type,occurred_at:new Date().toISOString()};
 if(type==='kinah_earned'||type==='kinah_spent')record.amount=amount;
 if(type==='wallet_snapshot')record.balance=amount;
 if(type==='counter')Object.assign(record,{key:$('entry-key').value.trim(),current:amount,maximum:Number($('entry-max').value),
    frequency:$('entry-frequency').value,scope:$('entry-scope').value});
 try{await api.addEvent(record);$('event-form').reset();entryKind();show('Entry saved locally.');await refresh();}
 catch(err){show(err.message,true);}
});
$('overlay-toggle').addEventListener('click',async()=>{
 try {await api.toggleOverlay();await refresh();}
 catch(e){show(e.message,true);}
});
$('capture-toggle').addEventListener('click',async()=>{
 try{
   if($('capture-toggle').dataset.capturing==='true')await api.stopCapture();
   else await api.startCapture(Number($('game-port').value));
   await refresh();
 }catch(err){show(err.message,true);}
});
$('choose-feed').addEventListener('click',async()=>{
 try{const file=await api.chooseFeed();if(file)show('Watching '+file+'. Only supported decoded JSONL events will be imported.');await refresh();}
 catch(e){show(e.message,true);}
});
$('show-login').addEventListener('click',async()=>{
 if(state.remote){await api.logout();await refresh();show('Disconnected from website. Local history is unchanged.');}
 else if(!state.configured)show('Website sync is not configured in this build. Ask the site owner to set config.json.',true);
 else $('auth-backdrop').hidden=false;
});
$('close-login').addEventListener('click',()=>{$('auth-backdrop').hidden=true;$('auth-password').value='';});
$('auth-form').addEventListener('submit',async e=>{
 e.preventDefault();
 try{await api.login({email:$('auth-email').value.trim(),password:$('auth-password').value});
 $('auth-backdrop').hidden=true;$('auth-password').value='';await refresh();show('Website account connected. Sync is optional.');}
 catch(err){show(err.message,true);$('auth-backdrop').hidden=true;$('auth-password').value='';}
});
$('sync-now').addEventListener('click',async()=>{
 try{const r=await api.sync();show('Synced '+r.uploaded+' local records and '+r.ticketBalances+
 ' decoded ticket snapshots. '+r.unmatched+' records had no matching website character.');}
 catch(err){show(err.message,true);}
});
$('open-website').addEventListener('click',()=>api.openWebsite());
api.onChange(refresh);entryKind();refresh();
setInterval(refresh,60000);
