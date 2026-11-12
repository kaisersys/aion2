'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {LiveFrameGate}=require('../market-live-frame.cjs');
function png(label){return Buffer.from('some unique image pixels '+label);}
test('an initial cached frame is not automatically trusted as live',()=>{
 const gate=new LiveFrameGate(15000);
 const a=gate.inspect(png('old'),1000);
 assert.equal(a.accepted,false);
 assert.equal(a.reason,'initial-frame');
 assert.equal(gate.framesChanged,0);
});
test('unchanged thumbnails do not get re-timestamped and are marked stale',()=>{
 const gate=new LiveFrameGate(15000);
 gate.inspect(png('old'),1000);
 assert.equal(gate.inspect(png('old'),10000).reason,'unchanged');
 const stale=gate.inspect(png('old'),16001);
 assert.equal(stale.reason,'stale');
 assert.equal(stale.stale,true);
 assert.equal(stale.accepted,false);
 assert.equal(stale.lastChangedAt,1000);
 assert.equal(gate.framesChanged,0);
});
test('visible game scene changes resume live capture and produce fresh timestamps',()=>{
 const gate=new LiveFrameGate(15000);
 gate.inspect(png('old'),1000);
 gate.inspect(png('old'),17000);
 const updated=gate.inspect(png('market fee 30'),18000);
 assert.equal(updated.accepted,true);
 assert.equal(updated.lastChangedAt,18000);
 assert.equal(updated.stale,false);
 assert.equal(gate.lastAcceptedAt,18000);
});
test('logout resets all image hashes and timestamps',()=>{
 const gate=new LiveFrameGate();
 gate.inspect(png('old'),1000);gate.inspect(png('new'),2000);gate.reset();
 assert.equal(gate.lastHash,null);
 assert.equal(gate.lastChangedAt,null);
 assert.equal(gate.framesChanged,0);
 assert.equal(gate.inspect(png('new'),3000).accepted,false);
});
test('Windows code streams a named AION2 window instead of repeating thumbnails',()=>{
 const root=path.resolve(__dirname,'..');
 const main=fs.readFileSync(path.join(root,'main.cjs'),'utf8');
 const controller=fs.readFileSync(path.join(root,'market-live-capture.cjs'),'utf8');
 const renderer=fs.readFileSync(path.join(root,'market-stream-renderer.js'),'utf8');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.ok(controller.includes("types:['window']"));
 assert.ok(controller.includes("thumbnailSize:{width:0,height:0}"));
 assert.ok(controller.includes('WINDOW_TITLE.test(x.name)'));
 assert.ok(renderer.includes('navigator.mediaDevices.getUserMedia'));
 assert.ok(renderer.includes("chromeMediaSource:'desktop'"));
 assert.ok(renderer.includes('chromeMediaSourceId:id'));
 assert.ok(renderer.includes('audio:false'));
 assert.ok(main.includes('if(!marketFrameBuffer.length)return; // No cached thumbnail fallback.'));
 assert.ok(main.includes('if(marketLiveCapture.stale)'));
 for(const file of ['market-live-frame.cjs','market-live-capture.cjs',
  'market-stream.html','market-stream-preload.cjs','market-stream-renderer.js'])
  assert.ok(pkg.build.files.includes(file),'Missing bundled file: '+file);
 assert.equal(pkg.version,'0.1.8');
});
