'use strict';
// Read only explicitly labeled Aion 2 currency counters. Never infer a balance
// from a price, an item quantity, or the Market's registration-fee quotation.
const MAX_BALANCE=100000000000000;
const LABEL=/^(regular\s+(?:kina|kinah)|(?:unbound|tradeable)\s+(?:kina|kinah)|bound\s+(?:kina|kinah)|(?:kina|kinah)\s*\(\s*(?:all|bound)\s*\)|(?:kina|kinah)\s+all|(?:kina|kinah))$/i;
function kindOf(label) {
 const s=label.toLowerCase();
 if(/\ball\b/.test(s))return 'all';
 if(/\bbound\b/.test(s)&&!s.includes('unbound'))return 'bound';
 return 'unbound';
}
function numeric(raw) {
 const s=String(raw||'').trim();
 if(!/^(?:\d{1,14}|\d{1,3}(?:,\d{3}){1,4})$/.test(s))return null;
 const n=Number(s.replace(/,/g,''));
 return Number.isSafeInteger(n)&&n>=0&&n<=MAX_BALANCE?n:null;
}
function screenWallets(text) {
 const lines=String(text||'').replace(/\r/g,'').split('\n')
  .map(s=>s.replace(/[：]/g,':').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,240);
 const candidates=new Map();
 let explicitRegular=false;
 function put(kind,value,label) {
  if(value===null)return;
  if(kind==='unbound' && !/^(?:kina|kinah)$/i.test(String(label||'').trim()))explicitRegular=true;
  if(!candidates.has(kind))candidates.set(kind,new Set());
  candidates.get(kind).add(value);
 }
 for(let i=0;i<lines.length;i++) {
  const s=lines[i].replace(/^[◇◈◎•*:;|\- ]+/, '').trim();
  // Explicit label and numeric value, in either order.
  const left=s.match(/^(.+?)\s*[:=]?\s+(\d[\d,]*)\s*$/);
  const right=s.match(/^(\d[\d,]*)\s+(.+?)\s*$/);
  if(left&&LABEL.test(left[1].replace(/[:= ]+$/,'')))
   put(kindOf(left[1]),numeric(left[2]),left[1].replace(/[:= ]+$/,''));
  else if(right&&LABEL.test(right[2]))
   put(kindOf(right[2]),numeric(right[1]),right[2]);
  else if(LABEL.test(s.replace(/[:= ]+$/,'')) && i+1<lines.length)
   put(kindOf(s),numeric(lines[i+1].replace(/^(?:kina|kinah)\s+/i,'')),s.replace(/[:= ]+$/,''));
 }
 // Bare 'Kina 1,435' also appears beside listing fees and item prices.
 // Accept it as Regular only when another explicit currency label confirms
 // that this is a wallet display, never from a price dialog by itself.
 if(!explicitRegular && !candidates.has('all') && !candidates.has('bound'))
  candidates.delete('unbound');
 const result={};
 for(const kind of ['unbound','bound','all']) {
  const options=candidates.get(kind);
  if(options && options.size===1)result[kind]=[...options][0];
  else if(options && options.size>1)return {}; // conflicting OCR
 }
 if(result.all!==undefined && result.unbound!==undefined && result.bound!==undefined &&
    result.all!==result.unbound+result.bound)return {};
 // Only derive an absent component from TWO independently labeled values.
 if(result.all!==undefined && result.unbound!==undefined && result.bound===undefined)
  if(result.all>=result.unbound)result.bound=result.all-result.unbound;
 if(result.all!==undefined && result.bound!==undefined && result.unbound===undefined)
  if(result.all>=result.bound)result.unbound=result.all-result.bound;
 return result;
}
function walletRegions(blocks,width,height) {
 if(!Array.isArray(blocks)||!width||!height)return [];
 const found=[];
 for(const block of blocks)for(const p of block.paragraphs||[])for(const line of p.lines||[]) {
  const label=String(line.text||'').replace(/\s+/g,' ').trim();
  if(!/(?:\b(?:regular|bound|unbound)\s+kina\b|\bkina\s*\(\s*all\s*\)|^kina\s*[:：]?\s*\d)/i.test(label))continue;
  const b=line.bbox;
  if(!b||![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite))continue;
  const x=Math.max(0,Math.floor(b.x0-100)), y=Math.max(0,Math.floor(b.y0-75));
  const x2=Math.min(width,Math.ceil(b.x1+350)), y2=Math.min(height,Math.ceil(b.y1+110));
  if(x2>x+30&&y2>y+20)found.push({x,y,width:x2-x,height:y2-y});
 }
 const merged=[];
 for(const rect of found.slice(0,10)) {
  const other=merged.find(r=>rect.x<=r.x+r.width&&r.x<=rect.x+rect.width&&
   rect.y<=r.y+r.height&&r.y<=rect.y+rect.height);
  if(other) {
   const x=Math.min(other.x,rect.x),y=Math.min(other.y,rect.y);
   const x2=Math.max(other.x+other.width,rect.x+rect.width);
   const y2=Math.max(other.y+other.height,rect.y+rect.height);
   Object.assign(other,{x,y,width:x2-x,height:y2-y});
  } else merged.push({...rect});
 }
 return merged.slice(0,3);
}
class WalletStabilizer {
 constructor(){this.reset();}
 reset(){this.pending=new Map();this.confirmed=new Map();}
 observe(readings,at=Date.now()) {
  const confirmed=[];
  for(const [kind,balance] of Object.entries(readings||{})) {
   if(!['unbound','bound','all'].includes(kind)||
      !Number.isSafeInteger(balance)||balance<0||balance>MAX_BALANCE)continue;
   const previous=this.pending.get(kind);
   const count=previous&&previous.value===balance&&at>previous.at&&at-previous.at<=12000
    ?previous.count+1:1;
   this.pending.set(kind,{value:balance,count,at});
   if(count<2||this.confirmed.get(kind)===balance)continue;
   this.confirmed.set(kind,balance);
   confirmed.push({currency_kind:kind,balance});
  }
  return confirmed;
 }
}
module.exports={screenWallets,walletRegions,WalletStabilizer,numeric};
