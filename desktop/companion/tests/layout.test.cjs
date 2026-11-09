'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const mini=fs.readFileSync(path.join(dir,'overlay.html'),'utf8');
const ui=fs.readFileSync(path.join(dir,'ui.js'),'utf8');
test('main app has Overview and separate, initially hidden Diagnostics tab',()=>{
 for(const id of ['nav-overview','nav-diagnostics','view-overview','view-diagnostics'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="view-diagnostics"[^>]*hidden/);
 assert.match(html,/id="view-overview"[^>]*>/);
 assert.match(ui,/setView\('overview'\)/);
 assert.match(ui,/setView\(name\)/);
});
test('all packet and opcode counters stay only within Diagnostics view',()=>{
 const first=html.indexOf('id="view-diagnostics"');
 const next=html.indexOf('id="view-overview"');
 assert.ok(first>=0 && next>first);
 const diagnostic=html.slice(first,next);
 assert.match(diagnostic,/id="diagnostic-opcodes"/);
 assert.match(diagnostic,/id="diagnostic-packets"/);
 assert.match(diagnostic,/id="game-port"/);
 assert.match(diagnostic,/id="capture-toggle"/);
 assert.doesNotMatch(html.slice(next),/id="diagnostic-/);
});
test('overview and mini contain visible In / Out totals for balance movements',()=>{
 for(const id of ['observed-in','observed-out','observed-net','movement-rows'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const id of ['mini-in','mini-out'])
  assert.match(mini,new RegExp('id="'+id+'"'));
 assert.ok(html.indexOf('wallets.js')<html.indexOf('ui.js'));
 assert.ok(mini.indexOf('wallets.js')<mini.indexOf('overlay.js'));
});
