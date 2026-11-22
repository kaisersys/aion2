'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {screenWallets,walletRegions,WalletStabilizer}=require('../screen-wallet.cjs');
test('explicit labels distinguish regular, bound and combined wallets',()=>{
 assert.deepEqual(screenWallets('Kina 462,000\nKina (All) 462,000'),{unbound:462000,all:462000,bound:0});
 assert.deepEqual(screenWallets('Bound Kina: 100\nRegular Kina: 450\nKina (All): 550'),{bound:100,unbound:450,all:550});
 assert.deepEqual(screenWallets('Kina (All)\n1,700,000'),{all:1700000});
});
test('a combined-only number is never regular Kina',()=>{
 assert.deepEqual(screenWallets('Kina (All): 900,000'),{all:900000});
 assert.deepEqual(screenWallets('Registration Fee 1,435\nTotal Price 71,775\nQuantity: 1'),{});
 assert.deepEqual(screenWallets('Market Funds: 2,000,000'),{});
 assert.deepEqual(screenWallets('Market\\nList\\nRegistration Fee\\nKina 1,435'),{});
});
test('rejects conflicting or malformed OCR currency lines',()=>{
 assert.deepEqual(screenWallets('Regular Kina: 1,000\nRegular Kina: 2,000'),{});
 assert.deepEqual(screenWallets('Regular Kina: 1,000\nBound Kina: 100\nKina (All): 500'),{});
 assert.deepEqual(screenWallets('Regular Kina: 1O00'),{});
 assert.deepEqual(screenWallets('Kina: 1,23,00'),{});
});
test('two separate OCR frames must agree before counting a wallet reading',()=>{
 const m=new WalletStabilizer();
 assert.deepEqual(m.observe({unbound:100},1000),[]);
 assert.deepEqual(m.observe({unbound:100},1000),[]);
 assert.deepEqual(m.observe({unbound:100},2000),[{currency_kind:'unbound',balance:100}]);
 assert.deepEqual(m.observe({unbound:100},3000),[]);
 assert.deepEqual(m.observe({unbound:10000},4000),[]);
 assert.deepEqual(m.observe({unbound:100},5000),[]);
 assert.deepEqual(m.observe({unbound:110},6000),[]);
 assert.deepEqual(m.observe({unbound:110},7000),[{currency_kind:'unbound',balance:110}]);
 m.reset();
 assert.deepEqual(m.observe({unbound:120},8000),[]);
});
test('wallet crop follows the labeled counter and stays in image bounds',()=>{
 const blocks=[{paragraphs:[{lines:[{text:'Kina (All) 1,234',bbox:{x0:900,x1:1030,y0:660,y1:681}}]}]}];
 const r=walletRegions(blocks,1280,720);
 assert.equal(r.length,1);
 assert.ok(r[0].x+r[0].width<=1280);
 assert.ok(r[0].y+r[0].height<=720);
});
