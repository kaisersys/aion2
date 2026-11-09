'use strict';
// Conservative English UI parser. Only structured, recognizable Market views
// become screen observations. They are never asserted to be completed trades
// or wallet transactions without independent evidence.
const crypto=require('node:crypto');
const MAX_AMOUNT=100_000_000_000_000;
const MARKET_RE=/(?:\bmarket(?:place)?\b|\btrade broker\b|\bauction house\b)/i;
const CURRENCY_RE=/\b(?:kina|kinah)\b/i;
const NUMBER='([0-9][0-9, ]{0,16})';
function positive(raw) {
 if(typeof raw!=='string' || !/^[0-9][0-9, ]*$/.test(raw))return null;
 const n=Number(raw.replace(/[ ,]/g,''));
 return Number.isSafeInteger(n)&&n>0&&n<=MAX_AMOUNT?n:null;
}
function field(lines,names) {
 for(const name of names) {
  const label=new RegExp('^\\s*(?:'+name+')\\s*[:：-]?\\s*(.+?)\\s*$','i');
  for(const line of lines) {
   const match=line.match(label);
   if(match && match[1])return match[1].trim();
  }
 }
 return '';
}
function amount(lines,names) {
 const raw=field(lines,names);
 const first=raw.match(new RegExp('^\\s*'+NUMBER+'\\s*(?:kina|kinah)?\\b','i'));
 return first?positive(first[1]):null;
}
function itemName(lines) {
 const raw=field(lines,['item(?: name)?','product(?: name)?']);
 const value=raw.replace(/\s*[x×]\s*[0-9,]+\s*$/,'').trim();
 if(value.length<2 || value.length>80 ||
    !/^[\p{L}\p{N}][\p{L}\p{N} '()\[\]–.,+\-]{1,79}$/u.test(value))
  return null;
 // Reject generic labels accidentally parsed as an item.
 if(/^(?:price|quantity|total|listing|fee|settlement|purchase|market)$/i.test(value))return null;
 return value;
}
function parseMarketText(raw) {
 if(typeof raw!=='string')return null;
 const text=raw.slice(0,7500).normalize('NFKC');
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,120);
 if(!MARKET_RE.test(text) || !CURRENCY_RE.test(text))return null;
 const item_name=itemName(lines);
 const quantity=amount(lines,['quantity','qty','amount of items','count']);
 if(!item_name || !quantity || quantity>1_000_000_000)return null;
 let kind,unit_price=null,gross=null,listing_fee=null,proceeds=null;
 // Recognize field combinations rather than tab names: Market navigation can
 // show "Buy", "Sell" and "Settlement" at the same time.
 const fee=amount(lines,['registration fee','listing fee','registration cost']);
 const settlementAmount=amount(lines,['proceeds','settlement amount','net received','amount to receive']);
 const isListing=fee!==null && /\b(?:register|listing|registration|sell)\b/i.test(text);
 const isSettlement=settlementAmount!==null && /\b(?:settlement|sale proceeds|sales history)\b/i.test(text);
 if(isListing && isSettlement)return null;
 if(isListing) {
  kind=/\b(?:listed successfully|registration complete|listing completed)\b/i.test(text)
   ?'listing_confirmed_screen':'listing_preview';
  unit_price=amount(lines,['unit price','price per item','price each','sale price']);
  gross=amount(lines,['total price','total sale price','gross(?: value)?','total amount']);
  listing_fee=fee;
  if(!(unit_price||gross))return null;
 } else if(isSettlement) {
  kind=/\b(?:claimed successfully|claim completed|proceeds claimed)\b/i.test(text)
   ?'settlement_claimed_screen':'settlement_visible';
  proceeds=settlementAmount;
  gross=amount(lines,['gross sales?','sale total','total sale price']);
 } else if(/\b(?:purchase|buy now|buy item)\b/i.test(text) &&
           fee===null && settlementAmount===null) {
  kind='purchase_preview';
  unit_price=amount(lines,['unit price','price per item','price each']);
  gross=amount(lines,['total price','total cost','purchase price']);
  if(!gross && !unit_price)return null;
 } else return null;
 return {kind,item_name,quantity,unit_price,gross,listing_fee,proceeds,
  evidence:'screen_observed',currency_kind:'unknown'};
}
function signature(observation,character,server,day) {
 const fields=['kind','item_name','quantity','unit_price','gross','listing_fee','proceeds'];
 const content=[character.toLowerCase(),server.toLowerCase(),day,...fields.map(k=>observation[k]??'')].join('|');
 return crypto.createHash('sha256').update(content).digest('hex');
}
function validateMarketObservation(raw) {
 if(!raw||typeof raw!=='object' || ![
  'listing_preview','listing_confirmed_screen','settlement_visible',
  'settlement_claimed_screen','purchase_preview'
 ].includes(raw.kind))return false;
 if(raw.evidence!=='screen_observed' || raw.currency_kind!=='unknown' ||
    typeof raw.item_name!=='string' || raw.item_name.length<2 || raw.item_name.length>80 ||
    !Number.isSafeInteger(raw.quantity) || raw.quantity<1 || raw.quantity>1_000_000_000)return false;
 for(const k of ['unit_price','gross','listing_fee','proceeds'])
  if(raw[k]!==null && raw[k]!==undefined && (!Number.isSafeInteger(raw[k])||raw[k]<=0||raw[k]>MAX_AMOUNT))return false;
 if(raw.kind.startsWith('listing') && !raw.listing_fee)return false;
 if(raw.kind.startsWith('settlement') && !raw.proceeds)return false;
 return true;
}
module.exports={parseMarketText,validateMarketObservation,signature};
