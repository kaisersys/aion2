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
 assert.equal(pkg.version,'0.1.3');
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
