'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { normalizeEvent, addEvents, summarize, periods }=require('../ledger.cjs');
const at='2026-11-08T12:00:00.000Z';
function event(id,type,fields={},time=at) {
 return normalizeEvent({id,character:'Ceti',server:'NA West',type,occurred_at:time,...fields});
}
test('global rollover is 07 UTC daily and Wednesday weekly',()=>{
 const before=periods(Date.parse('2026-11-04T06:59:00Z'));
 const after=periods(Date.parse('2026-11-04T07:00:00Z'));
 assert.equal(before.day,'2026-11-03');
 assert.equal(before.week,'2026-10-28');
 assert.equal(after.day,'2026-11-04');
 assert.equal(after.week,'2026-11-04');
});
test('deduplicates imported events and separates income and expense',()=>{
 const earned=event('a','kinah_earned',{amount:200});
 const spent=event('b','kinah_spent',{amount:75});
 const wallet=event('c','wallet_snapshot',{balance:1000});
 const result=addEvents([],[earned,earned,spent,wallet]);
 assert.equal(result.events.length,3);
 const summary=summarize(result.events,'Ceti','NA West',Date.parse('2026-11-08T12:30:00Z'));
 assert.equal(summary.dayEarned,200);
 assert.equal(summary.daySpent,75);
 assert.equal(summary.weekEarned,200);
 assert.equal(summary.weekSpent,75);
 assert.equal(summary.wallet.balance,1000);
});
test('balance differences alone never count as earned or spent',()=>{
 const a=event('a','wallet_snapshot',{balance:1000},'2026-11-08T09:00:00Z');
 const b=event('b','wallet_snapshot',{balance:1500},'2026-11-08T10:00:00Z');
 const s=summarize([a,b],'Ceti','NA West',Date.parse('2026-11-08T12:00:00Z'));
 assert.equal(s.dayEarned,0);assert.equal(s.daySpent,0);assert.equal(s.wallet.balance,1500);
});
test('counter snapshot does not survive a daily reset',()=>{
 const a=event('a','counter',{key:'nightmare',frequency:'daily',scope:'character',current:3,maximum:14},
  '2026-11-08T06:50:00Z');
 const b=event('b','counter',{key:'ascension',frequency:'weekly',scope:'character',current:1,maximum:3},
  '2026-11-08T06:50:00Z');
 const s=summarize([a,b],'Ceti','NA West',Date.parse('2026-11-08T09:00:00Z'));
 assert.equal(s.counters.length,1);
 assert.equal(s.counters[0].key,'ascension');
});
test('malformed data and negative Kinah values are rejected',()=>{
 assert.throws(()=>event('x','kinah_earned',{amount:-2}));
 assert.throws(()=>event('x','counter',{key:'invalid key!',frequency:'daily',current:1,maximum:5}));
 assert.throws(()=>event('x','kinah_spent',{amount:NaN}));
});
test('separates characters on same server',()=>{
 const a=event('a','kinah_earned',{amount:250});
 const s=summarize([a],'Other','NA West',Date.parse('2026-11-08T12:10:00Z'));
 assert.equal(s.dayEarned,0);
});

test('unbound and bound wallet snapshots stay separate and never manufacture income',()=>{
 const a=event('wallet-1','wallet_snapshot',{balance:1_200_000,currency_kind:'unbound'},'2026-11-08T08:00:00Z');
 const b=event('wallet-2','wallet_snapshot',{balance:780_000,currency_kind:'bound'},'2026-11-08T08:01:00Z');
 const c=event('wallet-3','wallet_snapshot',{balance:1_202_500,currency_kind:'unbound'},'2026-11-08T08:02:00Z');
 const summary=summarize([a,b,c],'Ceti','NA West',Date.parse('2026-11-08T08:03:00Z'));
 assert.equal(summary.wallets.unbound.balance,1_202_500);
 assert.equal(summary.wallets.bound.balance,780_000);
 assert.equal(summary.unboundNetToday,2500);
 assert.equal(summary.dayEarned,0);
 assert.equal(summary.daySpent,0);
 assert.equal(summary.wallet,null);
});
test('unbound net change is NOT gross earned or spent, and resets daily',()=>{
 const a=event('old','wallet_snapshot',{balance:300,currency_kind:'unbound'},'2026-11-08T06:59:00Z');
 const b=event('b','wallet_snapshot',{balance:400,currency_kind:'unbound'},'2026-11-08T07:01:00Z');
 const c=event('c','wallet_snapshot',{balance:300,currency_kind:'unbound'},'2026-11-08T08:00:00Z');
 const s=summarize([a,b,c],'Ceti','NA West',Date.parse('2026-11-08T08:05:00Z'));
 assert.equal(s.unboundNetToday,-100);
 assert.equal(s.dayEarned,0);
 assert.equal(s.daySpent,0);
});
test('one unbound reading is a baseline, not an invented gain',()=>{
 const s=summarize([
  event('b','wallet_snapshot',{balance:1000,currency_kind:'unbound'})
 ],'Ceti','NA West',Date.parse('2026-11-08T12:05:00Z'));
 assert.equal(s.unboundNetToday,null);
 assert.equal(s.wallets.unbound.balance,1000);
});

test('observation session is preserved for decoded wallet snapshots only',()=>{
 const session='1234567890abcdef1234567890abcdef';
 const decoded=normalizeEvent({
  id:'s1',character:'Ceti',server:'NA West',type:'wallet_snapshot',
  balance:1200,currency_kind:'unbound',source:'decoded',
  observation_session:session,occurred_at:'2026-11-08T12:00:00Z'
 });
 assert.equal(decoded.observation_session,session);
 const manual=normalizeEvent({...decoded,id:'s2',source:'manual'});
 assert.equal(manual.observation_session,undefined);
 const malformed=normalizeEvent({...decoded,id:'s3',observation_session:'not-a-session'});
 assert.equal(malformed.observation_session,undefined);
});
