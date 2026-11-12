'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspectBgra}=require('../market-capture-health.cjs');
function picture(w,h,make){
 const b=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const [r,g,blue]=make(x,y);
  const i=(y*w+x)*4;b[i]=blue;b[i+1]=g;b[i+2]=r;b[i+3]=255;
 }
 return b;
}
test('reports fully black game window instead of treating 2560x1440 dimensions as proof of readable content',()=>{
 const b=picture(100,70,()=>[0,0,0]);
 const x=inspectBgra(b,100,70);
 assert.equal(x.signal,'blank-like');
 assert.equal(x.blankLike,true);
 assert.equal(x.contrast,0);
});
test('dark Market background with bright labels is not classified as blank',()=>{
 const b=picture(180,100,(x,y)=>x>15&&x<170&&y%17<4?[230,230,220]:[15,25,32]);
 const stats=inspectBgra(b,180,100);
 assert.equal(stats.blankLike,false);
 assert.ok(stats.contrast>20);
 assert.ok(stats.brightPercent>0);
});
test('rejects invalid captures',()=>{
 assert.equal(inspectBgra(Buffer.from('abc'),200,100),null);
 assert.equal(inspectBgra(Buffer.alloc(300),0,10),null);
 assert.equal(inspectBgra(null,10,10),null);
});
test('OCR UI retains last COMPLETED results rather than resetting them at start of every scan',()=>{
 const root=path.resolve(__dirname,'..');
 const main=fs.readFileSync(path.join(root,'main.cjs'),'utf8');
 const ui=fs.readFileSync(path.join(root,'ui.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const begin=main.slice(main.indexOf('async function marketOcrTick()'),
  main.indexOf('const buffered=marketFrameBuffer.shift()'));
 assert.ok(begin.includes('marketOcrStatus.ocrInProgress=true'));
 assert.ok(!begin.includes('marketOcrStatus.recognizedChars=0'));
 assert.ok(!begin.includes('marketOcrStatus.feeLabelSeen=false'));
 assert.ok(main.includes('marketOcrStatus.lastCompletedAt=new Date().toISOString()'));
 assert.ok(main.includes("ipcMain.handle('market:preview'"));
 assert.ok(main.includes("lastMarketPreviewPng=null"));
 assert.ok(pkg.build.files.includes('market-capture-health.cjs'));
 assert.ok(pkg.build.files.includes('ocr-smoke-fixture.cjs'));
 const sample=require('../ocr-smoke-fixture.cjs');
 assert.ok(sample.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
 assert.equal(pkg.version,'0.1.8');
 for(const id of ['diagnostic-market-completed','diagnostic-market-working',
  'diagnostic-market-finished-at','diagnostic-market-last-result',
  'diagnostic-market-image-health','market-preview-diagnostics','market-preview-image']){
  assert.ok(html.includes('id="'+id+'"'));
  assert.ok(ui.includes("$('"+id+"')"),'UI status missing '+id);
 }
});
