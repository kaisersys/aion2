'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {feeSources}=require('../market-attribution.js');
const base={
 character:'Ceti',server:'S1',kind:'listing_observation',screen_phase:'confirmation',
 fee:23,status:'corroborated',wallet_event_ids:['bound-002']
};
test('only confirmed and wallet-matched registration fees name Kina spending',()=>{
 const index=feeSources([
  base,
  {...base,id:'other',screen_phase:'listing_form',wallet_event_ids:['bound-form']},
  {...base,id:'pending',status:'unverified',wallet_event_ids:['bound-pending']},
  {...base,id:'wrong-player',character:'Silver',wallet_event_ids:['bound-other']}
 ],'Ceti','S1');
 assert.equal(index.size,1);
 assert.equal(index.get('bound-002').fee,23);
 assert.equal(index.has('bound-form'),false);
 assert.equal(index.has('bound-pending'),false);
 assert.equal(index.has('bound-other'),false);
});
test('split fee maps both matching Kina debits; unknown spending stays unknown',()=>{
 const index=feeSources([{...base,fee:25,wallet_event_ids:['bound-2','regular-2']}],'Ceti','S1');
 assert.equal(index.get('bound-2')?.fee,25);
 assert.equal(index.get('regular-2')?.fee,25);
 assert.equal(index.has('unrelated-purchase'),false);
});
