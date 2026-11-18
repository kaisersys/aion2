'use strict';
// Optional, local-only confirmation of a registration-fee deduction from two
// real AION2 Market "Funds" readings. Never invent packet wallet snapshots.
const {charKey}=require('./ledger.cjs');
const MAX=100000000000000;
const MATCH_WINDOW_MS=60000;
function number(raw) {
 const match=String(raw||'').trim().match(/^(?:(?:kina|kinah)\s+)?(\d[\d,. ]{0,23})(?:\s*(?:kina|kinah|[◎◉ⓞ©@]))?$/iu);
 if(!match)return null;
 const value=Number(match[1].replace(/[,. ]/g,''));
 return Number.isSafeInteger(value)&&value>=0&&value<=MAX?value:null;
}
function readMarketFunds(text) {
 const lines=String(text||'').replace(/\r/g,'').split('\n')
  .map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 // A number labeled "Funds" outside a Market/listing window is not enough.
 if(!lines.some(x=>/\b(?:market|marketplace|registration\s+fee|total\s+sale\s+price|sale\s+quantity|list\s+for\s+sale)\b/i.test(x)))return null;
 const readings=[];
 for(let i=0;i<lines.length;i++) {
  const m=lines[i].match(/^Funds\b/i);
  if(!m)continue;
  const trailing=lines[i].slice(m[0].length).replace(/^[\s:：=]+/,'').trim();
  const value=number(trailing || lines[i+1]);
  if(value!==null)readings.push(value);
 }
 return readings.length&&readings.every(x=>x===readings[0])?readings[0]:null;
}
// The modal may hide Funds. A prior same-character Funds reading is only
// usable within one minute and must precede the confirmation frame.
function confirmationFundsBefore(onScreen,earlier,earlierAt,confirmedAt) {
 if(Number.isSafeInteger(onScreen)&&onScreen>=0&&onScreen<=MAX)return onScreen;
 if(!Number.isSafeInteger(earlier)||earlier<0||earlier>MAX||
    !Number.isFinite(earlierAt)||!Number.isFinite(confirmedAt)||
    confirmedAt<=earlierAt||confirmedAt-earlierAt>MATCH_WINDOW_MS)return null;
 return earlier;
}
// Recognizing a registration fee in the center crop must not skip a
// full-window scan when the Market Funds balance is outside that crop.
function shouldScanFullMarket({status,screenPhase,focusFunds,awaitingFeeFunds,marketHint,inMarket}) {
 if(focusFunds!==null)return false;
 if(awaitingFeeFunds)return true;
 if(status==='observed')
  return screenPhase==='confirmation'||screenPhase==='listing_form';
 return !(marketHint&&!inMarket);
}
// Preserve a readable confirmation dialog when a wider OCR pass sees only
// the background listing form. Upgrade to full-window text only when it
// adds a real transaction or a confirmation phase.
function preferFullMarketParse(centered,full) {
 return full?.status==='observed' &&
  (centered?.status!=='observed' ||
   (centered?.screen_phase!=='confirmation'&&full.screen_phase==='confirmation'));
}
function reconcileScreenFunds(observations,reading) {
 if(!Array.isArray(observations)||!reading||
    typeof reading.user_id!=='string'||typeof reading.character!=='string'||
    typeof reading.server!=='string'||!Number.isSafeInteger(reading.funds)||
    reading.funds<0||reading.funds>MAX||
    !Number.isFinite(reading.capturedAt)||
    reading.screen_phase==='confirmation')return 0;
 const owner=charKey(reading.character,reading.server),eligible=[];
 for(const row of observations) {
  if(!row||row.user_id!==reading.user_id||
     charKey(row.character,row.server)!==owner||
     row.status!=='unverified'||row.screen_phase!=='confirmation'||
     row.funds_match||
     !Number.isSafeInteger(row.funds_before)||
     !Number.isSafeInteger(row.fee)||row.fee<=0)continue;
  const when=Date.parse(row.occurred_at);
  const last=Date.parse(row.last_seen_at||row.occurred_at);
  if(!Number.isFinite(when)||!Number.isFinite(last)||
     reading.capturedAt<=Math.max(when,last)||
     reading.capturedAt-when>MATCH_WINDOW_MS)continue;
  if(row.funds_before-reading.funds===row.fee)eligible.push(row);
 }
 // Never assign one deduction to two possible listing prompts.
 if(eligible.length!==1)return 0;
 eligible[0].funds_match={
  before:eligible[0].funds_before,
  after:reading.funds,
  occurred_at:new Date(reading.capturedAt).toISOString(),
  source:'market_funds_ocr'
 };
 // This supports "spent on Market fees" locally; it does NOT claim a decoded
 // bound/regular wallet packet or an official completed-listing receipt.
 return 1;
}
module.exports={readMarketFunds,reconcileScreenFunds,confirmationFundsBefore,shouldScanFullMarket,preferFullMarketParse,MATCH_WINDOW_MS};
