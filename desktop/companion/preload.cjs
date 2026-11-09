'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, value) => ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld('companion', {
  state: () => invoke('state:get'),
  startCapture: gamePort => invoke('capture:start',gamePort),
  stopCapture: () => invoke('capture:stop'),
  toggleOverlay:()=>invoke('overlay:toggle'),
  addProfile: profile => invoke('profile:add', profile),
  addEvent: event => invoke('event:add', event),
  chooseFeed: () => invoke('feed:choose'),
  login: credentials => invoke('remote:login', credentials),
  logout: () => invoke('remote:logout'),
  sync: () => invoke('remote:sync'),
  openWebsite: () => invoke('website:open'),
  onChange: callback => {
    const listener = () => callback();
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  }
});
