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
  const exported={calculate};
  if(typeof module!=='undefined' && module.exports)module.exports=exported;
  if(root)root.AtreiaWallets=exported;
})(typeof window!=='undefined'?window:null);
