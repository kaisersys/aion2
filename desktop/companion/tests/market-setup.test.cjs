'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const conf=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'main.cjs'),'utf8');
const ui=fs.readFileSync(path.join(root,'ui.js'),'utf8');
test('Windows preview bundles a public project connection config, never a privileged key',()=>{
 assert.match(conf.supabaseUrl,/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
 assert.match(conf.supabaseAnonKey,/^sb_publishable_[A-Za-z0-9_-]+$/);
 assert.ok(!/sb_secret_|service_role|PRIVATE_KEY/.test(JSON.stringify(conf)));
 assert.ok(pkg.build.files.includes('config.json'));
 assert.equal(pkg.version,'0.1.6');
});
test('Market OCR state is visible regardless of selected character',()=>{
 for(const id of ['market-header-status','diagnostic-market-message','diagnostic-market-windows',
  'diagnostic-market-chars','diagnostic-market-fee','diagnostic-market-time',
  'diagnostic-market-evidence','market-scan-diagnostics']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(ui.includes("$('"+id+"')"),id+' must be updated in the UI');
 }
 const statusAt=ui.indexOf("$('market-header-status')");
 const eventsAt=ui.indexOf("const events=(state.events||[])");
 assert.ok(statusAt>=0&&eventsAt>statusAt,'status must render before character wallet activity');
});
test('Market OCR is gated on signed-in account and never stores raw screen contents',()=>{
 assert.ok(main.includes("types:['window']"));
 assert.ok(main.includes("if(!remote){marketOcrMessage('sign-in'"));
 assert.ok(main.includes("safeStorage.encryptString(remote.refresh_token)"));
 assert.ok(main.includes("clearSecureSession();void stopMarketOcr()"));
 assert.ok(!main.includes("writeFileSync('screenshot'"));
});


test('Market scanning begins automatically on sign-in and session restoration',()=>{
 assert.ok(main.includes('marketSampleTimer=setInterval(()=>{void sampleMarketFrame();},850)'),
  'background market sampler must be scheduled');
 assert.ok((main.match(/startMarketOcr\(\);/g)||[]).length>=2,
  'restored sessions and new login should start automatic monitoring');
 assert.ok(main.includes('autoRunning:Boolean(remote && marketSampleTimer && marketOcrTimer)'),
  'UI must receive actual timer status rather than assume monitoring is active');
});
test('Overview never implies Market fee tracking needs a manual scan',()=>{
 assert.ok(!html.includes('id="market-scan"'),
  'manual scan action should not appear in Market overview');
 assert.ok(!ui.includes("$('market-scan').addEventListener"));
 assert.ok(html.includes('Market listings are detected automatically'));
 assert.ok(html.includes('Optional troubleshooting only'));
 assert.ok(html.includes('id="market-scan-diagnostics"'),
  'manual capture may still be requested for diagnostics');
});

test('automatic Market sampler starts before potentially failing character lookup',()=>{
 const login=main.slice(main.indexOf("ipcMain.handle('remote:login'"),
  main.indexOf("ipcMain.handle('remote:logout'"));
 const restore=main.slice(main.indexOf("async function restoreSecureSession()"),
  main.indexOf("function saveMarket()"));
 for(const source of [login,restore]){
  assert.ok(source.indexOf('startMarketOcr();')>=0,
   'Market monitor starts after successful authentication');
  assert.ok(source.indexOf('startMarketOcr();')<source.indexOf('await characters();'),
   'character list fetch must not block automatic Market capture');
  assert.ok(source.includes("marketOcrMessage('mapping-error'"),
   'temporary mapping failure must be visible but nonfatal');
 }
});
