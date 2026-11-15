'use strict';
(()=>{
 const ipc=window.marketVideo;
 const video=document.getElementById('game-video');
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d',{alpha:false});
 let stream=null,sourceId=null,timer=null,lastSent=0,started=0;
 function stop(){
  if(timer){clearInterval(timer);timer=null;}
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  video.pause();video.srcObject=null;sourceId=null;lastSent=0;started=0;
 }
 async function useSource(id){
  stop();
  if(typeof id!=='string'||!/^window:\d+:\d+$/.test(id)){
   ipc.status('invalid-source','Rejected non-window capture source.',null);return;
  }
  sourceId=id;
  try{
   // A live MediaStream, not desktopCapturer.getSources().thumbnail.
   // Video-only. This worker never requests the desktop, microphones or audio.
   const opened=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{mandatory:{
     chromeMediaSource:'desktop',chromeMediaSourceId:id,
     maxWidth:2560,maxHeight:1440,maxFrameRate:10
    }}
   });
   if(sourceId!==id){for(const track of opened.getTracks())track.stop();return;}
   stream=opened;
   for(const track of stream.getVideoTracks()){
    track.addEventListener('ended',()=>ipc.status('ended','Game-window video stream ended.',id));
   }
   video.srcObject=stream;
   await video.play();
   started=Date.now();
   ipc.status('streaming','Live AION2 window video capture started.',id);
   timer=setInterval(()=>{
    if(!stream||sourceId!==id||video.readyState<2||!video.videoWidth)return;
    try{
     const width=Math.min(2560,video.videoWidth);
     const height=Math.max(1,Math.round(video.videoHeight*width/video.videoWidth));
     if(canvas.width!==width||canvas.height!==height){
      canvas.width=width;canvas.height=height;
     }
     ctx.drawImage(video,0,0,width,height);
     const dataUrl=canvas.toDataURL('image/png');
     if(dataUrl.length>22000000)throw new Error('Capture frame exceeds size limit.');
     lastSent=Date.now();
     ipc.frame(dataUrl,id,width,height);
    }catch(err){ipc.status('frame-error',String(err.message||err).slice(0,100),id);}
   },850);
  }catch(err){
   ipc.status('stream-error','Windows live game capture failed: '+String(err.message||err).slice(0,110),id);
   stop();
  }
 }
 ipc.onSource(useSource);
 window.addEventListener('unload',stop);
})();
