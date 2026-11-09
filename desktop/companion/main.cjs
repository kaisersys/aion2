'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { normalizeEvent, addEvents, charKey, periods } = require('./ledger.cjs');
const { describeServer, sameName, serverMatches, discoverProfile } = require('./discovery.cjs');
const WEBSITE = 'https://atreiastreet.com/';
const FILE_LIMIT = 8 * 1024 * 1024;
let win;
let overlay;
const DEFAULT_SETTINGS = { autoCapture:true, overlayEnabled:true, gamePort:13328 };
let state = { profiles:[], events:[], settings:{...DEFAULT_SETTINGS}, activeCharacter:null };
let feed = null;
let remote = null;
let capture = null;
let captureStatus = {state:'idle',message:'Npcap capture not started.',health:null};
function captureMessage(state,message){captureStatus={state,message,health:captureStatus.health};notify();}

function notify() {
  if (win && !win.isDestroyed()) win.webContents.send('state:changed');
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('state:changed');
}
function storePath() { return path.join(app.getPath('userData'), 'local-ledger.json'); }
function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    state = {
      profiles:Array.isArray(saved.profiles) ? saved.profiles.slice(0,80) : [],
      events:Array.isArray(saved.events) ? saved.events.slice(-50000) : [],
      settings:{
        autoCapture:saved.settings?.autoCapture!==false,
        overlayEnabled:saved.settings?.overlayEnabled!==false,
        gamePort:Number.isInteger(saved.settings?.gamePort) &&
          saved.settings.gamePort>0 && saved.settings.gamePort<=65535
          ? saved.settings.gamePort : DEFAULT_SETTINGS.gamePort
      },
      activeCharacter:saved.activeCharacter||null
    };
  } catch { state = { profiles:[], events:[],settings:{...DEFAULT_SETTINGS},activeCharacter:null }; }
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
    configured:Boolean(readConfig()), capture:captureStatus };
}
function insert(raw, fallbackId) {
  const event = normalizeEvent(raw, fallbackId);
  const merged = addEvents(state.events, [event]);
  if (!merged.added.length) return false;
  state.events = merged.events;
  const key = charKey(event.character, event.server);
  if (!state.profiles.some(p => charKey(p.character,p.server) === key) && state.profiles.length<80) {
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
  const byKey = new Map();
  for (const profile of state.profiles) {
    const matched=matchWebsiteCharacter(profile.character,profile.server);
    if (matched) byKey.set(charKey(profile.character,profile.server),matched.id);
  }
  for (const c of remote.characters) byKey.set(charKey(c.name,c.server_name),c.id);
  const rows = [];
  let unmatched = 0;
  for (const ev of state.events) {
    const id=byKey.get(charKey(ev.character,ev.server));
    if (!id) { unmatched++; continue; }
    rows.push({user_id:remote.user_id, character_id:id,
      event_hash:crypto.createHash('sha256').update(ev.id+'|'+ev.character+'|'+ev.server).digest('hex'),
      kind:ev.type, occurred_at:ev.occurred_at, source:ev.source, currency_kind:ev.currency_kind??null,
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


// Automatic discovery: local roster is populated on the first live character-login record.
// No website login or manual character setup is needed for local tracking.
function resolveCapturedCharacter(packetCharacter,serverId) {
  const discovered=discoverProfile(state.profiles,packetCharacter,serverId);
  if (!discovered.profile) {
    captureMessage('unmapped','Unable to identify the game character and server safely.');
    return null;
  }
  if(discovered.changed)state.profiles=discovered.profiles;
  const profile=discovered.profile;
  const active={character:profile.character,server:profile.server,serverId:Number(serverId)};
  const changedActive=!state.activeCharacter ||
    charKey(state.activeCharacter.character,state.activeCharacter.server)!==charKey(active.character,active.server);
  if(changedActive)state.activeCharacter=active;
  if(discovered.changed || changedActive) { saveState(); notify(); }
  return profile;
}
function processCaptureMessage(message) {
  if (!message || typeof message!=='object') return;
  if (message.kind==='status') {
    captureMessage(message.state==='error'?'error':message.state, String(message.message||''));
    return;
  }
  if (message.kind==='health') {
    const value = n => Number.isSafeInteger(n) && n>=0 ? n : 0;
    const h = {
      packets:value(message.packets),frames:value(message.frames),
      outerFrames:value(message.outerFrames), bundles:value(message.bundles),
      bundlesDecoded:value(message.bundlesDecoded),
      bundleFailures:value(message.bundleFailures), innerFrames:value(message.innerFrames),
      identities:value(message.identities),rosters:value(message.rosters),
      characterPackets:value(message.characterPackets),rosterPackets:value(message.rosterPackets),
      ticketPackets:value(message.ticketPackets),
      popularOpcodes:Array.isArray(message.popularOpcodes)
        ? message.popularOpcodes.slice(0,8).filter(x=>/^[0-9a-f]{4}$/.test(x?.opcode) &&
            Number.isSafeInteger(x?.count) && x.count>=0)
            .map(x=>({opcode:x.opcode,count:x.count})) : [],
      dropped:value(message.dropped),gaps:value(message.gaps),
      desyncs:value(message.desyncs),port:String(message.port||'').slice(0,50),
      gameRunning:message.gameRunning===true,
      connections:value(message.connections),loopback:message.loopback===true,
      adapters:value(message.adapters),osLookupError:String(message.osLookupError||'').slice(0,100)
    };
    captureStatus.health=h;
    if(captureStatus.state==='listening' || captureStatus.state==='starting'){
      if(!h.gameRunning && h.packets===0)
        captureStatus.message='AION2.exe is not running or was not detected by Windows. Npcap is listening on '+h.adapters+' adapter(s).';
      else if(h.gameRunning && h.connections===0 && h.packets===0)
        captureStatus.message='AION2.exe detected, but Windows reports no established IPv4 TCP connection yet. Enter the game world; a VPN/accelerator may obscure it.';
      else if(h.packets===0)
        captureStatus.message='AION2.exe detected with '+h.connections+' TCP connection(s), but Npcap has captured ZERO game packets. Check driver access and VPN/loopback adapters; teleporting will not fix this.';
      else if(h.frames===0)
        captureStatus.message='Received '+h.packets+' TCP packets but decoded ZERO Aion 2 frames. The protocol decoder or traffic path needs fixing, not another teleport.';
      else if(h.bundles>0 && h.bundlesDecoded===0)
        captureStatus.message='Observed '+h.bundles+
          ' compressed game bundles, but none could be unpacked. The bundle format needs investigation.';
      else if(h.identities===0 && h.rosters===0 && h.characterPackets>0)
        captureStatus.message='Game data is arriving, including '+h.characterPackets+
          ' character packet(s), but the identity parser rejected them. This indicates a decoder-version mismatch.';
      else if(h.identities===0 && h.rosters===0 && h.rosterPackets>0)
        captureStatus.message='Received '+h.rosterPackets+
          ' account-roster packet(s), but could not parse the character list. The roster decoder needs updating.';
      else if(h.identities===0 && h.rosters===0 && h.bundlesDecoded>0)
        captureStatus.message='Expanded '+h.bundlesDecoded+' compressed bundle(s) and decoded '+
          h.innerFrames+' inner frames, but no identity record yet. The decoder is receiving more of the game protocol.';
      else if(h.identities===0 && h.rosters===0)
        captureStatus.message='Decoded '+h.frames+
          ' regular frames; no character, roster, or compressed identity messages yet. The opcode summary below can help investigate.';
      else
        captureStatus.message='Game traffic and identity records detected. Verifying the active character.';
    }
    notify();
    return;
  }
  if (message.kind==='roster' && Array.isArray(message.characters)) {
    let changed=false, found=0;
    for(const c of message.characters.slice(0,80)) {
      if(!c || typeof c.Name!=='string' || !Number.isInteger(c.ServerId))continue;
      const discovered=discoverProfile(state.profiles,c.Name,c.ServerId);
      if(!discovered.profile)continue;
      found++;
      if(discovered.changed) {state.profiles=discovered.profiles;changed=true;}
    }
    if(changed){saveState();notify();}
    if(found>0 && captureStatus.state!=='connected')
      captureMessage('listening','Discovered '+found+' account characters; waiting for active character.');
    return;
  }
  if (message.kind==='character') {
    const found=resolveCapturedCharacter(message.name,message.serverId);
    if (found) captureMessage('connected','Tracking '+found.character+' · '+found.server);
    return;
  }
  if (message.kind==='event' && message.event && typeof message.event==='object') {
    const e=message.event;
    const found=resolveCapturedCharacter(e.character,e.serverId);
    if (!found) return;
    try { insert({...e,server:found.server,source:'decoded'},e.id); }
    catch { /* Invalid or unverified frame data is never accepted as a trusted ledger event. */ }
  }
}
function profileServerId(character, server) {
  const match=state.profiles.find(p=>charKey(p.character,p.server)===charKey(character,server));
  return Number(match?.serverId)||null;
}
function matchWebsiteCharacter(character,server) {
  if (!remote) return null;
  const serverId=profileServerId(character,server);
  const matches=remote.characters.filter(c=>
    sameName(c.name,character) && (
      charKey(c.name,c.server_name)===charKey(character,server) ||
      (serverId && serverMatches(c.server_name,serverId))
    ));
  return matches.length===1?matches[0]:null;
}

function startCapture(gamePort=13328) {
  if (capture) return captureStatus;
  const port=Number(gamePort);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('A valid Aion 2 TCP server port is required.');
  const exe = app.isPackaged
    ? path.join(process.resourcesPath,'capture','AtreiaCapture.exe')
    : path.join(__dirname,'capture','publish','AtreiaCapture.exe');
  if (!fs.existsSync(exe)) throw new Error('Capture helper missing. Build capture/AtreiaCapture.csproj first.');
  const child=spawn(exe,['--ports',String(port)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  capture=child;
  captureStatus.health=null;
  captureMessage('starting','Initializing Npcap · server port '+port+'…');
  const output=readline.createInterface({input:child.stdout});
  output.on('line',line=>{
    if (line.length>4000) return;
    try { processCaptureMessage(JSON.parse(line)); } catch { /* malformed status line */ }
  });
  let errorText='';
  child.stderr.on('data',b=>{errorText=(errorText+String(b)).slice(-1200);});
  child.on('error',err=>{
    if(capture===child)capture=null;
    captureMessage('error','Capture helper failed: '+err.message);
  });
  child.on('exit',code=>{
    if(capture===child){
      capture=null;
      captureMessage('stopped',code===0?'Capture stopped.':'Capture exited ('+code+'). '+errorText.slice(-160));
    }
  });
  return captureStatus;
}
function stopCapture() {
  if (capture) {
    const child=capture;capture=null;
    child.kill();
  }
  captureMessage('idle','Capture stopped.');
  return captureStatus;
}

function secureWindowContents(target) {
  target.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  target.webContents.on('will-navigate',e=>e.preventDefault());
}
function createOverlay() {
  if (overlay && !overlay.isDestroyed()) { overlay.showInactive(); return; }
  overlay = new BrowserWindow({
    width:332, height:318, minWidth:332, minHeight:318,
    backgroundColor:'#101a28', frame:false, transparent:false,
    show:false, skipTaskbar:true, alwaysOnTop:true, resizable:false, movable:true,
    webPreferences:{
      preload:path.join(__dirname,'overlay-preload.cjs'),contextIsolation:true,
      nodeIntegration:false,sandbox:true,webSecurity:true
    }
  });
  // Keep the mini where the user dragged it, as long as a screen still contains it.
  const saved=state.settings.overlayPosition;
  if(saved && Number.isInteger(saved.x) && Number.isInteger(saved.y) &&
     screen.getAllDisplays().some(d=>{
       const b=d.workArea;
       return saved.x>=b.x-100 && saved.x<b.x+b.width-90 &&
              saved.y>=b.y-100 && saved.y<b.y+b.height-80;
     }))overlay.setPosition(saved.x,saved.y);
  overlay.on('moved',()=>{
    if(overlay && !overlay.isDestroyed()){
      const [x,y]=overlay.getPosition();
      state.settings.overlayPosition={x,y};
      saveState();
    }
  });
  overlay.removeMenu();
  secureWindowContents(overlay);
  overlay.loadFile(path.join(__dirname,'overlay.html'));
  overlay.once('ready-to-show',()=>{ if(state.settings.overlayEnabled)overlay.showInactive(); });
  overlay.on('closed',()=>{overlay=null;});
}
function showMain() {
  if (!win || win.isDestroyed()) createWindow();
  else { win.show(); win.focus(); }
}
function setOverlayVisible(show) {
  state.settings.overlayEnabled=Boolean(show);
  if (show) createOverlay();
  else {
    if (!win || win.isDestroyed())showMain();
    if (overlay && !overlay.isDestroyed())overlay.close();
  }
  saveState();notify();
  return state.settings.overlayEnabled;
}

function createWindow() {
  win = new BrowserWindow({width:1120,height:760,minWidth:800,minHeight:580,
    backgroundColor:'#090f18',show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.removeMenu();
  secureWindowContents(win);
  win.loadFile(path.join(__dirname,'index.html'));
  win.once('ready-to-show',()=>win.show());
}
app.whenReady().then(()=>{
  loadState();
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
  ipcMain.handle('capture:start',(_,gamePort)=>{
    const port=Number(gamePort);
    if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid server port.');
    state.settings.gamePort=port;
    state.settings.autoCapture=true;
    saveState();
    return startCapture(port);
  });
  ipcMain.handle('capture:stop',()=>{
    state.settings.autoCapture=false;
    saveState();
    return stopCapture();
  });
  ipcMain.handle('overlay:toggle',()=>setOverlayVisible(!state.settings.overlayEnabled));
  ipcMain.handle('overlay:hide',()=>setOverlayVisible(false));
  ipcMain.handle('overlay:show-main',()=>showMain());
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
  app.on('activate',()=>showMain());
  createWindow();
  if (state.settings.overlayEnabled)createOverlay();
  if (state.settings.autoCapture) {
    try { startCapture(state.settings.gamePort); }
    catch (err) { captureMessage('error',err.message); }
  }
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(feed?.timer)clearInterval(feed.timer);stopCapture();});
