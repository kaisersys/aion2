'use strict';
// Shared between the full companion and mini overlay. This calculation is
// independent of item IDs: the capture decoder must label each observation.
(function publishWalletModel(root) {
  function calculate(events, dayStart) {
    const wallets = {regular:null, bound:null};
    let regularDayFirst=null, regularDayLast=null, regularDayReadings=0;
    const ordered=(Array.isArray(events)?events:[]).filter(e=>e && e.type==='wallet_snapshot' &&
      Number.isSafeInteger(e.balance) && e.balance>=0 && Number.isFinite(Date.parse(e.occurred_at)))
      .sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
    for(const e of ordered) {
      if(e.currency_kind==='unbound') {
        wallets.regular={balance:e.balance,occurred_at:e.occurred_at};
        if(Date.parse(e.occurred_at)>=dayStart) {
          if(regularDayFirst===null)regularDayFirst=e.balance;
          regularDayLast=e.balance;
          regularDayReadings++;
        }
      }
      else if(e.currency_kind==='bound') wallets.bound={balance:e.balance,occurred_at:e.occurred_at};
      // Other/legacy wallet snapshots must not overwrite an explicitly labeled wallet.
    }
    const regular=wallets.regular?.balance??null;
    const bound=wallets.bound?.balance??null;
    const exact=regular!==null && bound!==null;
    // Combined amount is never a separately captured currency. Do not display zero
    // when regular Kina is observed and the bound wallet has not yet been detected.
    const all=exact?regular+bound:null;
    const minimum=regular!==null?regular:bound;
    const netToday=regularDayReadings>=2?regularDayLast-regularDayFirst:null;
    return {...wallets,regularBalance:regular,boundBalance:bound,allBalance:all,
      minimumAll:minimum,combinedExact:exact,netToday};
  }
  // This is a ledger of OBSERVED CHANGES, not a sales or purchase ledger.
  // Opposite market actions and ordinary loot can share the same currency opcode;
  // no economic cause is attached without a separately verified source message.
  const MAX_MOVEMENT_GAP_MS=20*60*1000;
  function movements(events,dayStart) {
    const previous={unbound:null,bound:null};
    const byCurrency={unbound:{in:0,out:0},bound:{in:0,out:0}};
    const changes=[];
    let observations=0;
    const seen=new Set();
    const ordered=(Array.isArray(events)?events:[]).filter(e=>
      e && e.type==='wallet_snapshot' && e.source==='decoded' &&
      (e.currency_kind==='unbound'||e.currency_kind==='bound') &&
      Number.isSafeInteger(e.balance) && e.balance>=0 &&
      typeof e.observation_session==='string' &&
      /^[0-9a-f]{32}$/.test(e.observation_session) &&
      Number.isFinite(Date.parse(e.occurred_at))
    ).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
    for(const event of ordered) {
      const id=String(event.id||'');
      if(id && seen.has(id))continue;
      if(id)seen.add(id);
      const key=event.currency_kind,at=Date.parse(event.occurred_at);
      observations++;
      const before=previous[key];
      previous[key]={balance:event.balance,occurred_at:at,session:event.observation_session};
      if(!before || before.session!==event.observation_session)continue;
      const gap=at-before.occurred_at;
      if(gap<0 || gap>MAX_MOVEMENT_GAP_MS)continue;
      const delta=event.balance-before.balance;
      if(!delta || !Number.isSafeInteger(delta))continue;
      const kind=delta>0?'in':'out',amount=Math.abs(delta);
      const row={currency:key,direction:kind,amount,delta,
        before:before.balance,after:event.balance,
        occurred_at:event.occurred_at,id:event.id,session:event.observation_session};
      changes.push(row);
      if(at>=dayStart)byCurrency[key][kind]+=amount;
    }
    const inToday=byCurrency.unbound.in+byCurrency.bound.in;
    const outToday=byCurrency.unbound.out+byCurrency.bound.out;
    return {inToday,outToday,netToday:inToday-outToday,
      byCurrency,observations,changes:changes.slice(-150).reverse()};
  }
  const exported={calculate,movements,MAX_MOVEMENT_GAP_MS};
  if(typeof module!=='undefined' && module.exports)module.exports=exported;
  if(root)root.AtreiaWallets=exported;
})(typeof window!=='undefined'?window:null);
