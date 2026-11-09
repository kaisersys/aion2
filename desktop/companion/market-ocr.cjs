'use strict';
// OCR is fallible. This module only extracts explicitly labelled Market fields.
// Never turn a nearby wallet delta into a Market sale or a fee.
const MAX_AMOUNT=100000000000000;
function amount(raw) {
 if(typeof raw!=='string' || !/^[0-9][0-9,. ]{0,23}$/.test(raw.trim()))return null;
 const digits=raw.replace(/[,. ]/g,'');
 const n=Number(digits);
 return Number.isSafeInteger(n)&&n>0&&n<=MAX_AMOUNT?n:null;
}
function clean(text) {
 return String(text||'').replace(/\r/g,'').split('\n')
  .map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,100);
}
const price=/\b(?:price|unit price|total price|sale price|asking price)\b\s*[:：]?\s*([0-9][0-9,. ]{0,23})\b/i;
const fee=/\b(?:listing fee|registration fee|register fee)\b\s*[:：]?\s*([0-9][0-9,. ]{0,23})\b/i;
const proceeds=/\b(?:settlement amount|settlement proceeds|sale proceeds|receive amount|amount received)\b\s*[:：]?\s*([0-9][0-9,. ]{0,23})\b/i;
const quantity=/\b(?:quantity|qty|count)\b\s*[:：]?\s*([0-9][0-9,. ]{0,15})\b/i;
const itemName=/\b(?:item name|item)\b\s*[:：]\s*(.{2,80})$/i;
function field(lines,re) {
 const found=lines.map(line=>line.match(re)).filter(Boolean);
 if(found.length!==1)return null;
 return amount(found[0][1]);
}
function readMarket(text) {
 const lines=clean(text);
 if(!lines.some(s=>/\b(?:market|marketplace|trade broker)\b/i.test(s)))
  return {status:'unrecognized'};
 const listing=lines.some(s=>/\b(?:register item|list item|registration|listing fee)\b/i.test(s));
 const settlement=lines.some(s=>/\b(?:settlement|sale proceeds|amount received)\b/i.test(s));
 if(listing===settlement)return {status:'ambiguous'};
 const kind=listing?'listing_observation':'settlement_observation';
 const sum=field(lines,listing?price:proceeds);
 const cost=listing?field(lines,fee):null;
 const qty=field(lines,quantity);
 const names=lines.map(s=>s.match(itemName)).filter(Boolean);
 const item=names.length===1?names[0][1].trim():null;
 // No single amount, no source-specific record. OCR errors must not create
 // invented fees or proceeds. A listing needs its explicit fee.
 if(sum===null || (listing&&cost===null) || (listing&&cost>sum) ||
    (qty!==null&&qty>1000000))return {status:'incomplete',kind};
 const evidence={kind,amount:sum,fee:cost,quantity:qty,item_name:item};
 return {status:'observed',evidence};
}
function stableFingerprint(character,server,evidence) {
 const crypto=require('node:crypto');
 return crypto.createHash('sha256').update(JSON.stringify([
  character,server,evidence.kind,evidence.amount,evidence.fee,
  evidence.quantity,evidence.item_name
 ])).digest('hex');
}
module.exports={readMarket,amount,stableFingerprint};
