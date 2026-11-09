'use strict';
// A wallet debit remains unattributed unless a confirmation prompt and the
// exact decoded Kina decrease were previously matched for this character.
(function(root) {
 function feeSources(observations,character,server) {
  const sourceByWallet=new Map();
  const key=(x,y)=>String(x||'').trim().toLowerCase()+'/'+String(y||'').trim().toLowerCase();
  const owner=key(character,server);
  for(const row of Array.isArray(observations)?observations:[]) {
   if(!row||key(row.character,row.server)!==owner ||
      row.status!=='corroborated'||row.screen_phase!=='confirmation' ||
      !Number.isSafeInteger(row.fee)||row.fee<=0||
      !Array.isArray(row.wallet_event_ids))continue;
   for(const id of row.wallet_event_ids) {
    if(typeof id==='string'&&id.length>0 && id.length<=128)
     sourceByWallet.set(id,row);
   }
  }
  return sourceByWallet;
 }
 const api={feeSources};
 if(root)root.AtreiaMarketAttribution=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
