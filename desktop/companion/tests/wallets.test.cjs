'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {calculate} = require('../wallets.js');
const event=(id,currency_kind,balance,occurred_at='2026-11-09T08:00:00Z')=>({
 id,type:'wallet_snapshot',currency_kind,balance,occurred_at
});
const day=Date.parse('2026-11-09T07:00:00Z');
test('Chanter: 462k regular, zero bound, 462k All (never zero)',()=>{
 const w=calculate([event('r','unbound',462000),event('b','bound',0)],day);
 assert.equal(w.regularBalance,462000);
 assert.equal(w.boundBalance,0);
 assert.equal(w.allBalance,462000);
 assert.equal(w.combinedExact,true);
});
test('both nonzero: 1.7m regular + 1.7m bound = 3.4m All',()=>{
 const w=calculate([event('b','bound',1700000),event('u','unbound',1700000)],day);
 assert.equal(w.allBalance,3400000);
});
test('unknown bound in partial capture produces minimum, not fabricated exact zero',()=>{
 const w=calculate([event('r','unbound',462000)],day);
 assert.equal(w.boundBalance,null);
 assert.equal(w.allBalance,null);
 assert.equal(w.minimumAll,462000);
 assert.equal(w.combinedExact,false);
});
test('zero regular and observed bound has valid exact combined result',()=>{
 const w=calculate([event('b','bound',462000),event('r','unbound',0)],day);
 assert.equal(w.allBalance,462000);
});
test('latest observations win even when events arrive out of order',()=>{
 const w=calculate([
  event('new','unbound',462000,'2026-11-09T08:03:00Z'),
  event('old','unbound',390000,'2026-11-09T07:59:00Z'),
  event('b','bound',0,'2026-11-09T08:00:00Z')
 ],day);
 assert.equal(w.regularBalance,462000);
 assert.equal(w.allBalance,462000);
 assert.equal(w.netToday,72000);
});
test('legacy unclassified snapshots are never counted as bound or All',()=>{
 const w=calculate([event('legacy',undefined,0),event('r','unbound',462000)],day);
 assert.equal(w.allBalance,null);
 assert.equal(w.minimumAll,462000);
});
test('no readings never displays an invented zero balance',()=>{
 const w=calculate([],day);
 assert.equal(w.regularBalance,null);
 assert.equal(w.boundBalance,null);
 assert.equal(w.allBalance,null);
 assert.equal(w.minimumAll,null);
});
