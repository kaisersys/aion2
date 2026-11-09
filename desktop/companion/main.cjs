'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeEvent, addEvents, charKey, periods } = require('./ledger.cjs');
const WEBSITE = 'https://atreiastreet.com/';
const FILE_LIMIT = 8 * 1024 * 1024;
let win;
let state = { profiles:[], events:[] };
let feed = null;
let remote = null;

function notify() {
  if (win && !win.isDestroyed()) win.webContents.send('state:changed');
}
function storePath() { return path.join(app.getPath('userData'), 'local-ledger.json'); }
function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    state = {
      profiles:Array.isArray(saved.profiles) ? saved.profiles.slice(0,80) : [],
      events:Array.isArray(saved.events) ? saved.events.slice(-50000) : []
    };
  } catch { state = { profiles:[], events:[] }; }
}
function saveState() {
  fs.mkdirSync(path.dirname(storePath()), { recursive:true });
  const file = storePath() + '.tmp';
  fs.writeFileSync(file, JSON.stringify(state), { mode:0o600 });
  fs.renameSync(file, storePath());
}
function captureState() {
  return { ...state, feedPath:feed ? path.basename(feed.path) : null,
    remote:remote ? {email:remote.email,characters:remote.characters} : null,
    configured:Boolean(readConfig()) };
}
function insert(raw, fallbackId) {
  const event = normalizeEvent(raw, fallbackId);
  const merged = addEvents(state.events, [event]);
  if (!merged.added.length) return false;
  state.events = merged.events;
  const key = charKey(event.character, event.server);
  if (!state.profiles.some(p => charKey(p.character,p.server) === key)) {
    state.profiles.push({character:event.character,server:event.server});
  }
  saveState();
  notify();
  return true;
}
function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'), 'utf8'));
    const parsed = new URL(config.supabaseUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') ||
        typeof config.supabaseAnonKey !== 'string' || config.supabaseAnonKey.length < 20) return null;
    return { url:parsed.origin, key:config.supabaseAnonKey };
  } catch { return null; }
}
async function request(endpoint, method='GET', body, auth=true, options={}) {
  const config = readConfig();
  if (!config) throw new Error('Supabase is not configured. See desktop/companion/README.md.');
  if (auth && !remote) throw new Error('Sign in to your Atreia Street account first.');
  const headers = {apikey:config.key,'Content-Type':'application/json'};
  if (auth) headers.Authorization = 'Bearer ' + remote.access_token;
  if (options.prefer) headers.Prefer = options.prefer;
  const res = await fetch(config.url + endpoint, {
    method, headers, body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0,300);
    throw new Error('Website sync error ('+res.status+'): '+detail);
  }
  return res.status === 204 || res.status === 201 && options.noContent ? null : await res.json().catch(()=>null);
}
async function refreshed() {
  if (!remote) throw new Error('Sign in first.');
  if (Date.now() < remote.expires_at-60000) return;
  const config = readConfig();
  const res = await fetch(config.url+'/auth/v1/token?grant_type=refresh_token', {
    method:'POST', headers:{apikey:config.key,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:remote.refresh_token}), signal:AbortSignal.timeout(15000)
  });
  if (!res.ok) { remote=null; throw new Error('Your session expired. Sign in again.'); }
  const tokens=await res.json();
  Object.assign(remote,{access_token:tokens.access_token, refresh_token:tokens.refresh_token,
    expires_at:Date.now()+tokens.expires_in*1000});
}
async function characters() {
  await refreshed();
  const list = await request('/rest/v1/player_characters?select=id,name,server_name&order=name.asc');
  remote.characters = Array.isArray(list) ? list : [];
  return remote.characters;
}
async function sync() {
  if (!remote) throw new Error('Sign in first.');
  await characters();
  const byKey = new Map(remote.characters.map(c=>[charKey(c.name,c.server_name),c.id]));
  const rows = [];
  let unmatched = 0;
  for (const ev of state.events) {
    const id=byKey.get(charKey(ev.character,ev.server));
    if (!id) { unmatched++; continue; }
    rows.push({user_id:remote.user_id, character_id:id,
      event_hash:crypto.createHash('sha256').update(ev.id+'|'+ev.character+'|'+ev.server).digest('hex'),
      kind:ev.type, occurred_at:ev.occurred_at, source:ev.source,
      amount:ev.amount ?? null, balance:ev.balance ?? null,
      counter_key:ev.key ?? null, counter_frequency:ev.frequency ?? null,
      counter_scope:ev.scope ?? null, counter_current:ev.current ?? null,
      counter_maximum:ev.maximum ?? null });
  }
  for (let i=0;i<rows.length;i+=150) {
    await refreshed();
    await request('/rest/v1/player_companion_events?on_conflict=user_id,character_id,event_hash',
      'POST',rows.slice(i,i+150),true,{prefer:'resolution=ignore-duplicates,return=minimal',noContent:true});
  }
  // Only actual decoded ticket snapshots update the website's existing balance
  // system. Manually entered/illustrative counters never overwrite website data.
  const latest = new Map();
  for (const e of state.events) {
    if (e.type !== 'counter' || e.source !== 'decoded' || !e.maximum) continue;
    if (!['nightmare','invasion','shugo-server','shugo-character'].includes(e.key)) continue;
    const characterId=byKey.get(charKey(e.character,e.server));
    if (!characterId) continue;
    const ownerKey = e.scope==='server' ? e.server : characterId;
    const k=e.scope+'|'+ownerKey+'|'+e.key;
    const previous=latest.get(k);
    if (!previous || e.occurred_at > previous.occurred_at) latest.set(k,{...e,ownerKey});
  }
  const ticketRows=[];
  for (const e of latest.values()) {
    const reset=periods(Date.parse(e.occurred_at));
    ticketRows.push({user_id:remote.user_id,owner_scope:e.scope,owner_key:e.ownerKey,
      task_key:e.key,balance:e.current,anchor_reset:e.frequency==='weekly'?reset.week:reset.day,
      updated_at:e.occurred_at});
  }
  if (ticketRows.length) {
    await request('/rest/v1/player_ticket_balances?on_conflict=user_id,owner_scope,owner_key,task_key',
      'POST',ticketRows,true,{prefer:'resolution=merge-duplicates,return=minimal',noContent:true});
  }
  return { uploaded:rows.length, unmatched, ticketBalances:ticketRows.length };
}
function pollFeed() {
  if (!feed) return;
  try {
    const stat=fs.statSync(feed.path);
    if (stat.size > FILE_LIMIT) {
      if (!feed.sizeWarned) { feed.sizeWarned=true; notify(); }
      return;
    }
    const lines=fs.readFileSync(feed.path,'utf8').split(/\r?\n/);
    lines.pop(); // last line is either empty or still being written
    if (feed.lines > lines.length) feed.lines=0; // file was rotated
    const incoming=[];
    for (let i=feed.lines;i<lines.length;i++) {
      const line=lines[i].trim();
      if (!line || line.length>4000) continue;
      try {
        const raw=JSON.parse(line);
        const fallback=crypto.createHash('sha256').update(feed.path+'|'+i+'|'+line).digest('hex');
        incoming.push(normalizeEvent(raw,fallback));
      } catch { /* ignore malformed records; never save raw packets */ }
    }
    feed.lines=lines.length;
    const merged=addEvents(state.events,incoming);
    if (merged.added.length) {
      state.events=merged.events;
      for (const event of merged.added) {
        const key=charKey(event.character,event.server);
        if (!state.profiles.some(p=>charKey(p.character,p.server)===key) &&
            state.profiles.length < 80) state.profiles.push({character:event.character,server:event.server});
      }
      saveState();notify();
    }
  } catch { /* deleted/replaced file; retain previously observed data */ }
}
function createWindow() {
  win = new BrowserWindow({width:1120,height:760,minWidth:800,minHeight:580,
    backgroundColor:'#090f18',show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.removeMenu();
  win.loadFile(path.join(__dirname,'index.html'));
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
}
app.whenReady().then(()=>{
  loadState();
  createWindow();
  ipcMain.handle('state:get',()=>captureState());
  ipcMain.handle('profile:add',(_,{character,server})=>{
    if (typeof character!=='string'||typeof server!=='string'||!character.trim()||
        !server.trim()||character.length>40||server.length>48) throw new Error('Invalid character details.');
    const key=charKey(character,server);
    if (!state.profiles.some(p=>charKey(p.character,p.server)===key)) {
      state.profiles.push({character:character.trim(),server:server.trim()});
      saveState();notify();
    }
    return captureState();
  });
  ipcMain.handle('event:add',(_,data)=>insert({...data,source:'manual',id:crypto.randomUUID()}));
  ipcMain.handle('feed:choose',async()=>{
    const result=await dialog.showOpenDialog(win,{
      title:'Choose a decoded Atreia JSONL event feed',
      properties:['openFile'],filters:[{name:'JSON Lines',extensions:['jsonl','txt']}]
    });
    if (result.canceled) return null;
    if (feed?.timer) clearInterval(feed.timer);
    feed={path:result.filePaths[0],lines:0};
    pollFeed();
    feed.timer=setInterval(pollFeed,2000);
    notify();
    return path.basename(feed.path);
  });
  ipcMain.handle('remote:login',async(_,{email,password})=>{
    if (typeof email!=='string'||typeof password!=='string'||email.length>256||
        password.length>256) throw new Error('Invalid sign-in.');
    const config=readConfig();
    if (!config) throw new Error('Website connection is not configured in this build.');
    const res=await fetch(config.url+'/auth/v1/token?grant_type=password',{
      method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error('Sign-in failed. Check your account credentials.');
    const data=await res.json();
    remote={email,user_id:data.user.id,access_token:data.access_token,
      refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000,characters:[]};
    await characters();notify();
    return {email,characters:remote.characters};
  });
  ipcMain.handle('remote:logout',()=>{remote=null;notify();return true;});
  ipcMain.handle('remote:sync',sync);
  ipcMain.handle('website:open',()=>shell.openExternal(WEBSITE));
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(feed?.timer)clearInterval(feed.timer);});
