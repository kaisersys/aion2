'use strict';
// Tesseract often reads Market labels as one column and Kina amounts as
// another. Recover same-row values from TSV bounding boxes, never from the
// globally ordered plain-text stream. TSV is processed in memory only.
const LABELS=[
 {words:['total','sale','price'],label:'Total Sale Price'},
 {words:['sale','price','per','item'],label:'Sale Price Per Item'},
 {words:['registration','fee'],label:'Registration Fee'},
 {words:['sale','quantity'],label:'Sale Quantity'},
 {words:['funds'],label:'Funds'}
];
const MAX_VALUE=100000000000000;
function numberToken(raw) {
 const str=String(raw||'').trim().replace(/[◎◉ⓞ©@]/gu,'').trim();
 if(!/^\d[\d,. ]{0,22}$/.test(str))return null;
 const n=Number(str.replace(/[,. ]/g,''));
 return Number.isSafeInteger(n)&&n>0&&n<=MAX_VALUE?n:null;
}
function parseWords(tsv) {
 if(typeof tsv!=='string'||tsv.length>2000000)return [];
 const lines=tsv.split(/\r?\n/);
 if(!lines[0]?.startsWith('level\t'))return [];
 return lines.slice(1,3000).map(line=>{
  const cells=line.split('\t');
  if(cells[0]!=='5'||cells.length<12)return null;
  const [x,y,w,h,conf]=cells.slice(6,11).map(Number);
  if(![x,y,w,h,conf].every(Number.isFinite)||w<=0||h<=0||x<0||y<0||
     w>10000||h>10000||conf<20)return null;
  const text=cells.slice(11).join('\t').trim().slice(0,80);
  if(!text)return null;
  return {text,x0:x,x1:x+w,y0:y,y1:y+h,cy:y+h/2,height:h};
 }).filter(Boolean);
}
function norm(s) {return String(s).toLowerCase().replace(/[^a-z]/g,'');}
function getLabelBoxes(words,parts) {
 const labels=[];
 for(const first of words) {
  if(norm(first.text)!==parts[0])continue;
  let matches=[first];
  for(const part of parts.slice(1)) {
   const previous=matches.at(-1);
   const next=words.filter(w=>norm(w.text)===part && w.x0>previous.x0 &&
    w.x0<=previous.x1+previous.height*3.5 &&
    Math.abs(w.cy-first.cy)<=Math.max(20,first.height*.75))
    .sort((a,b)=>a.x0-b.x0)[0];
   if(!next){matches=[];break;}
   matches.push(next);
  }
  if(matches.length===parts.length)labels.push({
   x1:Math.max(...matches.map(w=>w.x1)),
   cy:matches.reduce((n,w)=>n+w.cy,0)/matches.length,
   height:Math.max(...matches.map(w=>w.height))
  });
 }
 return labels;
}
function rowValue(words,parts) {
 const boxes=getLabelBoxes(words,parts);
 if(!boxes.length)return null;
 const values=[];
 for(const box of boxes) {
  const possible=words.filter(w=>w.x0>box.x1+Math.max(12,box.height*.4) &&
     Math.abs(w.cy-box.cy)<=Math.max(24,box.height*1.15))
   .map(w=>({value:numberToken(w.text),dy:Math.abs(w.cy-box.cy)}))
   .filter(x=>x.value!==null).sort((a,b)=>a.dy-b.dy);
  // Read the closest horizontally aligned number, not a random other row.
  if(possible.length>1 && possible.some(x=>x.value!==possible[0].value))
   return null; // Two different numbers on one row: never pick a fee by guess.
  if(possible.length)values.push(possible[0].value);
 }
 if(!values.length||values.some(x=>x!==values[0]))return null;
 return values[0];
}
function addSpatialRows(text,tsv) {
 const words=parseWords(tsv);
 if(!words.length)return {text:String(text||''),fields:{},positioned:false};
 const fields={};
 for(const label of LABELS) {
  const value=rowValue(words,label.words);
  if(value!==null)fields[label.label]=value;
 }
 // Only enhance fields that already have recognisable labels (or an explicit
 // Confirm/Cancel prompt). A numeric coincidence in a different game panel
 // must not create a Market transaction.
 const original=String(text||'');
 const confirmation=/are\s+you\s+sure\s+you\s+wish\s+to\s+list\s+for\s+sale/i.test(original);
 const whitelist=Object.entries(fields).filter(([label])=>
  confirmation || original.toLowerCase().includes(label.toLowerCase()));
 const lines=whitelist.map(([key,value])=>key+': '+value.toLocaleString('en-US'));
 return {text:original+(lines.length?'\n'+lines.join('\n'):''),fields,positioned:lines.length>0};
}
module.exports={addSpatialRows,parseWords,rowValue,numberToken};
