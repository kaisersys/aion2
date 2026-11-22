'use strict';
// A displayed registration fee is a quote. Corroborate with a real observed
// debit, or with a net wallet movement adjusted by independently recognized
// monster reward notifications. Never create spending from the quote alone.
const {charKey}=require('./ledger.cjs');
const {movements}=require('./wallets.js');
const WINDOW_BEFORE_MS=15000;
const WINDOW_AFTER_MS=90000;
const SPLIT_MS=3000;
const GAIN_BEFORE_MS=2500;
const GAIN_AFTER_MS=10000;
function validCandidate(x) {
 return x && x.status==='unverified' &&
  (x.kind==='listing_observation'||x.kind==='listing_fee_observation') &&
  Number.isSafeInteger(x.fee)&&x.fee>0 &&
  Number.isFinite(Date.parse(x.occurred_at)) &&
  typeof x.character==='string'&&typeof x.server==='string';
}
function reconcileFees(observations,events,now=Date.now(),rewardNotices=[]) {
 const rows=Array.isArray(observations)?observations:[];
 const pending=rows.filter(validCandidate)
  .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
 const consumed=new Set(rows.filter(x=>x?.status==='corroborated'&&Array.isArray(x.wallet_event_ids))
  .flatMap(x=>x.wallet_event_ids));
 const consumedRewards=new Set(rows.filter(x=>x?.status==='corroborated'&&Array.isArray(x.reward_observation_ids))
  .flatMap(x=>x.reward_observation_ids));
 const byCharacter=new Map();
 let matched=0;
 for(const row of pending) {
  const candidateTime=Date.parse(row.occurred_at);
  if(candidateTime>now+60000||candidateTime<now-3600000)continue;
  const key=charKey(row.character,row.server);
  if(!byCharacter.has(key)) {
   const characterEvents=(Array.isArray(events)?events:[]).filter(e=>
    charKey(e.character,e.server)===key);
   byCharacter.set(key,movements(characterEvents,0).changes.filter(w=>
    (w.currency==='bound'||w.currency==='unbound'||w.currency==='all') &&
    typeof w.id==='string' && Number.isSafeInteger(w.amount) && w.amount>0
   ));
  }
  const possible=byCharacter.get(key).filter(w=>
   !consumed.has(w.id)&&Date.parse(w.occurred_at)>=candidateTime-WINDOW_BEFORE_MS &&
   Date.parse(w.occurred_at)<=candidateTime+WINDOW_AFTER_MS);
  const exact=possible.filter(w=>w.direction==='out'&&w.amount===row.fee);
  let used=[],currency=null,rewards=[],method='exact_debit';
  // The individual debit is preferred to a net-flow inference.
  if(exact.length===1){used=exact;currency=exact[0].currency;}
  else if(exact.length>1)continue;
  else {
   const pairs=[];
   const debits=possible.filter(w=>w.direction==='out'&&w.currency!=='all');
   for(let i=0;i<debits.length;i++)for(let j=i+1;j<debits.length;j++){
    const a=debits[i],b=debits[j];
    if(a.currency===b.currency||a.amount+b.amount!==row.fee||
       Math.abs(Date.parse(a.occurred_at)-Date.parse(b.occurred_at))>SPLIT_MS)continue;
    pairs.push([a,b]);
   }
   if(pairs.length===1){used=pairs[0];currency='mixed';method='split_debit';}
   else if(pairs.length>1)continue;
   else {
    // Within a single pending listing, a monster reward can offset some or
    // all of a registration fee. Count only observed reward popups belonging
    // to the same character, rather than guessing an unknown source.
    const adjusted=[];
    for(const w of possible) {
     const at=Date.parse(w.occurred_at);
     if(at<candidateTime||at>candidateTime+WINDOW_AFTER_MS)continue;
     const gains=(Array.isArray(rewardNotices)?rewardNotices:[]).filter(g=>
      g&&typeof g.id==='string'&&!consumedRewards.has(g.id)&&
      charKey(g.character,g.server)===key&&Number.isSafeInteger(g.amount)&&g.amount>0&&
      Number.isFinite(Date.parse(g.occurred_at))&&
      Date.parse(g.occurred_at)>=candidateTime-GAIN_BEFORE_MS&&
      Date.parse(g.occurred_at)<=at+GAIN_AFTER_MS);
     // Do not infer a fee from a wallet delta unless all of the observed
     // notices in that window exactly explain fee + net movement.
     const gainSum=gains.reduce((sum,g)=>sum+g.amount,0);
     if(gainSum>0 && Number.isSafeInteger(gainSum) && gainSum-w.delta===row.fee)
      adjusted.push({w,gains});
    }
    if(adjusted.length!==1)continue;
    used=[adjusted[0].w];currency=used[0].currency;
    rewards=adjusted[0].gains;method='net_with_monster_rewards';
   }
  }
  row.status='corroborated';
  row.currency_kind=currency;
  row.reconciliation_method=method;
  row.wallet_event_ids=used.map(w=>w.id).sort();
  row.reward_observation_ids=rewards.map(g=>g.id).sort();
  row.synced=false;
  for(const w of used)consumed.add(w.id);
  for(const g of rewards)consumedRewards.add(g.id);
  matched++;
 }
 return matched;
}
module.exports={reconcileFees,WINDOW_BEFORE_MS,WINDOW_AFTER_MS};
