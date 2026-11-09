'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mini', {
  state:()=>ipcRenderer.invoke('state:get'),
  hide:()=>ipcRenderer.invoke('overlay:hide'),
  openMain:()=>ipcRenderer.invoke('overlay:show-main'),
  onChange:callback=>{
    const listener=()=>callback();
    ipcRenderer.on('state:changed',listener);
    return ()=>ipcRenderer.removeListener('state:changed',listener);
  }
});
