'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, screen, desktopCapturer, nativeImage, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { normalizeEvent, addEvents, charKey, periods } = require('./ledger.cjs');
const { readMarket,stableFingerprint } = require('./market-ocr.cjs');
const { addSpatialRows } = require('./market-spatial.cjs');
const { MarketFrameBuffer } = require('./market-frame-buffer.cjs');
const { MarketLiveCapture } = require('./market-live-capture.cjs');
const { inspectBgra } = require('./market-capture-health.cjs');
const { reconcileFees } = require('./market-fees.cjs');
const { describeServer, sameName, serverMatches, discoverProfile } = require('./discovery.cjs');
const WEBSITE = 'https://atreiastreet.com/';
const STARTUP_SMOKE = process.argv.includes('--atreia-startup-smoke');
const FILE_LIMIT = 8 * 1024 * 1024;
let win;
let overlay;
const DEFAULT_SETTINGS = { autoCapture:true, overlayEnabled:true, gamePort:13328 };
let state = { profiles:[], events:[], settings:{...DEFAULT_SETTINGS}, activeCharacter:null };
let feed = null;
let remote = null;
let capture = null;
let marketOcrTimer=null, marketOcrBusy=false, marketOcrWorker=null;
let marketSampleTimer=null, marketSampleBusy=false;
const marketFrameBuffer=new MarketFrameBuffer(36,45000);
let lastFullMarketFallbackAt=0;
let marketSyncBusy=false;
let lastMarketSyncAttemptAt=0;
let lastMarketFrame=null;
let lastMarketSeenAt=0;
let lastMarketSaveAt=0;
let lastMarketPreviewPng=null;
let lastMarketPreviewAt=null;
let lastMarketHealthAt=0;
let lastMarketHealthNoticeAt=0;
let marketOcrStatus={streamState:'stopped',staleVideo:false,framesReceived:0,lastVisualChangeAt:null,captureMethod:'window-video-stream',state:'waiting',message:'Sign in to read the Aion 2 Market window.',observations:0,scans:0,completedScans:0,ocrInProgress:false,lastCompletedAt:null,lastRecognitionMs:null,lastResult:null,framesBuffered:0,framesCaptured:0,lastCapturedAt:null,lastScanAt:null,windowCandidates:0,capturePixels:null,captureHealth:null,recognizedChars:0,feeLabelSeen:false,feeEvidence:[],spatialFee:null};
const marketLiveCapture=new MarketLiveCapture({
 onFrame:receiveLiveMarketFrame,
 onStatus:(stateName,message)=>{
  marketOcrStatus.streamState=stateName;
  marketOcrStatus.staleVideo=stateName==='stale';
  if(stateName==='stale'){
   marketFrameBuffer.clear();lastMarketPreviewPng=null;lastMarketPreviewAt=null;
  }
  marketOcrMessage(stateName,message);
 }
});
let marketObservations=[];
let recentMarket=new Map();
let captureStatus = {state:'idle',message:'Npcap capture not started.',health:null};
function captureMessage(state,message){captureStatus={state,message,health:captureStatus.health};notify();}

