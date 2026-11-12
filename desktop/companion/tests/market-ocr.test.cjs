'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readMarket,amount,stableFingerprint}=require('../market-ocr.cjs');
test('extracts explicit listing price and fee without inventing a sale',()=>{
 const x=readMarket('Market\nRegister Item\nItem Name: Courage Scroll\nQuantity: 100\nTotal Price: 500,000\nListing Fee: 10,000');
 assert.equal(x.status,'observed');
 assert.deepEqual(x.evidence,{kind:'listing_observation',amount:500000,fee:10000,quantity:100,item_name:'Courage Scroll'});
});
test('extracts a settlement as an unverified observation, not gross proceeds',()=>{
 const x=readMarket('Market\nSettlement\nItem: Refining Stone\nQuantity: 5\nSettlement Amount: 337,500');
 assert.equal(x.status,'observed');
 assert.equal(x.evidence.kind,'settlement_observation');
 assert.equal(x.evidence.amount,337500);
 assert.equal(x.evidence.fee,null);
});
test('ignores unrelated UI and ambiguous panels',()=>{
 assert.equal(readMarket('Discord\nListing Fee: 500\nPrice: 1000').status,'unrecognized');
 assert.equal(readMarket('Market\nListing Fee: 500\nSettlement Amount: 2000').status,'ambiguous');
 assert.equal(readMarket('Market\nRegister Item\nTotal Price: 1000').status,'incomplete');
 assert.equal(readMarket('Market\nRegister Item\nTotal Price: 1000\nListing Fee: 2000').status,'incomplete');
});
test('rejects ambiguous OCR numbers, duplicate amounts and impossible values',()=>{
 assert.equal(amount('not a number'),null);
 assert.equal(amount('9999999999999999999999999'),null);
 assert.equal(readMarket('Market\nRegister Item\nTotal Price: 1000\nTotal Price: 2000\nListing Fee: 100').status,'incomplete');
});
test('stable fingerprints differ by character and evidence',()=>{
 const a={kind:'listing_observation',amount:500,fee:5,quantity:2,item_name:'Scroll'};
 assert.notEqual(stableFingerprint('Ceti','S1',a),stableFingerprint('Ceti','S2',a));
 assert.notEqual(stableFingerprint('Ceti','S1',a),stableFingerprint('Ceti','S1',{...a,fee:6}));
});


test('recognizes Global listing with a separate settlement tab label',()=>{
 const screenshot=[
  'Market','Main  List  Settlement','Sale Quantity: 1',
  'Sale Price Per Item: 71,775','Total Sale Price: 71,775',
  'Registration Fee: 1,435'
 ].join('\n');
 const r=readMarket(screenshot);
 assert.equal(r.status,'observed');
 assert.equal(r.evidence.kind,'listing_observation');
 assert.equal(r.evidence.amount,71775);
 assert.equal(r.evidence.fee,1435);
});
test('captures a fee without total asking price and when value is on next line',()=>{
 const r=readMarket('Market\nList\nSettlement\nRegistration Fee\nKina 1,435');
 assert.equal(r.status,'observed');
 assert.deepEqual(r.evidence,{
  kind:'listing_fee_observation',amount:1435,fee:1435,quantity:null,item_name:null
 });
});
test('never attributes fee amount to a sale when listing confirmation was not observed',()=>{
 const r=readMarket('Market\nList\nRegistration Fee 250\nSale Price Per Item: unclear');
 assert.equal(r.status,'observed');
 assert.equal(r.evidence.kind,'listing_fee_observation');
 assert.equal(r.evidence.amount,250);
});
test('computes total from explicitly labelled per-item price and quantity',()=>{
 const r=readMarket('Market\nList\nSale Quantity: 3\nSale Price Per Item: 900\nRegistration Fee 54');
 assert.equal(r.status,'observed');
 assert.equal(r.evidence.amount,2700);
 assert.equal(r.evidence.fee,54);
});
test('does not accept contradictory fees, total prices or mixed listing and settlement',()=>{
 assert.equal(readMarket('Market\nList\nRegistration Fee 100\nRegistration Fee 900').status,'incomplete');
 assert.equal(readMarket('Market\nTotal Price 500\nTotal Price 1000\nRegistration Fee 30').status,'incomplete');
 assert.equal(readMarket('Market\nRegistration Fee 100\nSettlement Amount 300').status,'ambiguous');
});

test('parses screenshot confirmation prompt with Refining Stone 5, total 1,165 and registration fee 23',()=>{
 const screen=[
  'Are you sure you wish to list for sale?',
  'Refining Stone',
  'Total Sale Price 1,165',
  'Sale Price Per Item 233',
  'Registration Fee 23',
  'Funds 478,715',
  'Cancel Confirm'
 ].join('\n');
 const parsed=readMarket(screen);
 assert.equal(parsed.status,'observed');
 assert.equal(parsed.screen_phase,'confirmation');
 assert.deepEqual(parsed.evidence,{
  kind:'listing_observation',amount:1165,fee:23,quantity:5,item_name:'Refining Stone'
 });
});
test('form view is never confirmation just because it has a fee',()=>{
 const parsed=readMarket('Market\nSale Quantity: 5\nTotal Sale Price: 1,165\nRegistration Fee 23');
 assert.equal(parsed.screen_phase,'listing_form');
});
test('registration fee is not confused with Funds balance',()=>{
 const parsed=readMarket('Are you sure you wish to list for sale?\nRegistration Fee 23\nFunds 478,715\nCancel\nConfirm');
 assert.equal(parsed.status,'observed');
 assert.equal(parsed.evidence.amount,23);
 assert.equal(parsed.evidence.fee,23);
});

test('reads currency icon following amount without confusing Funds for registration fee',()=>{
 const x=readMarket('Are you sure you wish to list for sale?\nTotal Sale Price 1,165 ©\nSale Price Per Item 233 ©\nRegistration Fee 23 ◎\nFunds 478,715 ◎\nCancel Confirm');
 assert.equal(x.status,'observed');
 assert.equal(x.screen_phase,'confirmation');
 assert.equal(x.evidence.fee,23);
 assert.equal(x.evidence.amount,1165);
});
