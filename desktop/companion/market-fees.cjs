'use strict';
// Separate OCR fee quotations from corroborated wallet spending.
// A wallet decrease can corroborate the amount, but not prove a Market listing
// was submitted. Do not create a "Kinah spent" event from OCR alone.
const {charKey}=require('./ledger.cjs');
const {movements}=require('./wallets.js');
const WINDOW_BEFORE_MS=1500;
const WINDOW_AFTER_MS=45000;
const SPLIT_MS=3000;
function validCandidate(x) {
 return x && x.status==='unverified' && x.screen_phase==='confirmation' &&
  (x.kind==='listing_observation'||x.kind==='listing_fee_observation') &&
  Number.isSafeInteger(x.fee)&&x.fee>0 &&
  Number.isFinite(Date.parse(x.occurred_at)) &&
  typeof x.character==='string'&&typeof x.server==='string';
}
function reconcileFees(observations,events,now=Date.now()) {
 const pending=(Array.isArray(observations)?observations:[]).filter(validCandidate)
  .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
 const consumed=new Set((Array.isArray(observations)?observations:[])
  .filter(x=>x?.status==='corroborated'&&Array.isArray(x.wallet_event_ids))
  .flatMap(x=>x.wallet_event_ids));
 const byCharacter=new Map();
 let matched=0;
 for(const row of pending) {
  const candidateTime=Date.parse(row.occurred_at);
  const lastSeen=Number.isFinite(Date.parse(row.last_seen_at))?
   Math.max(candidateTime,Date.parse(row.last_seen_at)):candidateTime;
  if(candidateTime>now+60000 || lastSeen<now-3600000)continue;
  const key=charKey(row.character,row.server);
  if(!byCharacter.has(key)) {
   const characterEvents=(Array.isArray(events)?events:[]).filter(e=>
    charKey(e.character,e.server)===key);
   byCharacter.set(key,movements(characterEvents,0).changes.filter(w=>
    w.direction==='out' && (w.currency==='bound'||w.currency==='unbound') &&
    typeof w.id==='string' && Number.isSafeInteger(w.amount) && w.amount>0
   ));
  }
  const possible=byCharacter.get(key).filter(w=>
   !consumed.has(w.id) && Date.parse(w.occurred_at)>=candidateTime-WINDOW_BEFORE_MS &&
   Date.parse(w.occurred_at)<=lastSeen+WINDOW_AFTER_MS);
  const exact=possible.filter(w=>w.amount===row.fee);
  let used=[],currency=null;
  // Multiple equal debits cannot uniquely identify which one is the fee.
  if(exact.length===1){used=exact;currency=exact[0].currency;}
  else if(exact.length>1)continue;
  else {
   const pairs=[];
   for(let i=0;i<possible.length;i++)for(let j=i+1;j<possible.length;j++) {
    const a=possible[i],b=possible[j];
    if(a.currency===b.currency || a.amount+b.amount!==row.fee ||
       Math.abs(Date.parse(a.occurred_at)-Date.parse(b.occurred_at))>SPLIT_MS)continue;
    pairs.push([a,b]);
   }
   if(pairs.length!==1)continue;
   used=pairs[0];currency='mixed';
  }
  // The game displayed a Confirm/Cancel dialog, and the exact fee matches
  // one subsequently decoded debit. This is evidence of payment, not a
  // definitive server acknowledgement. A canceled prompt alone cannot count.
  row.status='corroborated';
  row.currency_kind=currency;
  row.wallet_event_ids=used.map(w=>w.id).sort();
  row.synced=false; // updates previously-uploaded OCR observations
  for(const w of used)consumed.add(w.id);
  matched++;
 }
 return matched;
}
module.exports={reconcileFees,WINDOW_BEFORE_MS,WINDOW_AFTER_MS};