function notify() {
  if (win && !win.isDestroyed()) win.webContents.send('state:changed');
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('state:changed');
}
function storePath() { return path.join(app.getPath('userData'), 'local-ledger.json'); }
function marketPath() { return path.join(app.getPath('userData'),'market-observations.json'); }
function sessionPath() { return path.join(app.getPath('userData'),'companion-session.enc.json'); }
function saveSecureSession() {
 try {
  if(!remote||!safeStorage.isEncryptionAvailable())return false;
  const payload={version:1,email:remote.email,user_id:remote.user_id,
   sealed:safeStorage.encryptString(remote.refresh_token).toString('base64')};
  fs.writeFileSync(sessionPath()+'.tmp',JSON.stringify(payload),{mode:0o600});
  fs.renameSync(sessionPath()+'.tmp',sessionPath());
  return true;
 } catch { return false; }
}
function clearSecureSession() {
 try {fs.rmSync(sessionPath(),{force:true});}catch {}
}
async function restoreSecureSession() {
 if(!readConfig()) {marketOcrMessage('config-missing','Companion account connection is not configured; Market OCR cannot start.');return;}
 if(!safeStorage.isEncryptionAvailable()) {
  marketOcrMessage('sign-in','Sign in to Atreia Street in this companion to enable Market OCR. Secure login persistence unavailable on this PC.');return;
 }
 let saved;
 try {saved=JSON.parse(fs.readFileSync(sessionPath(),'utf8'));}
 catch {marketOcrMessage('sign-in','Sign in to Atreia Street in this companion; a website account alone does not start Market capture.');return;}
 try {
  if(saved.version!==1||!/^.{1,256}@.{1,256}$/.test(saved.email)||
     typeof saved.sealed!=='string'||saved.sealed.length>10000)throw Error('Invalid saved session');
  const token=safeStorage.decryptString(Buffer.from(saved.sealed,'base64'));
  const config=readConfig();
  const response=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{
   method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},
   body:JSON.stringify({refresh_token:token}),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok){
   if(response.status===400||response.status===401){clearSecureSession();marketOcrMessage('sign-in','Saved account session expired; sign in again to start Market OCR.');}
   else marketOcrMessage('network','Could not restore account session; connection failed ('+response.status+').');
   return;
  }
  const data=await response.json();
  if(!data.access_token||!data.refresh_token||!data.user?.id)throw Error('Invalid refresh response');
  remote={email:saved.email,user_id:data.user.id,access_token:data.access_token,
   refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000,characters:[]};
  saveSecureSession();
  startMarketOcr();
  try {await characters();}
  catch(err){marketOcrMessage('mapping-error',
    'Automatic Market capture is running, but website character mapping failed: '+
    String(err.message).slice(0,90));}
  notify();
 } catch(err) {
  marketOcrMessage('sign-in','Unable to restore secure account session: '+String(err.message).slice(0,100));
 }
}
function saveMarket() {
 const file=marketPath()+'.tmp';
 fs.writeFileSync(file,JSON.stringify(marketObservations.slice(-2000)),{mode:0o600});
 fs.renameSync(file,marketPath());
}
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
  try {
   const parsed=JSON.parse(fs.readFileSync(marketPath(),'utf8'));
   marketObservations=Array.isArray(parsed)?parsed.slice(-2000).filter(x=>
    x&&typeof x.id==='string'&&typeof x.character==='string'&&
    typeof x.server==='string'&&typeof x.kind==='string'):[];
  } catch { marketObservations=[]; }
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
    configured:Boolean(readConfig()), capture:captureStatus,
    marketOcr:{...marketOcrStatus,
      autoRunning:Boolean(remote && marketLiveCapture.active && marketSampleTimer && marketOcrTimer),
      monitorMode:'automatic',sampleIntervalMs:850},
    marketObservations:remote?marketObservations.filter(x=>x.user_id===remote.user_id).slice(-200).reverse():[] };
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
  if(event.type==='wallet_snapshot' && event.source==='decoded') {
    const n=reconcileFees(marketObservations,state.events);
    if(n) {
      saveMarket();
      marketOcrMessage('corroborated',
        n+' listing fee'+(n===1?'':'s')+' matched an observed Kina decrease.');
      if(remote)void syncMarket().catch(err=>marketOcrMessage('sync-error',
        'Fee matched locally; cloud sync failed: '+String(err.message).slice(0,100)));
    }
  }
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
  if (!res.ok) { remote=null;clearSecureSession();marketOcrMessage('sign-in','Your session expired. Sign in again to resume Market OCR.'); throw new Error('Your session expired. Sign in again.'); }
  const tokens=await res.json();
  Object.assign(remote,{access_token:tokens.access_token, refresh_token:tokens.refresh_token,
    expires_at:Date.now()+tokens.expires_in*1000});
  saveSecureSession();
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
    // Item-level movements are local-only: website telemetry schema intentionally
    // does not support item identifiers, handles or inferred transactions.
    if (ev.type==='item_change' || ev.type==='item_origin') continue;
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
  const marketUploaded=await syncMarket();
  return { uploaded:rows.length, unmatched, ticketBalances:ticketRows.length,marketUploaded };
}

