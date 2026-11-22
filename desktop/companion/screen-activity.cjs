'use strict';
// On-screen monster reward notices are *observations*, not verified bank
// transactions. Store only amounts and timestamps, never raw OCR or frames.
const MAX_KINA=100000000000000;
function value(raw) {
 if(!/^\d{1,14}$|^\d{1,3}(?:,\d{3}){1,4}$/.test(raw))return null;
 const n=Number(raw.replace(/,/g,''));
 return Number.isSafeInteger(n)&&n>0&&n<=MAX_KINA?n:null;
}
const EXTRA_CONTEXT=/\b(?:registration|listing|market|sale|price|fee|tax|balance|wallet|regular|bound|inventory|spent|cost|purchase|remaining|total)\b/i;
const GAIN=/(?:obtained|received|gained|earned|acquired|looted|picked\s+up)/i;
const MONEY='(\\d{1,3}(?:,\\d{3}){1,4}|\\d{1,14})';
const NOTICES=[
 new RegExp('^(?:you\\s+(?:have\\s+)?)?(?:obtained|received|gained|earned|acquired|looted|picked\\s+up)\\s+(?:\\+\\s*)?'+MONEY+'\\s*(?:kina|kinah)(?:\\s+(?:from\\s+(?:a\\s+)?monster|from\\s+party|reward))?[.!]?$','i'),
 new RegExp('^(?:you\\s+(?:have\\s+)?)?(?:obtained|received|gained|earned|acquired|looted|picked\\s+up)\\s+(?:kina|kinah)\\s*[:+x×]?\\s*'+MONEY+'[.!]?$','i'),
 new RegExp('^(?:kina|kinah)\\s*\\+\\s*'+MONEY+'(?:\\s+(?:obtained|received|gained|earned))?[.!]?$','i'),
 new RegExp('^\\+\\s*'+MONEY+'\\s*(?:kina|kinah)(?:\\s+(?:obtained|received|gained|earned))?[.!]?$','i'),
 new RegExp('^(?:kina|kinah)\\s*'+MONEY+'\\s+(?:obtained|received|gained|earned)[.!]?$','i')
];
function parseKinaGains(text) {
 const lines=String(text||'').replace(/\r/g,'').split('\n')
  .map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,240);
 const found=[];
 for(const line of lines) {
  // Never interpret a quoted price or a wallet counter as a monster reward.
  if(EXTRA_CONTEXT.test(line)||line.length>110)continue;
  for(const pattern of NOTICES) {
   const match=line.match(pattern);
   if(!match)continue;
   const amount=value(match[1]);
   if(amount!==null)found.push({amount});
   break;
  }
 }
 // Multiple identical text lines in a single OCR frame may be the same toast
 // segmented twice. Prefer undercounting to crediting fictitious Kina.
 return [...new Map(found.map(x=>[x.amount,x])).values()].slice(0,5);
}
function gainRegions(blocks,width,height) {
 if(!Array.isArray(blocks)||!width||!height)return [];
 const found=[];
 for(const block of blocks)for(const p of block.paragraphs||[])
 for(const line of p.lines||[]) {
  if(!parseKinaGains(String(line.text||'')).length)continue;
  const b=line.bbox;
  if(!b||![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite))continue;
  const x=Math.max(0,Math.floor(b.x0-100));
  const y=Math.max(0,Math.floor(b.y0-65));
  const x2=Math.min(width,Math.ceil(b.x1+180));
  const y2=Math.min(height,Math.ceil(b.y1+85));
  if(x2>x+25&&y2>y+20)found.push({x,y,width:x2-x,height:y2-y});
 }
 return found.slice(0,3);
}
function fallbackGainRegion(width,height) {
 // Fast detection region until a full-screen scan locates the notification.
 return {x:Math.floor(width*.43),y:Math.floor(height*.12),
  width:width-Math.floor(width*.43),
  height:Math.floor(height*.77)};
}
class KinaGainTracker {
 constructor(){this.reset();}
 reset(){this.active=new Map();this.lastAt=0;}
 observe(text,at=Date.now()) {
  const seen=new Set(),out=[];
  for(const {amount} of parseKinaGains(text)) {
   const key=String(amount);seen.add(key);
   const old=this.active.get(key);
   const consecutive=old && at>old.at && at-old.at<=6000;
   const count=consecutive?old.count+1:1;
   const emitted=consecutive?old.emitted:false;
   if(count>=2&&!emitted)out.push({amount,occurred_at:new Date(at).toISOString()});
   this.active.set(key,{at,count,emitted:emitted||count>=2,absences:0});
  }
  // Require two scans where the toast is absent before accepting an identical
  // new reward. Prevent a persistent overlay from being counted on each frame.
  if(at>this.lastAt)for(const [key,row] of this.active) {
   if(seen.has(key))continue;
   if(at-row.at>12000||row.absences>=1)this.active.delete(key);
   else row.absences++;
  }
  this.lastAt=at;
  return out;
 }
}
module.exports={parseKinaGains,gainRegions,fallbackGainRegion,KinaGainTracker};
