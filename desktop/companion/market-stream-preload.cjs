'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// The only bridge is a selected named AION2 window source and RAM-only frames.
contextBridge.exposeInMainWorld('marketVideo',{
 onSource:fn=>ipcRenderer.on('market-video:source',(_event,id)=>fn(id)),
 frame:(dataUrl,sourceId,width,height)=>ipcRenderer.send('market-video:frame',
  {dataUrl,sourceId,width,height}),
 status:(state,message,sourceId)=>ipcRenderer.send('market-video:status',
  {state,message,sourceId})
});
