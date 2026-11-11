'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MarketFrameBuffer}=require('../market-frame-buffer.cjs');
function frame(id,at) {
 return {focusPng:Buffer.from('dialog-'+id),fullPng:Buffer.from('screen-'+id),capturedAt:at};
}
test('preserves short confirmation captured between slow OCR jobs',()=>{
 const now=Date.now();
 const q=new MarketFrameBuffer(10,45000);
 q.push(frame('listing',now-1400));
 q.push(frame('confirmation',now-900));
 q.push(frame('closed',now-200));
 assert.equal(q.length,3);
 assert.equal(q.shift().focusPng.toString(),'dialog-listing');
 assert.equal(q.shift().focusPng.toString(),'dialog-confirmation');
 assert.equal(q.shift().focusPng.toString(),'dialog-closed');
});
test('does not retain identical frames, stale screenshots or unlimited images',()=>{
 const t=Date.now(),q=new MarketFrameBuffer(2,45000);
 assert.equal(q.push(frame('a',t)),true);
 assert.equal(q.push(frame('a',t+100)),false);
 assert.equal(q.push(frame('b',t+200)),true);
 assert.equal(q.push(frame('c',t+300)),true);
 assert.equal(q.length,2);
 assert.equal(q.shift().focusPng.toString(),'dialog-b');
 assert.equal(q.shift().focusPng.toString(),'dialog-c');
 const stale=new MarketFrameBuffer();
 stale.push(frame('stale',t-50000));
 assert.equal(stale.length,0);
});
test('releases screen buffers on logout and rejects malformed data',()=>{
 const q=new MarketFrameBuffer();
 assert.equal(q.push({focusPng:'screen',fullPng:Buffer.alloc(1),capturedAt:Date.now()}),false);
 q.push(frame('open',Date.now()));
 q.clear();
 assert.equal(q.length,0);
 assert.equal(q.lastDigest,null);
});
