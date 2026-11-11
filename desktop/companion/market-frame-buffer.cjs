'use strict';
const crypto=require('node:crypto');
// A short-lived Confirm/Cancel dialog can close before a slow OCR scan ends.
// Keep bounded, on-device screenshots in RAM, each with the capture timestamp.
// Nothing from this buffer is written to disk or uploaded.
class MarketFrameBuffer {
 constructor(maxFrames=36,maxAgeMs=45000){
  this.maxFrames=maxFrames;
  this.maxAgeMs=maxAgeMs;
  this.frames=[];
  this.lastDigest=null;
  this.dropped=0;
 }
 push(frame) {
  if(!frame || !Buffer.isBuffer(frame.focusPng) ||
     !Buffer.isBuffer(frame.fullPng) ||
     !Number.isFinite(frame.capturedAt) || frame.focusPng.length>5000000 ||
     frame.fullPng.length>15000000)return false;
  const digest=crypto.createHash('sha1').update(frame.focusPng).digest('hex');
  if(digest===this.lastDigest)return false;
  this.lastDigest=digest;
  this.frames.push(frame);
  while(this.frames.length>this.maxFrames) {
   this.frames.shift();this.dropped++;
  }
  this.purge(Date.now());
  return true;
 }
 purge(now){
  while(this.frames.length&&now-this.frames[0].capturedAt>this.maxAgeMs){
   this.frames.shift();this.dropped++;
  }
 }
 shift(now=Date.now()) {
  this.purge(now);
  return this.frames.shift()||null;
 }
 clear(){this.frames.length=0;this.lastDigest=null;}
 get length(){return this.frames.length;}
}
module.exports={MarketFrameBuffer};
