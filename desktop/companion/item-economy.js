'use strict';
// Conservative, local-only event correlation. Neither an item change nor a
// Kina wallet change contains verified Market/NPC transaction provenance.
// The companion therefore calls associations "possible item purchase/sale"
// and NEVER converts them into confirmed sales or purchase ledger entries.
(function(root){
 const WINDOW_MS=4500;
 function attribute(events, walletMovements, dayStart) {
  const eligible=(Array.isArray(events)?events:[]).filter(e=>e &&
   e.type==='item_change' && e.source==='decoded' &&
   Number.isSafeInteger(e.item_id) && e.item_id>=100000000 &&
   e.item_id<1000000000 &&
   Number.isSafeInteger(e.delta) && e.delta!==0 &&
   typeof e.observation_session==='string' &&
   /^[0-9a-f]{32}$/.test(e.observation_session) &&
   Number.isFinite(Date.parse(e.occurred_at)) &&
   Date.parse(e.occurred_at)>=dayStart &&
   Date.parse(e.occurred_at)<=Date.now()+60000
  ).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  // A ground pickup requires three corroborating game messages, not mere timing.
  const byEventId=new Map(eligible.filter(e=>typeof e.id==='string').map(e=>[e.id,e]));
  const confirmedIds=new Set();
  const verifiedGround=[];
  for(const ev of Array.isArray(events)?events:[]) {
   if(!ev || ev.type!=='item_origin' || ev.source!=='decoded' ||
      ev.origin!=='ground_pickup' || typeof ev.item_event_id!=='string' ||
      !Number.isSafeInteger(ev.item_id) || !Number.isSafeInteger(ev.quantity) ||
      ev.quantity<=0 || !Number.isFinite(Date.parse(ev.occurred_at)))continue;
   const item=byEventId.get(ev.item_event_id);
   if(!item || item.item_id!==ev.item_id || item.delta!==ev.quantity ||
      item.observation_session!==ev.observation_session ||
      Math.abs(Date.parse(ev.occurred_at)-Date.parse(item.occurred_at))>1500 ||
      confirmedIds.has(item.id))continue;
   confirmedIds.add(item.id);
   verifiedGround.push({item_id:item.item_id,quantity:item.delta,occurred_at:item.occurred_at});
  }
  const groundByItem=new Map();
  for(const row of verifiedGround) {
   const group=groundByItem.get(row.item_id)||{item_id:row.item_id,totalQuantity:0,observations:0};
   group.totalQuantity+=row.quantity;
   group.observations++;
   groundByItem.set(row.item_id,group);
  }
  // Proven ground loot must never be reported as a possible Market/NPC purchase.
  const candidates=eligible.filter(e=>!confirmedIds.has(e.id));
  const wallets=walletMovements?.changes||[];
  const used=new Set();
  const associations=[],unknown=[];
  const order=[...wallets].filter(r=>Date.parse(r.occurred_at)>=dayStart)
    .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
  for(const wallet of order) {
   // Item received + wallet decrease => possible purchase.
   // Item removed + wallet increase => possible sale.
   const wanted=wallet.direction==='out'?1:-1;
   const time=Date.parse(wallet.occurred_at);
   const matching=candidates.filter(e=>
      !used.has(e.id) && e.observation_session===wallet.session &&
      Math.sign(e.delta)===wanted &&
      Math.abs(Date.parse(e.occurred_at)-time)<=WINDOW_MS
   );
   const byItem=new Map();
   for(const entry of matching) {
     const row=byItem.get(entry.item_id)||{item_id:entry.item_id,quantity:0,entries:[]};
     row.quantity+=Math.abs(entry.delta);
     row.entries.push(entry);
     byItem.set(entry.item_id,row);
   }
   if(byItem.size!==1) {
     unknown.push({...wallet,reason:byItem.size===0?'no nearby matching item':'multiple item types nearby'});
     continue;
   }
   const candidate=[...byItem.values()][0];
   if(candidate.quantity<=0 || !Number.isSafeInteger(candidate.quantity)) {
     unknown.push({...wallet,reason:'invalid item quantity'});continue;
   }
   for(const entry of candidate.entries)used.add(entry.id);
   associations.push({
     walletId:wallet.id,item_id:candidate.item_id,
     direction:wallet.direction,quantity:candidate.quantity,
     currency:wallet.currency,amount:wallet.amount,
     unitCost:wallet.amount/candidate.quantity,
     occurred_at:wallet.occurred_at,
     confidence:'possible',reason:'Nearby item inventory and Kina balance changes; source unverified'
   });
  }
  const byItem=new Map();
  for(const row of associations) {
   const key=row.item_id+'/'+row.currency+'/'+row.direction;
   let group=byItem.get(key);
   if(!group) {
     group={key,item_id:row.item_id,currency:row.currency,
      direction:row.direction,totalKina:0,totalQuantity:0,observations:0};
     byItem.set(key,group);
   }
   group.totalKina+=row.amount;
   group.totalQuantity+=row.quantity;
   group.observations++;
  }
  return {
   matches:associations.slice(-150).reverse(),
   unmatched:unknown.slice(-150).reverse(),
   groups:[...byItem.values()].sort((a,b)=>b.totalKina-a.totalKina),
   itemChanges:eligible.length,
   verifiedGround:verifiedGround.length,
   groundGroups:[...groundByItem.values()].sort((a,b)=>b.totalQuantity-a.totalQuantity),
   windowMs:WINDOW_MS
  };
 }
 const api={attribute,WINDOW_MS};
 if(root)root.AtreiaItemEconomy=api;
 if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