function marketOcrMessage(stateName,message) {
 marketOcrStatus={...marketOcrStatus,state:stateName,message,observations:marketObservations.length};
 notify();
}

async function sampleMarketFrame() {
 if(marketSampleBusy||!remote||!readConfig())return false;
 marketSampleBusy=true;
 try {
  // This discovers ONLY the AION2 window. Screens are never captured.
  // The worker streams live frames rather than using Windows thumbnail data.
  await marketLiveCapture.ensure();
  marketOcrStatus.windowCandidates=marketLiveCapture.windowCandidates;
  marketOcrStatus.framesReceived=marketLiveCapture.framesReceived;
  marketOcrStatus.lastVisualChangeAt=marketLiveCapture.lastChangeAt?
   new Date(marketLiveCapture.lastChangeAt).toISOString():null;
  marketOcrStatus.staleVideo=marketLiveCapture.stale;
  marketOcrStatus.streamState=marketLiveCapture.status;
  notify();
  return marketLiveCapture.active;
 }catch(err){
  marketOcrMessage('capture-error','Live AION2 game-window capture failed: '+
   String(err.message).slice(0,120));
  return false;
 }finally{marketSampleBusy=false;}
}
function receiveLiveMarketFrame({png,capturedAt,dimensions,image}) {
 if(!remote||marketLiveCapture.stale)return;
 try {
  const box={x:Math.floor(dimensions.width*.25),
   y:Math.floor(dimensions.height*.025),
   width:Math.floor(dimensions.width*.53),
   height:Math.floor(dimensions.height*.82)};
  let focused=image.crop(box);
  if(focused.getSize().width<1600)
   focused=focused.resize({width:Math.min(1600,focused.getSize().width*2),quality:'best'});
  const wasBuffered=marketFrameBuffer.push({
   focusPng:focused.toPNG(),fullPng:png,capturedAt
  });
  marketOcrStatus.framesReceived=marketLiveCapture.framesReceived;
  marketOcrStatus.windowCandidates=marketLiveCapture.windowCandidates;
  marketOcrStatus.lastVisualChangeAt=marketLiveCapture.lastChangeAt?
   new Date(marketLiveCapture.lastChangeAt).toISOString():null;
  marketOcrStatus.streamState=marketLiveCapture.status;
  marketOcrStatus.staleVideo=false;
  marketOcrStatus.framesBuffered=marketFrameBuffer.length;
  marketOcrStatus.capturePixels=dimensions.width+' × '+dimensions.height;
  marketOcrStatus.lastCapturedAt=new Date(capturedAt).toISOString();
  if(wasBuffered){
   lastMarketPreviewPng=png;lastMarketPreviewAt=capturedAt;
   marketOcrStatus.framesCaptured++;
   void marketOcrTick();
  }
  if(capturedAt-lastMarketHealthAt>5000){
   lastMarketHealthAt=capturedAt;
   marketOcrStatus.captureHealth=inspectBgra(
    image.toBitmap(),dimensions.width,dimensions.height);
  }
  if(capturedAt-lastMarketHealthNoticeAt>3000){
   lastMarketHealthNoticeAt=capturedAt;
   notify();
  }
 }catch(err){
  marketOcrMessage('capture-error','Live AION2 video processing failed: '+
   String(err.message).slice(0,120));
 }
}

