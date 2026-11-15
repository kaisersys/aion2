'use strict';
const crypto=require('node:crypto');
// Do not assign a new observation timestamp just because Windows returned the
// same pixels again. Startup must observe at least one DIFFERENT live frame.
class LiveFrameGate {
 constructor(staleAfterMs=15000){
  this.staleAfterMs=staleAfterMs;
  this.lastHash=null;
  this.firstSeenAt=null;
  this.lastChangedAt=null;
  this.lastAcceptedAt=null;
  this.framesSeen=0;
  this.framesChanged=0;
 }
 inspect(png,at=Date.now()){
  if(!Buffer.isBuffer(png)||!png.length||
     !Number.isFinite(at))return {accepted:false,reason:'invalid'};
  const hash=crypto.createHash('sha256').update(png).digest('hex');
  this.framesSeen++;
  if(this.lastHash===null){
   this.lastHash=hash;
   this.firstSeenAt=at;
   this.lastChangedAt=at;
   return {accepted:false,reason:'initial-frame',changed:false,
    lastChangedAt:at,stale:false};
  }
  if(hash===this.lastHash){
   const age=Math.max(0,at-this.lastChangedAt);
   return {accepted:false,reason:age>=this.staleAfterMs?'stale':'unchanged',
    changed:false,lastChangedAt:this.lastChangedAt,stale:age>=this.staleAfterMs,
    unchangedMs:age};
  }
  this.lastHash=hash;
  this.lastChangedAt=at;
  this.lastAcceptedAt=at;
  this.framesChanged++;
  return {accepted:true,reason:'fresh',changed:true,lastChangedAt:at,
   stale:false,unchangedMs:0};
 }
 reset(){
  this.lastHash=null;this.firstSeenAt=null;this.lastChangedAt=null;
  this.lastAcceptedAt=null;this.framesSeen=0;this.framesChanged=0;
 }
}
module.exports={LiveFrameGate};
