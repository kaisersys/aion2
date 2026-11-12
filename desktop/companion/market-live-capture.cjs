'use strict';
const {BrowserWindow,desktopCapturer,ipcMain,nativeImage,session}=require('electron');
const path=require('node:path');
const {LiveFrameGate}=require('./market-live-frame.cjs');

const WINDOW_TITLE=/^AION\s*2(?:\s|$|[.:-])/i;
class MarketLiveCapture {
 constructor({onFrame,onStatus}){
  this.onFrame=onFrame;this.onStatus=onStatus;
  this.active=false;this.busy=false;this.worker=null;this.sourceId=null;
  this.selectedAt=0;this.lastFrameAt=0;this.lastRestartAt=0;
  this.gate=new LiveFrameGate(15000);
  this.windowCandidates=0;this.framesReceived=0;
  this.lastPixels=null;this.lastChangeAt=null;
  this.stale=false;this.lastStaleNotice=0;
  this.status='stopped';
  this.frameHandler=(event,payload)=>this.receive(event,payload);
  this.statusHandler=(event,payload)=>this.receiveStatus(event,payload);
 }
 emit(status,message){this.status=status;this.onStatus?.(status,message);}
 async start(){
  if(this.active)return;
  this.active=true;
  ipcMain.on('market-video:frame',this.frameHandler);
  ipcMain.on('market-video:status',this.statusHandler);
  // This permission handler grants desktop media ONLY to the isolated local
  // worker. The worker receives only the named AION2 window source id.
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>{
   callback(Boolean(this.active&&this.worker&&!this.worker.isDestroyed()&&
    contents===this.worker.webContents &&
    (permission==='display-capture'||permission==='media')));
  });
  await this.ensure();
 }
 async ensure(){
  if(!this.active||this.busy)return;
  this.busy=true;
  try{
   const sources=await desktopCapturer.getSources({
    types:['window'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false
   });
   const games=sources.filter(x=>typeof x.id==='string'&&
    /^window:\d+:\d+$/.test(x.id)&&WINDOW_TITLE.test(x.name));
   this.windowCandidates=games.length;
   if(games.length!==1){
    if(this.sourceId)this.resetSource();
    this.emit('waiting',games.length===0?
     'AION2 window not found; open the game in borderless/windowed mode.':
     'Multiple AION2 game windows detected; cannot choose a safe capture source.');
    return;
   }
   if(!this.worker||this.worker.isDestroyed()){
    this.worker=new BrowserWindow({
     show:false,width:280,height:180,backgroundThrottling:false,
     webPreferences:{
      preload:path.join(__dirname,'market-stream-preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:false,
      backgroundThrottling:false,webSecurity:true
     }
    });
    const w=this.worker;
    w.on('closed',()=>{
     if(this.worker===w){this.worker=null;this.sourceId=null;
      if(this.active)this.emit('error','Window video worker closed unexpectedly.');}
    });
    await w.loadFile(path.join(__dirname,'market-stream.html'));
   }
   const now=Date.now();
   const stalled=this.sourceId===games[0].id&&this.selectedAt>0&&
    now-this.selectedAt>18000&&
    now-this.lastFrameAt>18000&&now-this.lastRestartAt>18000;
   if(this.sourceId===games[0].id&&!stalled)return;
   this.sourceId=games[0].id;
   this.selectedAt=now;this.lastFrameAt=0;this.lastRestartAt=now;
   this.gate.reset();this.stale=false;this.lastChangeAt=null;
   this.worker.webContents.send('market-video:source',this.sourceId);
   this.emit('starting','Opening live video capture of the AION2 window.');
  }catch(err){
   this.emit('error','Unable to start live AION2 video capture: '+
    String(err.message||err).slice(0,120));
  }finally{this.busy=false;}
 }
 resetSource(){
  this.sourceId=null;this.selectedAt=0;this.lastFrameAt=0;
  this.gate.reset();this.stale=false;this.lastChangeAt=null;
  if(this.worker&&!this.worker.isDestroyed())
   this.worker.webContents.send('market-video:source',null);
 }
 receive(event,payload){
  if(!this.active||!this.worker||this.worker.isDestroyed()||
   event.sender!==this.worker.webContents||
   !payload||payload.sourceId!==this.sourceId||
   typeof payload.dataUrl!=='string'||
   !payload.dataUrl.startsWith('data:image/png;base64,')||
   payload.dataUrl.length>22000000)return;
  try{
   const img=nativeImage.createFromDataURL(payload.dataUrl);
   const sz=img.getSize();
   if(img.isEmpty()||sz.width<640||sz.width>2560||
    sz.height<360||sz.height>1800)throw Error('Invalid frame dimensions.');
   const now=Date.now();
   this.lastFrameAt=now;
   this.framesReceived++;
   this.lastPixels=sz.width+' × '+sz.height;
   const png=img.toPNG();
   const checked=this.gate.inspect(png,now);
   this.lastChangeAt=checked.lastChangedAt;
   if(checked.stale&&!this.stale){
    this.stale=true;
    this.emit('stale','Live AION2 video appears frozen for over 15 seconds. '+
     'No Market transactions will be attributed from stale pixels. '+
     'Try borderless/windowed mode or restart the game capture.');
   }
   if(checked.changed&&this.stale){
    this.stale=false;
    this.emit('streaming','AION2 video has changed again; automatic OCR resumed.');
   }
   if(checked.reason==='initial-frame')
    this.emit('warming-up','Waiting for a changed game frame before treating capture as live.');
   if(checked.accepted)this.onFrame?.({png,capturedAt:now,dimensions:sz,image:img});
  }catch(err){
   this.emit('error','Invalid live AION2 capture frame: '+
    String(err.message||err).slice(0,120));
  }
 }
 receiveStatus(event,payload){
  if(!this.active||!this.worker||event.sender!==this.worker.webContents||
   !payload||payload.sourceId!==this.sourceId)return;
  const status=String(payload.state||'').slice(0,30);
  const message=String(payload.message||'').slice(0,125);
  if(status==='stream-error'||status==='frame-error'||status==='ended')
   this.emit('error',message+' Try borderless/windowed mode.');
  else if(status==='streaming'&&!this.stale)this.emit('streaming',message);
 }
 stop(){
  this.active=false;
  ipcMain.removeListener('market-video:frame',this.frameHandler);
  ipcMain.removeListener('market-video:status',this.statusHandler);
  this.resetSource();
  if(this.worker&&!this.worker.isDestroyed())this.worker.close();
  this.worker=null;this.emit('stopped','Live video reader stopped.');
 }
}
module.exports={MarketLiveCapture};