async function marketOcrTick() {
 if(marketOcrBusy)return;
 if(!readConfig()){marketOcrMessage('config-missing','Supabase configuration missing from this installer. Account login and Market reading are unavailable.');return;}
 if(!remote){marketOcrMessage('sign-in','Sign in to Atreia Street in the companion to start Market screen reading.');return;}
 if(!marketFrameBuffer.length)return; // No cached thumbnail fallback.
 marketOcrBusy=true;
 const scanStartedAt=Date.now();
 marketOcrStatus.scans++;
 marketOcrStatus.ocrInProgress=true;
 marketOcrStatus.lastScanAt=new Date(scanStartedAt).toISOString();
 // IMPORTANT: preserve the LAST COMPLETED OCR result during this scan.
 // Resetting recognizedChars/feeLabelSeen here made the interface display
 // "0 characters" throughout every long-running recognition pass.
 try {
  const buffered=marketFrameBuffer.shift();
  marketOcrStatus.framesBuffered=marketFrameBuffer.length;
  if(!buffered)return;
  const full=nativeImage.createFromBuffer(buffered.fullPng);
  if(full.isEmpty())throw Error('Live game frame is empty.');
  const dimensions=full.getSize();
  marketOcrStatus.capturePixels=dimensions.width+' × '+dimensions.height;
  marketOcrMessage('scanning','Game window captured ('+marketOcrStatus.capturePixels+'); running on-device OCR.');
  // Screenshot remains in RAM; OCR is performed on this machine.
  // Only whitelisted structured fields can enter the account ledger.
  if(!marketOcrWorker) {
   const {createWorker}=require('tesseract.js');
   marketOcrWorker=await createWorker('eng');
  }
  // The actual Confirm/Cancel dialog is centered, with the fee on a dark
  // row. Reading a cropped, enlarged dialog avoids OCR confusion with the
  // dimmed-out Market listings behind it. Fall back to the full window when
  // the focused crop does not contain an identifiable transaction.
  const box={x:Math.floor(dimensions.width*.25),y:Math.floor(dimensions.height*.025),
    width:Math.floor(dimensions.width*.53),height:Math.floor(dimensions.height*.82)};
  let focus=nativeImage.createFromBuffer(buffered.focusPng);
  if(focus.getSize().width<1600)
   focus=focus.resize({width:Math.min(1600,focus.getSize().width*2),quality:'best'});
  const screenCapturedAt=buffered.capturedAt;
  const focused=await marketOcrWorker.recognize(focus.toPNG(),{}, {tsv:true});
  const focusedSpatial=addSpatialRows(focused.data?.text||'',focused.data?.tsv);
  let recognized=focusedSpatial.text;
  let spatialFee=focusedSpatial.fields['Registration Fee']??null;
  let parsed=readMarket(recognized);
  marketOcrStatus.recognitionMode='centered-dialog';
  // Full-window OCR is costly; only use it periodically when centered OCR
  // lacks a valid transaction. The frame itself is still timestamped.
  if(parsed.status!=='observed' &&
     Date.now()-lastFullMarketFallbackAt>=5000) {
   lastFullMarketFallbackAt=Date.now();
   const fallback=await marketOcrWorker.recognize(full.toPNG(),{}, {tsv:true});
   const fullSpatial=addSpatialRows(fallback.data?.text||'',fallback.data?.tsv);
   const fullText=fullSpatial.text;
   const fullParsed=readMarket(fullText);
   if(fullParsed.status==='observed' || fullText.length>recognized.length) {
    recognized=fullText;
    parsed=fullParsed;
    spatialFee=fullSpatial.fields['Registration Fee']??null;
    marketOcrStatus.recognitionMode='full-window';
   }
  }
  // Never attribute an older image if capture froze during OCR.
  if(marketLiveCapture.stale){
   marketOcrStatus.lastResult='discarded-stale';
   return;
  }
  marketOcrStatus.spatialFee=spatialFee;
  marketOcrStatus.recognizedChars=recognized.length;
  marketOcrStatus.feeLabelSeen=/\b(?:registration\s*fee|listing\s*fee|register\s*fee)\b/i.test(recognized);
  marketOcrStatus.feeEvidence=recognized.split(/\r?\n/)
   .filter(x=>/\b(?:registration\s*fee|listing\s*fee|register\s*fee)\b/i.test(x))
   .slice(0,3).map(x=>x.replace(/[^\x20-\x7e]/g,' ').trim().slice(0,100));
  marketOcrStatus.screenPhase=parsed.screen_phase||null;
  marketOcrStatus.lastResult=parsed.status;
  if(parsed.status!=='observed') {
   if(Date.now()-lastMarketSeenAt>10000)lastMarketFrame=null;
   marketOcrMessage('listening',
    parsed.status==='empty'?'Game window captured, but OCR saw no readable text. Try borderless/windowed mode.':
    parsed.status==='unrecognized'
    ?'Game window captured. OCR read '+recognized.length+' characters; registration fee label '+(marketOcrStatus.feeLabelSeen?'found':'not found')+'. Open the Market List panel.'
    :'Market text detected, but the fee amount was unreadable. Check recognized fee line in Diagnostics.');
   return;
  }
  const current=state.activeCharacter;
  // A roster selection alone is not proof of an active world character.
  if(!current || !current.serverId || current.selectionSource==='lobby-roster') {
   marketOcrMessage('unmapped','Market fee visible, but the active in-world character has not been confirmed by capture.');
   return;
  }
  const match=matchWebsiteCharacter(current.character,current.server);
  // Save private local evidence even if this in-world character isn't yet linked
  // to the website. Never upload it without an exact account-character match.
  const localOnly=!match;
  const evidence={...parsed.evidence,screen_phase:parsed.screen_phase};
  const key=stableFingerprint(current.character,current.server,evidence);
  const now=screenCapturedAt;
  lastMarketSeenAt=now;
  for(const [k,v] of recentMarket)if(now-v>120000)recentMarket.delete(k);
  // Re-reading the same open dialog is not another transaction.
  // Reset after a different screen; allow a new identical listing following
  // a confirmed debit and a later redraw.
  if(lastMarketFrame===key) {
   const last=marketObservations.findLast(x=>x.user_id===remote.user_id &&
    x.character===current.character && x.server===current.server &&
    stableFingerprint(x.character,x.server,x)===key);
   if(last && last.status==='unverified' &&
      parsed.screen_phase==='confirmation' && now>=Date.parse(last.occurred_at)) {
    const previous=Date.parse(last.last_seen_at||last.occurred_at);
    if(now>previous)last.last_seen_at=new Date(now).toISOString();
    const matchedNow=reconcileFees(marketObservations,state.events);
    if(matchedNow || now-lastMarketSaveAt>5000) {
     saveMarket();lastMarketSaveAt=now;
     if(matchedNow && remote)void syncMarket().catch(()=>{});
    }
   }
   const matched=last?.status==='corroborated';
   marketOcrMessage(matched?'corroborated':'listening',evidence.fee!==null
    ?('Registration fee: '+evidence.fee+' Kina. '+
      (matched?'Matched a Kina decrease.':
       parsed.screen_phase==='confirmation'
        ?'Confirm/Cancel prompt observed; awaiting a matching wallet decrease.'
        :'Listing form only. No confirmation prompt observed yet.'))
    :'Market settlement amount is visible; claiming it has not been verified.');
   return;
  }
  // A preview of the same proposed listing is not a second fee.
  // When the confirmation dialog appears, promote the local proposal instead
  // of charging twice. Its time becomes the confirmation observation time.
  if(parsed.screen_phase==='listing_form' &&
    marketObservations.some(x=>x.user_id===remote.user_id &&
     x.character===current.character && x.server===current.server &&
     x.screen_phase==='confirmation' && x.fee===evidence.fee &&
     x.amount===evidence.amount &&
     Date.parse(x.occurred_at)>now-30000)) {
    marketOcrMessage('pending',
      'Listing confirmation was shown; returned to Market form. Awaiting a matching Kina decrease (cancel is possible).');
    return;
  }
  lastMarketFrame=key;
  recentMarket.set(key,now);
  const existing=parsed.screen_phase==='confirmation'?
   marketObservations.findLast(x=>x.user_id===remote.user_id &&
    x.character===current.character && x.server===current.server &&
    x.screen_phase==='listing_form' && x.status==='unverified' &&
    x.fee===evidence.fee && x.amount===evidence.amount &&
    Date.parse(x.occurred_at)>now-120000):null;
  if(existing) {
   existing.screen_phase='confirmation';
   existing.occurred_at=new Date(now).toISOString();
   existing.last_seen_at=new Date(now).toISOString();
   if(!existing.character_id && match)existing.character_id=match.id;
   existing.item_name=evidence.item_name||existing.item_name;
   existing.quantity=evidence.quantity||existing.quantity;
   existing.synced=false;
  } else marketObservations.push({
   id:crypto.randomUUID(),user_id:remote.user_id,
   character:current.character,server:current.server,
   character_id:match?.id||null,occurred_at:new Date(now).toISOString(),
   kind:evidence.kind,amount:evidence.amount,fee:evidence.fee,
   quantity:evidence.quantity,item_name:evidence.item_name,
   screen_phase:parsed.screen_phase,last_seen_at:new Date(now).toISOString(),
   evidence:'screen_ocr',status:'unverified',synced:false
  });
  marketObservations=marketObservations.slice(-2000);
  saveMarket();lastMarketSaveAt=now;
  const n=reconcileFees(marketObservations,state.events);
  if(n)saveMarket();
  marketOcrMessage(n?'corroborated':'observed',
   evidence.fee!==null
    ?(n?'Registration fee matched a '+evidence.fee+' Kina wallet decrease.':
       parsed.screen_phase==='confirmation'
        ?'Listing Confirm/Cancel prompt found. Fee '+evidence.fee+' Kina is pending until a matching Kina debit follows.'
        :'Listing form shows '+evidence.fee+' Kina fee; no Confirm/Cancel prompt yet.')
    :'Settlement amount observed; collection is not yet verified.');
  if(localOnly)marketOcrMessage('local-only',
   'Fee evidence saved locally, but this game character has no matching website profile. Link the character to sync.');
  // Failures remain queued; no raw OCR text or screenshot is sent.
  try {await syncMarket();}
  catch(err){marketOcrMessage('sync-error',
   'Fee stored locally, but account sync failed: '+String(err.message).slice(0,100));}
 } catch(err) {
  marketOcrStatus.lastResult='error';
  marketOcrMessage('error','Market reading unavailable: '+String(err.message).slice(0,120));
 } finally {
  marketOcrStatus.completedScans++;
  marketOcrStatus.lastCompletedAt=new Date().toISOString();
  marketOcrStatus.lastRecognitionMs=Date.now()-scanStartedAt;
  marketOcrStatus.ocrInProgress=false;
  marketOcrBusy=false;
  notify();
  if(marketFrameBuffer.length && remote)
   setImmediate(()=>{void marketOcrTick();});
 }
}
async function syncMarket() {
 if(!remote || marketSyncBusy)return 0;
 marketSyncBusy=true;
 try {
  for(const x of marketObservations) {
   if(x.user_id!==remote.user_id||x.character_id)continue;
   const linked=matchWebsiteCharacter(x.character,x.server);
   if(linked)x.character_id=linked.id;
  }
  const unsynced=marketObservations.filter(x=>
   !x.synced && x.character_id && x.user_id===remote.user_id).slice(0,100);
  if(!unsynced.length)return 0;
  lastMarketSyncAttemptAt=Date.now();
  await refreshed();
  const rows=unsynced.map(x=>({
   user_id:x.user_id,character_id:x.character_id,observation_id:x.id,
   occurred_at:x.occurred_at,kind:x.kind,amount:x.amount,fee:x.fee,
   quantity:x.quantity,item_name:x.item_name,
   evidence:x.evidence,status:x.status,currency_kind:x.currency_kind??null,
   screen_phase:x.screen_phase||null
  }));
  await request('/rest/v1/player_market_observations?on_conflict=user_id,observation_id',
   'POST',rows,true,{prefer:'resolution=merge-duplicates,return=minimal',noContent:true});
  for(const row of rows) {
   const matching=marketObservations.find(x=>x.id===row.observation_id);
   // Do not falsely mark a record synced if a wallet update arrived mid-request.
   if(matching && matching.status===row.status)matching.synced=true;
  }
  saveMarket();notify();
  return rows.length;
 } finally {marketSyncBusy=false;}
}
function startMarketOcr() {
 if(marketOcrTimer)return;
 marketSampleTimer=setInterval(()=>{void sampleMarketFrame();},3000);
 void marketLiveCapture.start();
 marketOcrTimer=setInterval(()=>{
  if(marketFrameBuffer.length)void marketOcrTick();
  if(remote && Date.now()-lastMarketSyncAttemptAt>30000 &&
     marketObservations.some(x=>!x.synced&&x.user_id===remote.user_id)) {
   void syncMarket().catch(err=>marketOcrMessage('sync-error',
    'Fee saved locally; retrying account sync: '+String(err.message).slice(0,100)));
  }
 },3000);
 void sampleMarketFrame();
 void syncMarket().catch(err=>marketOcrMessage('sync-error',
  'Pending fee upload failed: '+String(err.message).slice(0,100)));
}
async function stopMarketOcr() {
 if(marketSampleTimer){clearInterval(marketSampleTimer);marketSampleTimer=null;}
 marketFrameBuffer.clear();
 marketLiveCapture.stop();
 lastMarketPreviewPng=null;lastMarketPreviewAt=null;
 marketOcrStatus.staleVideo=false;
 marketOcrStatus.framesBuffered=0;
 if(marketOcrTimer){clearInterval(marketOcrTimer);marketOcrTimer=null;}
 if(marketOcrWorker){const worker=marketOcrWorker;marketOcrWorker=null;await worker.terminate();}
 recentMarket.clear();lastMarketFrame=null;lastMarketSeenAt=0;
 marketOcrMessage('waiting','Sign in to resume Market reading.');
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
    charKey(state.activeCharacter.character,state.activeCharacter.server)!==charKey(active.character,active.server) ||
    state.activeCharacter.selectionSource==='lobby-roster' ||
    Number(state.activeCharacter.serverId)!==Number(serverId);
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
      lobbyRosterPackets:value(message.lobbyRosterPackets),
      lobbyRosterCharacters:value(message.lobbyRosterCharacters),
      characterPackets:value(message.characterPackets),rosterPackets:value(message.rosterPackets),
      ticketPackets:value(message.ticketPackets),
      inventoryFrames:value(message.inventoryFrames),
      itemUpdates:value(message.itemUpdates),
      itemDeltas:value(message.itemDeltas),
      itemStacks:value(message.itemStacks),
      groundItems:value(message.groundItems),
      groundPickups:value(message.groundPickups),
      groundMatches:value(message.groundMatches),
      unboundWalletReadings:value(message.unboundWalletReadings),
      boundWalletReadings:value(message.boundWalletReadings),
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
      else if(h.lobbyRosterCharacters>0 && h.identities===0)
        captureStatus.message='Detected '+h.lobbyRosterCharacters+
          ' character(s) in the account lobby. Waiting for an active world character record; existing characters are already in the list.';
      else if(h.lobbyRosterPackets>0 && h.lobbyRosterCharacters===0)
        captureStatus.message='Received '+h.lobbyRosterPackets+
          ' lobby character-list message(s), but could not validate their fields. A lobby decoder update is needed.';
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
    // A single playable character on the account is unambiguous as a profile.
    // Selection is NOT considered confirmation of a currently logged-in world character.
    if(!state.activeCharacter && state.profiles.length===1 && found===1) {
      const only=state.profiles[0];
      state.activeCharacter={character:only.character,server:only.server,
        serverId:Number(only.serverId)||null,selectionSource:'lobby-roster'};
      changed=true;
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
    width:332, height:440, minWidth:332, minHeight:440,
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
async function runStartupSmoke() {
 let worker=null;
 const watchdog=setTimeout(()=>{
  console.error('OCR startup smoke timed out after 90 seconds.');
  app.exit(1);
 },90000);
 try {
  // Exercise the actual bundled OCR dependency from Electron's Node runtime.
  // Static source checks under host Node 22 did not catch the import.source()
  // syntax error thrown by wasm-feature-detect 1.9.0 in packaged Electron.
  const {createWorker}=require('tesseract.js');
  if(typeof createWorker!=='function')throw new Error('OCR worker API unavailable.');
  worker=await createWorker('eng');
  if(!worker||typeof worker.recognize!=='function')
   throw new Error('Tesseract OCR worker failed to initialize.');
  const fixture=require('./ocr-smoke-fixture.cjs');
  const output=await worker.recognize(fixture,{}, {tsv:true});
  if(!/REGISTRATION\s+FEE/i.test(output.data?.text||''))
   throw new Error('Packaged Tesseract returned no readable registration fee text from the known PNG fixture.');
  console.log('ATREIA_OCR_SMOKE_OK');
  await worker.terminate();
  worker=null;
  clearTimeout(watchdog);
  app.exit(0);
 } catch(err){
  console.error('ATREIA_OCR_SMOKE_FAILED',err);
  if(worker)try{await worker.terminate();}catch{}
  clearTimeout(watchdog);
  app.exit(1);
 }
}
app.whenReady().then(()=>{
  if(STARTUP_SMOKE){void runStartupSmoke();return;}
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
    saveSecureSession();
    startMarketOcr();
    try {await characters();}
    catch(err){marketOcrMessage('mapping-error',
      'Automatic Market capture is running, but website character mapping failed: '+
      String(err.message).slice(0,90));}
    notify();
    return {email,characters:remote.characters};
  });
  ipcMain.handle('remote:logout',()=>{remote=null;clearSecureSession();void stopMarketOcr();notify();return true;});
  ipcMain.handle('remote:sync',sync);
  ipcMain.handle('market:scan',async()=>{await sampleMarketFrame();return marketOcrStatus;});
  ipcMain.handle('market:preview',()=>{
   if(!remote)return {error:'Sign in to inspect the local game-window capture.'};
   if(!lastMarketPreviewPng||!lastMarketPreviewAt)
    return {error:'No AION2 window captured yet.'};
   return {dataUrl:'data:image/png;base64,'+lastMarketPreviewPng.toString('base64'),
    capturedAt:new Date(lastMarketPreviewAt).toISOString()};
  });
  ipcMain.handle('website:open',()=>shell.openExternal(WEBSITE));
  app.on('activate',()=>showMain());
  app.on('before-quit',()=>{if(marketOcrTimer)clearInterval(marketOcrTimer);if(marketSampleTimer)clearInterval(marketSampleTimer);marketLiveCapture.stop();marketFrameBuffer.clear();});
  createWindow();
  void restoreSecureSession();
  if (state.settings.overlayEnabled)createOverlay();
  if (state.settings.autoCapture) {
    try { startCapture(state.settings.gamePort); }
    catch (err) { captureMessage('error',err.message); }
  }
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(feed?.timer)clearInterval(feed.timer);stopCapture();});
