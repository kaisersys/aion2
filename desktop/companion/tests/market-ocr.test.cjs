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
