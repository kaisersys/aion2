'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcileFees}=require('../market-fees.cjs');
const session='b'.repeat(32);
const base=Date.UTC(2026,10,9,20,0,0);
function t(n){return new Date(base+n).toISOString();}
function wallet(id,offset,balance,currency) {
 return {id,character:'Ceti',server:'S1',type:'wallet_snapshot',
  source:'decoded',observation_session:session,
  currency_kind:currency,balance,occurred_at:t(offset)};
}
function fee(amount=200,overrides={}){
 return {id:'fee1',character:'Ceti',server:'S1',kind:'listing_fee_observation',
  status:'unverified',fee:amount,amount,occurred_at:t(0),synced:true,...overrides};
}
test('matching bound Kina decrease corroborates a fee exactly once',()=>{
 const candidate=fee();
 const events=[wallet('a',-1000,5000,'bound'),wallet('b',2000,4800,'bound')];
 assert.equal(reconcileFees([candidate],events,base+2000),1);
 assert.equal(candidate.status,'corroborated');
 assert.equal(candidate.currency_kind,'bound');
 assert.deepEqual(candidate.wallet_event_ids,['b']);
 assert.equal(candidate.synced,false);
 assert.equal(reconcileFees([candidate],events,base+2000),0);
});
test('regular Kina spending may corroborate if bound Kina cannot',()=>{
 const candidate=fee(200);
 const events=[wallet('a',-1000,1000,'unbound'),wallet('b',2000,800,'unbound')];
 assert.equal(reconcileFees([candidate],events,base+2000),1);
 assert.equal(candidate.currency_kind,'unbound');
});
test('a split charge across bound and regular Kina must total exactly',()=>{
 const candidate=fee(300);
 const events=[
  wallet('bound-a',-1000,100,'bound'),
  wallet('regular-a',-1000,2000,'unbound'),
  wallet('bound-b',1000,0,'bound'),
  wallet('regular-b',1500,1800,'unbound')
 ];
 assert.equal(reconcileFees([candidate],events,base+1800),1);
 assert.equal(candidate.currency_kind,'mixed');
 assert.deepEqual(candidate.wallet_event_ids,['bound-b','regular-b']);
});
test('no expense is corroborated without a wallet decrease of the correct amount',()=>{
 const candidate=fee(200);
 assert.equal(reconcileFees([candidate],[wallet('a',-1000,5000,'bound'),wallet('b',2000,4900,'bound')],base+2000),0);
 assert.equal(candidate.status,'unverified');
});
test('do not attribute stale, wrong-character or ambiguous debits',()=>{
 const one=fee(), two=fee(200,{id:'fee2',occurred_at:t(1000)});
 const events=[wallet('a',-1000,1000,'bound'),wallet('b',2000,800,'bound')];
 // First matching fee consumes a debit, leaving the second unverified.
 assert.equal(reconcileFees([one,two],events,base+2200),1);
 assert.equal(two.status,'unverified');
 const future=fee(200,{occurred_at:t(100000)});
 assert.equal(reconcileFees([future],events,base+101000),0);
 const wrong=fee(200,{character:'Other'});
 assert.equal(reconcileFees([wrong],events,base+2200),0);
});
test('never treat OCR settlement proceeds as a listing fee',()=>{
 const candidate=fee(200,{kind:'settlement_observation'});
 const events=[wallet('a',-1000,1000,'bound'),wallet('b',2000,800,'bound')];
 assert.equal(reconcileFees([candidate],events,base+2200),0);
});
