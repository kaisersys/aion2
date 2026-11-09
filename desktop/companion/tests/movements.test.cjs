'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {movements,MAX_MOVEMENT_GAP_MS}=require('../wallets.js');
const day=Date.parse('2026-11-09T07:00:00Z');
const S1='1234567890abcdef1234567890abcdef';
const S2='abcdef1234567890abcdef1234567890';
const e=(id,kind,balance,time,session=S1,source='decoded')=>({
 id,type:'wallet_snapshot',currency_kind:kind,balance,occurred_at:time,
 observation_session:session,source
});
test('one baseline is never counted as a gain or loss',()=>{
 const m=movements([e('first','unbound',1000,'2026-11-09T08:00:00Z')],day);
 assert.equal(m.inToday,0);assert.equal(m.outToday,0);assert.equal(m.changes.length,0);
 assert.equal(m.observations,1);
});
test('regular market-like payout is an observed increase, not a verified market sale',()=>{
 const m=movements([
  e('a','unbound',1000,'2026-11-09T08:00:00Z'),
  e('b','unbound',1800,'2026-11-09T08:01:00Z'),
 ],day);
 assert.equal(m.inToday,800);assert.equal(m.outToday,0);
 assert.equal(m.changes[0].currency,'unbound');
 assert.equal(m.changes[0].direction,'in');
 assert.equal(m.changes[0].amount,800);
 assert.equal(Object.hasOwn(m.changes[0],'reason'),false);
});
test('market-like purchase and bound-only listing fee are observed decreases',()=>{
 const m=movements([
  e('a','unbound',10000,'2026-11-09T08:00:00Z'),
  e('b','bound',500,'2026-11-09T08:00:00Z'),
  e('c','unbound',4000,'2026-11-09T08:01:00Z'),
  e('d','bound',470,'2026-11-09T08:01:00Z')
 ],day);
 assert.equal(m.outToday,6030);
 assert.equal(m.byCurrency.unbound.out,6000);
 assert.equal(m.byCurrency.bound.out,30);
 assert.equal(m.inToday,0);
 assert.equal(m.changes.length,2);
});
test('mixed positive and negative changes are not collapsed to one net value',()=>{
 const m=movements([
  e('a','unbound',100,'2026-11-09T08:00:00Z'),
  e('b','unbound',200,'2026-11-09T08:01:00Z'),
  e('c','unbound',120,'2026-11-09T08:02:00Z'),
  e('d','unbound',170,'2026-11-09T08:03:00Z')
 ],day);
 assert.equal(m.inToday,150);assert.equal(m.outToday,80);assert.equal(m.netToday,70);
});
test('new capture session, long gaps and manual corrections never create fictional movement',()=>{
 const m=movements([
  e('a','unbound',100,'2026-11-09T08:00:00Z',S1),
  e('b','unbound',100000,'2026-11-09T08:03:00Z',S2),
  e('c','unbound',110000,'2026-11-09T09:00:00Z',S2),
  e('d','unbound',120000,'2026-11-09T09:02:00Z',S2,'manual'),
  e('e','unbound',111000,'2026-11-09T09:03:00Z',S2)
 ],day);
 assert.equal(m.inToday,1000);
 assert.equal(m.outToday,0);
 assert.equal(m.changes.length,1);
 assert.equal(MAX_MOVEMENT_GAP_MS,1200000);
});
test('different characters must be prefiltered by the caller, and capture sessions stay distinct',()=>{
 const m=movements([
  e('a','bound',100,'2026-11-09T08:00:00Z',S1),
  e('b','bound',0,'2026-11-09T08:01:00Z',S2),
  e('c','bound',80,'2026-11-09T08:02:00Z',S2)
 ],day);
 assert.equal(m.inToday,80);assert.equal(m.outToday,0);
});
test('changes before reset are not included in today totals, but remain in history',()=>{
 const m=movements([
  e('a','unbound',100,'2026-11-09T06:55:00Z'),
  e('b','unbound',120,'2026-11-09T06:59:00Z'),
  e('c','unbound',140,'2026-11-09T07:01:00Z')
 ],day);
 assert.equal(m.inToday,20);assert.equal(m.changes.length,2);
});
test('duplicate event id cannot double count wallet movements',()=>{
 const a=e('a','unbound',100,'2026-11-09T08:00:00Z');
 const b=e('b','unbound',200,'2026-11-09T08:01:00Z');
 const m=movements([a,b,b],day);
 assert.equal(m.inToday,100);assert.equal(m.changes.length,1);
});
test('old events without observation session are excluded',()=>{
 const a=e('a','unbound',100,'2026-11-09T08:00:00Z');
 const b=e('b','unbound',200,'2026-11-09T08:01:00Z');
 delete a.observation_session;delete b.observation_session;
 const m=movements([a,b],day);
 assert.equal(m.inToday,0);assert.equal(m.observations,0);
});
