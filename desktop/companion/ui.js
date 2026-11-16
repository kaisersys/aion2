'use strict';
const api=window.companion;
const $=id=>document.getElementById(id);
let state=null, active=null, followedCapture=null, portLoaded=false;
let activeView='overview';
function setView(view) {
 activeView=view==='diagnostics'?'diagnostics':'overview';
 $('view-overview').hidden=activeView!=='overview';
 $('view-diagnostics').hidden=activeView!=='diagnostics';
 for(const name of ['overview','diagnostics']) {
   const button=$('nav-'+name);
   const selected=name===activeView;
   button.classList.toggle('nav-active',selected);
   if(selected)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
 }
 $('page-title-prefix').textContent=activeView==='overview'?'Character ':'Capture ';
 $('page-title-topic').textContent=activeView==='overview'?'overview.':'diagnostics.';
 $('page-description').textContent=activeView==='overview'
  ?'Your Kina, observed wallet movements and daily progression at a glance.'
  :'Npcap network health, packet decoding and capture controls.';
}
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
 $('currency-kind-field').hidden=$('entry-type').value!=='wallet_snapshot';
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
 $('diagnostic-lobby').textContent=h?String(h.lobbyRosterCharacters)+' from '+String(h.lobbyRosterPackets)+' packet(s)':'—';
 $('diagnostic-identity-packets').textContent=h?String(h.characterPackets+h.rosterPackets):'—';
 $('diagnostic-ticket-packets').textContent=h?String(h.ticketPackets):'—';
 $('diagnostic-inventory').textContent=h?String(h.inventoryFrames):'—';
 $('diagnostic-item-updates').textContent=h?String(h.itemUpdates):'—';
 $('diagnostic-item-deltas').textContent=h?String(h.itemDeltas):'—';
 $('diagnostic-item-stacks').textContent=h?String(h.itemStacks):'—';
 $('diagnostic-wallet-regular').textContent=h?String(h.unboundWalletReadings):'—';
 $('diagnostic-wallet-bound').textContent=h?String(h.boundWalletReadings):'—';
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
   :h && h.lobbyRosterCharacters>0
   ?'Account character list loaded from lobby. The active character and progression are confirmed separately in the world session.'
   :h && h.lobbyRosterPackets>0 && h.lobbyRosterCharacters===0
   ?'Lobby roster arrived, but its format was not recognized. Character discovery needs an updated decoder.'
   :h && h.bundles>0 && h.bundlesDecoded===0
   ?'Compressed bundles were detected but failed to decompress; the decoder needs a format update.'
   :h && h.bundlesDecoded>0 && h.characterPackets===0 && h.rosterPackets===0
   ?'Compressed game data was unpacked successfully; character identification is still pending.'
   :h && h.characterPackets>0 && h.identities===0
   ?'Character packets are reaching us but the parser is rejecting them. No additional teleport is necessary; the decoder must be updated.'
   :h && h.rosterPackets>0 && h.rosters===0
   ?'Account roster packets are reaching us, but their layout is not being recognized by this build.'
   :h && h.frames>0
   ?'World gameplay frames are arriving without login identities. Capture the lobby phase by opening the companion BEFORE launching the game. The new lobby character-list decoder is active.'
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
 const walletView=window.AtreiaWallets.calculate(events,p.daily);
 const money=window.AtreiaWallets.movements(events,p.daily);
 const itemEconomy=window.AtreiaItemEconomy.attribute(events,money,p.daily);
 const itemByWalletId=new Map(itemEconomy.matches.map(m=>[m.walletId,m]));
 const regularWallet=walletView.regular, boundWallet=walletView.bound;
 const t={dayEarned:0,daySpent:0};
 let hasEarned=false,hasSpent=false;
 const counters=new Map();
 for(const e of events){
   const at=Date.parse(e.occurred_at);
   if(e.type==='kinah_earned'||e.type==='kinah_spent'){
     const field=e.type==='kinah_earned'?'Earned':'Spent';
     if(at>=p.daily){
       t['day'+field]+=e.amount;
       if(field==='Earned')hasEarned=true;
       else hasSpent=true;
     }
   }
   if(e.type==='counter'&&at>=(e.frequency==='daily'?p.daily:p.weekly))counters.set(e.frequency+':'+e.key,e);
 }
 $('wallet').textContent=regularWallet?num(regularWallet.balance):'—';
 $('wallet-note').textContent=regularWallet
   ?'Tradeable Kina · last observed '+new Date(regularWallet.occurred_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
   :'Waiting for regular Kina inventory packets';
 $('bound-wallet').textContent=boundWallet?num(boundWallet.balance):'—';
 $('bound-wallet-note').textContent=boundWallet
   ?'Last observed '+new Date(boundWallet.occurred_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
   :'Waiting for bound Kina inventory packets';
 if(walletView.combinedExact) {
   $('total-wallet').textContent=num(walletView.allBalance);
   $('total-wallet-note').textContent='Regular + bound, based on latest observed balances';
 } else if(walletView.minimumAll!==null){
   $('total-wallet').textContent='≥ '+num(walletView.minimumAll);
   $('total-wallet-note').textContent='Minimum known; other currency not observed yet';
 } else {
   $('total-wallet').textContent='—';
   $('total-wallet-note').textContent='Waiting for currency readings';
 }
 const net=walletView.netToday;
 $('regular-day-net').textContent=net===null?'—':(net>0?'+':'')+num(net);
 $('regular-day-net').className=net===null?'':net<0?'down':net>0?'up':'';
 $('regular-day-note').textContent=net===null?'Awaiting a second reading today':'Net vs first reading today · not gross earnings';
 $('today-earned').textContent=hasEarned?num(t.dayEarned):'—';
 $('today-spent').textContent=hasSpent?num(t.daySpent):'—';
 $('observed-in').textContent=money.observations>0?num(money.inToday):'—';
 $('observed-out').textContent=money.observations>0?num(money.outToday):'—';
 $('observed-net').textContent=money.observations>0?
   (money.netToday>0?'+':'')+num(money.netToday):'—';
 $('observed-net').className=money.netToday<0?'down':money.netToday>0?'up':'';
 $('observed-in-breakdown').textContent=money.observations>0
  ?'Regular +'+num(money.byCurrency.unbound.in)+' · Bound +'+num(money.byCurrency.bound.in)
  :'Awaiting a captured Kina balance';
 $('observed-out-breakdown').textContent=money.observations>0
  ?'Regular −'+num(money.byCurrency.unbound.out)+' · Bound −'+num(money.byCurrency.bound.out)
  :'Awaiting a captured Kina balance';
 const movementRows=$('movement-rows');
 movementRows.replaceChildren();
 if(!money.changes.length) {
   const empty=document.createElement('div');empty.className='empty';
   empty.textContent=money.observations===0
    ?'No capture-session wallet readings yet. Open Aion 2 to establish a baseline.'
    :'No changes observed after the first reading. Spending or claiming a payout can produce a new wallet update.';
   movementRows.append(empty);
 }
 for(const movement of money.changes.slice(0,9)) {
   const row=document.createElement('div');row.className='movement-row';
   const info=document.createElement('div');
   const label=document.createElement('span');label.className='activity-name';
   label.textContent=(movement.currency==='unbound'?'Regular':'Bound')+' Kina '+(movement.direction==='in'?'in':'out');
   const details=document.createElement('span');details.className='movement-source';
   const association=itemByWalletId.get(movement.id);
   const itemName=association?window.AtreiaItems.name(association.item_id):null;
   details.textContent='Balance '+num(movement.before)+' → '+num(movement.after)+
     (association?' · Possible '+(movement.direction==='out'?'purchase':'sale')+': '+
       itemName+' ×'+num(association.quantity)+' (unverified)'
       :' · source unknown');
   info.append(label,details);
   const amount=document.createElement('strong');
   amount.className=movement.direction==='in'?'up':'down';
   amount.textContent=(movement.direction==='in'?'+':'−')+num(movement.amount);
   const when=document.createElement('time');
   when.dateTime=movement.occurred_at;
   when.textContent=new Date(movement.occurred_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
   row.append(info,amount,when);movementRows.append(row);
 }
 const itemGroups=$('item-groups');
 itemGroups.replaceChildren();
 if(!itemEconomy.groups.length){
   const empty=document.createElement('div');empty.className='empty';
   empty.textContent=itemEconomy.itemChanges
    ?'Item movements detected, but no one-to-one Kina match yet. Transactions involving multiple items remain unassigned.'
    :'No item changes detected yet. A full inventory snapshot on login is needed before the companion can follow stack quantities.';
   itemGroups.append(empty);
 }
 for(const group of itemEconomy.groups.slice(0,30)){
   const row=document.createElement('div');row.className='item-group-row';
   const detail=document.createElement('div');
   const name=document.createElement('strong');name.textContent=window.AtreiaItems.name(group.item_id);
   const sub=document.createElement('span');sub.className='movement-source';
   sub.textContent='Item #'+group.item_id+' · '+group.observations+
    ' observed '+(group.direction==='out'?'spend':'receipt')+(group.observations===1?'':'s')+
    ' · '+(group.currency==='bound'?'Bound':'Regular')+' Kina';
   detail.append(name,sub);
   const qty=document.createElement('span');qty.className='item-group-qty';
   qty.textContent='×'+num(group.totalQuantity);
   const price=document.createElement('span');price.className='item-group-cost';
   const isSpend=group.direction==='out';
   price.classList.add(isSpend?'down':'up');
   price.textContent=(isSpend?'−':'+')+num(group.totalKina)+' Kina';
   const caption=document.createElement('small');
   caption.className='item-group-caption';
   caption.textContent='Possible '+(isSpend?'purchase':'sale')+' · '+num(Math.round(group.totalKina/group.totalQuantity))+' each · unverified';
   const amountWrap=document.createElement('div');amountWrap.append(price,caption);
   row.append(detail,qty,amountWrap);itemGroups.append(row);
 }
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
      e.type==='wallet_snapshot'?(e.currency_kind==='unbound'?'Regular Kina observed':e.currency_kind==='bound'?'Bound Kina observed':'Wallet observed'):labels[e.key]||e.key;
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
for(const name of ['overview','diagnostics']) {
 $('nav-'+name).addEventListener('click',()=>setView(name));
}
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
 if(type==='wallet_snapshot'){
   record.balance=amount;
   record.currency_kind=$('entry-currency-kind').value;
 }
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
api.onChange(refresh);entryKind();setView('overview');refresh();
setInterval(refresh,60000);
