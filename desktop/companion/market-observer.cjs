'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {desktopCapturer,app}=require('electron');
const {createWorker}=require('tesseract.js');
const {parseMarketText,signature}=require('./market-ocr.cjs');

// Never capture an entire monitor or any other app. "screen" is intentionally
// not a permitted source type. A game in exclusive fullscreen may not expose
// a capturable window thumbnail; that case is reported, not bypassed.
const GAME_TITLE=/(?:^|[\s:–-])aion\s*2(?:$|[\s:–-])/i;
const INTERVAL_MS=6000;
class MarketObserver {
 constructor({getContext,onObservation,onStatus}) {
  this.getContext=getContext;
  this.onObservation=onObservation;
  this.onStatus=onStatus;
  this.timer=null;
  this.worker=null;
  this.running=false;
  this.lastSignature='';
  this.stable=0;
  this.emitted=new Set();
  this.count=0;
 }
 async ensureWorker() {
  if(this.worker)return this.worker;
  const langPath=app.isPackaged
   ?path.join(process.resourcesPath,'ocr')
   :path.join(__dirname,'node_modules','@tesseract.js-data','eng','4.0.0_best_int');
  if(!fs.existsSync(path.join(langPath,'eng.traineddata.gz')))
   throw new Error('Bundled OCR language model missing.');
  // Node Tesseract runs in a worker; worker and traineddata are packaged.
  this.worker=await createWorker('eng',1,{langPath,
   cachePath:path.join(app.getPath('userData'),'ocr-cache','eng.traineddata')});
  return this.worker;
 }
 start() {
  if(this.timer)return;
  this.onStatus({state:'watching',message:'Watching the Aion 2 window for Market details.'});
  this.timer=setInterval(()=>{void this.tick();},INTERVAL_MS);
  void this.tick();
 }
 async tick() {
  if(this.running)return;
  const context=this.getContext();
  // Account sign-in, known game PID and known selected character are all required.
  if(!context?.userId || !context?.character || !context?.server || !context.gameRunning)return;
  this.running=true;
  try {
   const sources=await desktopCapturer.getSources({
    types:['window'],thumbnailSize:{width:1920,height:1080},
    fetchWindowIcons:false
   });
   const game=sources.find(x=>GAME_TITLE.test(x.name)&&x.id.startsWith('window:'));
   if(!game || game.thumbnail.isEmpty()){
    this.lastSignature='';this.stable=0;
    this.onStatus({state:'no-window',message:'Aion 2 game window cannot be captured (try borderless windowed mode).'});
    return;
   }
   const size=game.thumbnail.getSize();
   if(size.width<640||size.height<360) {
    this.onStatus({state:'low-resolution',message:'Game window thumbnail is too small for reliable OCR.'});
    return;
   }
   // OCR only the centered gameplay UI. Discard the image immediately afterward.
   const region={x:Math.round(size.width*.08),y:Math.round(size.height*.06),
    width:Math.floor(size.width*.84),height:Math.floor(size.height*.86)};
   const crop=game.thumbnail.crop(region);
   const worker=await this.ensureWorker();
   const result=await worker.recognize(crop.toPNG());
   const observation=parseMarketText(result?.data?.text||'');
   if(!observation){
    this.lastSignature='';this.stable=0;
    this.onStatus({state:'watching',message:'Aion 2 detected; no recognizable Market details on screen.'});
    return;
   }
   // Require two consecutive matching OCR reads; do not create a new
   // transaction every 6 seconds while an interface remains open.
   const day=new Date().toISOString().slice(0,10);
   const key=signature(observation,context.character,context.server,day);
   this.stable=key===this.lastSignature?this.stable+1:1;
   this.lastSignature=key;
   if(this.stable<2)return;
   if(!this.emitted.has(key)) {
    this.emitted.add(key);
    if(this.emitted.size>500)this.emitted=new Set([...this.emitted].slice(-250));
    this.count++;
    await this.onObservation({...observation,fingerprint:key,
     occurred_at:new Date().toISOString(),character:context.character,
     server:context.server,account_user_id:context.userId});
   }
   this.onStatus({state:'reading',message:'Market screen recognized. Observations: '+this.count+'.'});
  } catch(e) {
   this.onStatus({state:'error',message:'Market OCR unavailable: '+String(e?.message||'error').slice(0,100)});
  } finally {this.running=false;}
 }
 async stop() {
  if(this.timer){clearInterval(this.timer);this.timer=null;}
  this.lastSignature='';this.stable=0;
  if(this.worker){const worker=this.worker;this.worker=null;await worker.terminate().catch(()=>{});}
  this.onStatus({state:'stopped',message:'Market screen tracking stopped.'});
 }
}
module.exports={MarketObserver,GAME_TITLE,INTERVAL_MS};
