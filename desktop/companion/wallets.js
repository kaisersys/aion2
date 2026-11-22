'use strict';
// Local wallet model. Packet and independently confirmed screen readings are kept
// separate; only equal, near-simultaneous deltas are coalesced.
(function publishWalletModel(root) {
 function calculate(events,dayStart) {
  const wallets={regular:null,bound:null,screenAll:null};
  const latestScreen={unbound:null,bound:null};
  let regularDayFirst=null,regularDayLast=null,regularDayReadings=0;
  const ordered=(Array.isArray(events)?events:[]).filter(e=>e&&e.type==='wallet_snapshot'&&
   Number.isSafeInteger(e.balance)&&e.balance>=0&&Number.isFinite(Date.parse(e.occurred_at)))
   .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  for(const e of ordered) {
   const value={balance:e.balance,occurred_at:e.occurred_at,source:e.source||'manual'};
   if(e.currency_kind==='unbound') {
    wallets.regular=value;
    if(e.source==='screen')latestScreen.unbound=value;
    if(Date.parse(e.occurred_at)>=dayStart) {
     if(regularDayFirst===null)regularDayFirst=e.balance;
     regularDayLast=e.balance;regularDayReadings++;
    }
   } else if(e.currency_kind==='bound'){
    wallets.bound=value;
    if(e.source==='screen')latestScreen.bound=value;
   }
   else if(e.currency_kind==='all'&&e.source==='screen')wallets.screenAll=value;
  }
  // A packet arriving seconds after a verified screen image can describe an
  // earlier server snapshot. Give the nearby on-screen counter precedence
  // until a later packet or subsequent OCR reading supersedes it.
  for(const [key,kind] of [['regular','unbound'],['bound','bound']]){
   const current=wallets[key],screen=latestScreen[kind];
   if(screen&&current&&current.source!=='screen'&&
      Date.parse(current.occurred_at)-Date.parse(screen.occurred_at)<=8000)
    wallets[key]=screen;
  }
  const regular=wallets.regular?.balance??null,bound=wallets.bound?.balance??null;
  const both=regular!==null&&bound!==null;
  const derived=both?regular+bound:null;
  const screen=wallets.screenAll;
  // A labeled All counter wins when it is the newest observation. It is not
  // accidentally interpreted as Bound or an independent third wallet.
  const componentTimestamp=Math.max(
   wallets.regular?Date.parse(wallets.regular.occurred_at):0,
   wallets.bound?Date.parse(wallets.bound.occurred_at):0);
  // A once-visible All counter cannot remain an "exact live balance" forever
  // while the packet decoder continues reporting newer component changes.
  const screenIsLatest=Boolean(screen&&
   (componentTimestamp===0||componentTimestamp-Date.parse(screen.occurred_at)<=8000));
  const exact=Boolean(both||screenIsLatest);
  const all=screenIsLatest?screen.balance:derived;
  const minimum=regular!==null?regular:bound;
  const netToday=regularDayReadings>=2?regularDayLast-regularDayFirst:null;
  return {...wallets,regularBalance:regular,boundBalance:bound,allBalance:all,
   minimumAll:minimum,combinedExact:exact,netToday,
   combinedSource:screenIsLatest?'screen':both?'sum':null};
 }
 // A movement is a change between two observations from the SAME stream,
 // currency and capture session. Screen and packet movements that describe the
 // same change must never be added twice.
 const MAX_MOVEMENT_GAP_MS=20*60*1000;
 const CROSS_SOURCE_WINDOW_MS=8000;
 function movements(events,dayStart) {
  const previous=new Map(),candidates=[],seen=new Set();
  let observations=0;
  const ordered=(Array.isArray(events)?events:[]).filter(e=>
   e&&e.type==='wallet_snapshot'&&(e.source==='decoded'||e.source==='screen')&&
   (e.currency_kind==='unbound'||e.currency_kind==='bound'||
    (e.currency_kind==='all'&&e.source==='screen'))&&
   Number.isSafeInteger(e.balance)&&e.balance>=0&&
   typeof e.observation_session==='string'&&/^[0-9a-f]{32}$/.test(e.observation_session)&&
   Number.isFinite(Date.parse(e.occurred_at))
  ).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  for(const event of ordered) {
   const id=String(event.id||'');
   if(id&&seen.has(id))continue;
   if(id)seen.add(id);
   observations++;
   const key=event.currency_kind+'|'+event.source,at=Date.parse(event.occurred_at);
   const before=previous.get(key);
   previous.set(key,{balance:event.balance,at,session:event.observation_session});
   if(!before||before.session!==event.observation_session)continue;
   const gap=at-before.at;
   if(gap<0||gap>MAX_MOVEMENT_GAP_MS)continue;
   const delta=event.balance-before.balance;
   if(!delta||!Number.isSafeInteger(delta))continue;
   candidates.push({
    currency:event.currency_kind,direction:delta>0?'in':'out',amount:Math.abs(delta),delta,
    before:before.balance,after:event.balance,occurred_at:event.occurred_at,
    id:event.id,session:event.observation_session,source:event.source
   });
  }
  const packet=candidates.filter(r=>r.source==='decoded');
  const screen=candidates.filter(r=>r.source==='screen'&&r.currency!=='all');
  const screenTotal=candidates.filter(r=>r.source==='screen'&&r.currency==='all');
  // When independent streams disagree within the same short interval, prefer
  // the decoded packet and flag the discrepancy instead of inventing a second
  // spend or gain from OCR.
  let crossSourceDisagreements=0;
  const matched=[];
  for(const row of screen) {
   const possible=packet.filter(p=>p.currency===row.currency&&
    Math.abs(Date.parse(p.occurred_at)-Date.parse(row.occurred_at))<=CROSS_SOURCE_WINDOW_MS);
   if(possible.length) {
    if(!possible.some(p=>p.delta===row.delta))crossSourceDisagreements++;
    continue;
   }
   matched.push(row);
  }
  const componentChanges=packet.concat(matched);
  // A combined-only counter can still prove the total changed. Keep those
  // changes separately and suppress them if individual wallet movements
  // already cover the same period, avoiding double-counted expenses.
  const combinedOnly=screenTotal.filter(row=>!componentChanges.some(part=>
   Math.abs(Date.parse(part.occurred_at)-Date.parse(row.occurred_at))<=CROSS_SOURCE_WINDOW_MS));
  const changes=componentChanges.concat(combinedOnly).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  const byCurrency={unbound:{in:0,out:0},bound:{in:0,out:0},all:{in:0,out:0}};
  for(const row of changes)if(Date.parse(row.occurred_at)>=dayStart)
   byCurrency[row.currency][row.direction]+=row.amount;
  const inToday=byCurrency.unbound.in+byCurrency.bound.in+byCurrency.all.in;
  const outToday=byCurrency.unbound.out+byCurrency.bound.out+byCurrency.all.out;
  return {inToday,outToday,netToday:inToday-outToday,byCurrency,observations,
   crossSourceDisagreements,changes:changes.slice(-150).reverse()};
 }
 const exported={calculate,movements,MAX_MOVEMENT_GAP_MS,CROSS_SOURCE_WINDOW_MS};
 if(typeof module!=='undefined'&&module.exports)module.exports=exported;
 if(root)root.AtreiaWallets=exported;
})(typeof window!=='undefined'?window:null);
