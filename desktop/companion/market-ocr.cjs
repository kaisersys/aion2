'use strict';
// Conservative on-device OCR parser. A quoted fee is not proof of payment.
const MAX_AMOUNT=100000000000000;
function amount(raw) {
 if(typeof raw!=='string'||!/^[0-9][0-9,. ]{0,23}$/.test(raw.trim()))return null;
 const digits=raw.replace(/[,. ]/g,'');
 const n=Number(digits);
 return Number.isSafeInteger(n)&&n>0&&n<=MAX_AMOUNT?n:null;
}
function clean(text) {
 return String(text||'').replace(/\r/g,'').split('\n')
  .map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,120);
}
const FEE=/\b(?:registration\s*fee|listing\s*fee|register\s*fee|fee\s*for\s*registration)\b/i;
const TOTAL=/\b(?:total\s+sale\s+price|total\s+price|total\s+listing\s+price|total\s+amount)\b/i;
const UNIT=/\b(?:sale\s+price\s+per\s+item|unit\s+price|price\s+per\s+item|asking\s+price)\b/i;
const PROCEEDS=/\b(?:settlement\s+amount|settlement\s+proceeds|sale\s+proceeds|receive\s+amount|amount\s+received|claimable\s+amount)\b/i;
const QUANTITY=/\b(?:sale\s+quantity|quantity|qty|count)\b/i;
const ITEM=/\b(?:item\s+name|item)\b\s*[:：]\s*(.{2,80})$/i;
function parseValue(raw) {
 if(typeof raw!=='string')return null;
 const remainder=raw.replace(/^[\s:：=]+/,'')
   .replace(/^\(\s*[0-9]+(?:\.[0-9]+)?\s*%\s*\)\s*/,'').trim();
 const match=remainder.match(/^(?:(?:kinah|kina)\s+)?([0-9][0-9,. ]{0,23})\s*(?:(?:kinah|kina))?$/i);
 return match?amount(match[1]):null;
}
function field(lines,label) {
 const values=[];
 for(let i=0;i<lines.length;i++) {
  const match=lines[i].match(label);
  if(!match)continue;
  const remainder=lines[i].slice(match.index+match[0].length);
  const inline=parseValue(remainder);
  if(inline!==null){values.push(inline);continue;}
  // The Market draws many labels above their values. Accept the next line
  // ONLY when it consists of a standalone Kina number, not an unrelated field.
  if(!remainder.trim() && i+1<lines.length) {
   const next=parseValue(lines[i+1]);
   if(next!==null)values.push(next);
  }
 }
 if(!values.length)return null;
 return values.every(v=>v===values[0])?values[0]:Number.NaN;
}
function readMarket(text) {
 const lines=clean(text);
 if(!lines.length)return {status:'empty'};
 const hasMarket=lines.some(s=>/\b(?:market|marketplace|world\s+market|trade\s+broker|auction\s+house|sales\s+registration)\b/i.test(s));
 const hasFeeLabel=lines.some(s=>FEE.test(s));
 const hasQuantityLabel=lines.some(s=>/\b(?:sale\s+quantity|sale\s+price\s+per\s+item|total\s+sale\s+price)\b/i.test(s));
 const hasProceeds=lines.some(s=>PROCEEDS.test(s));
 // The tab named "Settlement" is visible even while listing an item. Do not
 // treat that tab alone as a conflicting sale-settlement event.
 if(!hasMarket && !(hasFeeLabel&&hasQuantityLabel) && !hasProceeds)
  return {status:'unrecognized'};
 const listing=hasFeeLabel && (hasMarket||hasQuantityLabel);
 const settlement=hasProceeds;
 if(listing&&settlement)return {status:'ambiguous'};
 if(!listing&&!settlement)return {status:'incomplete'};
 const qty=field(lines,QUANTITY);
 if(Number.isNaN(qty)||(qty!==null&&qty>1000000))return {status:'incomplete'};
 const names=lines.map(s=>s.match(ITEM)).filter(Boolean);
 const item=names.length===1?names[0][1].trim():null;
 if(settlement) {
  const proceeds=field(lines,PROCEEDS);
  if(proceeds===null||Number.isNaN(proceeds))return {status:'incomplete',kind:'settlement_observation'};
  return {status:'observed',evidence:{
   kind:'settlement_observation',amount:proceeds,fee:null,quantity:qty,item_name:item
  }};
 }
 const fee=field(lines,FEE);
 if(fee===null||Number.isNaN(fee))return {status:'incomplete',kind:'listing_fee_observation'};
 let price=field(lines,TOTAL);
 if(Number.isNaN(price))return {status:'incomplete',kind:'listing_observation'};
 if(price===null) {
  const unit=field(lines,UNIT);
  if(Number.isNaN(unit))return {status:'incomplete',kind:'listing_observation'};
  if(unit!==null && qty!==null && Number.isSafeInteger(unit*qty) && unit*qty<=MAX_AMOUNT)
   price=unit*qty;
 }
 if(price!==null&&price<fee)return {status:'incomplete',kind:'listing_observation'};
 return {status:'observed',evidence:{
  kind:price===null?'listing_fee_observation':'listing_observation',
  amount:price===null?fee:price,fee,quantity:qty,item_name:item
 }};
}
function stableFingerprint(character,server,evidence) {
 const crypto=require('node:crypto');
 return crypto.createHash('sha256').update(JSON.stringify([
  character,server,evidence.kind,evidence.amount,evidence.fee,
  evidence.quantity,evidence.item_name
 ])).digest('hex');
}
module.exports={readMarket,amount,stableFingerprint};
