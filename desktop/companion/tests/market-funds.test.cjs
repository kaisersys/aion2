'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readMarketFunds,reconcileScreenFunds}=require('../market-funds.cjs');
const base=Date.UTC(2026,10,15,18,0,0);
const at=n=>new Date(base+n).toISOString();
function row(overrides={}){
 return {id:'a',user_id:'user',character:'Ceti',server:'S1',
  kind:'listing_observation',screen_phase:'confirmation',status:'unverified',
  occurred_at:at(0),last_seen_at:at(3000),
  fee:23,funds_before:478715,...overrides};
}
function reading(overrides={}){
 return {user_id:'user',character:'Ceti',server:'S1',funds:478692,
  capturedAt:base+5000,screen_phase:'listing_form',...overrides};
}
test('reads actual Market Funds amount without guessing the currency type',()=>{
 assert.equal(readMarketFunds('Market\nRegistration Fee 23\nFunds 478,715'),478715);
 assert.equal(readMarketFunds('Are you sure you wish to list for sale?\nFunds\n478,715 ◎'),478715);
 assert.equal(readMarketFunds('Market\nFunds 0'),0);
 assert.equal(readMarketFunds('Inventory\nFunds 478,715'),null);
 assert.equal(readMarketFunds('Market\nFunds 100\nFunds 200'),null);
 assert.equal(readMarketFunds('Market\nFunds not available'),null);
});
test('a real post-confirmation exact Funds decrease supports one fee only',()=>{
 const a=row();const b=[a];
 assert.equal(reconcileScreenFunds(b,reading()),1);
 assert.deepEqual(a.funds_match,{before:478715,after:478692,occurred_at:at(5000),source:'market_funds_ocr'});
 assert.equal(a.status,'unverified');
 assert.equal(reconcileScreenFunds(b,reading()),0);
});
test('cannot count a quote, unchanged balance, canceled dialog or mismatched debit',()=>{
 for(const r of [reading({screen_phase:'confirmation'}),reading({funds:478715}),
  reading({funds:478690}),reading({capturedAt:base+100000}),
  reading({capturedAt:base+3000}),reading({character:'SomeoneElse'})]){
  const a=row();assert.equal(reconcileScreenFunds([a],r),0);
  assert.equal(a.funds_match,undefined);
 }
 assert.equal(reconcileScreenFunds([row({screen_phase:'listing_form'})],reading()),0);
});
test('multiple eligible fees cannot share one Funds decrease',()=>{
 const a=row({id:'one'}),b=row({id:'two'});
 assert.equal(reconcileScreenFunds([a,b],reading()),0);
 assert.equal(a.funds_match,undefined);assert.equal(b.funds_match,undefined);
});
test('screen support does not change server-synced status or create wallet events',()=>{
 const a=row();
 assert.equal(reconcileScreenFunds([a],reading()),1);
 assert.equal(a.status,'unverified');
 assert.equal(a.currency_kind,undefined);
 assert.equal(a.wallet_event_ids,undefined);
});
