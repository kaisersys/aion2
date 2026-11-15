'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MarketFrameBuffer}=require('../market-frame-buffer.cjs');
function frame(id,at) {
 return {image:Buffer.from('compressed-image-'+id),capturedAt:at};
}
test('preserves short confirmation captured between slow OCR jobs',()=>{
 const now=Date.now();
 const q=new MarketFrameBuffer(10,45000);
 q.push(frame('listing',now-1400));
 q.push(frame('confirmation',now-900));
 q.push(frame('closed',now-200));
 assert.equal(q.length,3);
 assert.equal(q.shift().image.toString(),'compressed-image-listing');
 assert.equal(q.shift().image.toString(),'compressed-image-confirmation');
 assert.equal(q.shift().image.toString(),'compressed-image-closed');
});
test('does not retain identical frames, stale screenshots or unlimited images',()=>{
 const t=Date.now(),q=new MarketFrameBuffer(2,45000);
 assert.equal(q.push(frame('a',t)),true);
 assert.equal(q.push(frame('a',t+100)),false);
 assert.equal(q.push(frame('b',t+200)),true);
 assert.equal(q.push(frame('c',t+300)),true);
 assert.equal(q.length,2);
 assert.equal(q.shift().image.toString(),'compressed-image-b');
 assert.equal(q.shift().image.toString(),'compressed-image-c');
 const stale=new MarketFrameBuffer();
 stale.push(frame('stale',t-50000));
 assert.equal(stale.length,0);
});
test('releases screen buffers on logout and rejects malformed data',()=>{
 const q=new MarketFrameBuffer();
 assert.equal(q.push({image:'screen',capturedAt:Date.now()}),false);
 q.push(frame('open',Date.now()));
 q.clear();
 assert.equal(q.length,0);
 assert.equal(q.lastDigest,null);
});


test('idle sampling uses newest frame without accumulating scan backlog',()=>{
 const now=Date.now(),q=new MarketFrameBuffer(16,20000);
 for(let i=0;i<10;i++)q.push(frame(String(i),now+i));
 assert.equal(q.shiftLatest(now+15).image.toString(),'compressed-image-9');
 assert.equal(q.length,0);
 assert.equal(q.dropped,9);
});


test('keeps a short-lived confirmation during OCR while skipping stale gameplay',()=>{
 const now=Date.now(),q=new MarketFrameBuffer(16,20000);
 q.push(frame('old-gameplay',now-9000));
 q.push(frame('confirmation',now-3400));
 q.push(frame('closed',now-1500));
 assert.equal(q.shiftRecent(now,4000).image.toString(),'compressed-image-confirmation');
 assert.equal(q.shiftRecent(now,4000).image.toString(),'compressed-image-closed');
 assert.equal(q.shiftRecent(now,4000),null);
 assert.equal(q.dropped,1);
});
