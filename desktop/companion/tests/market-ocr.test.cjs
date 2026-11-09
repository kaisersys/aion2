'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseMarketText,validateMarketObservation,signature}=require('../market-ocr.cjs');
test('strictly parses a listing fee without asserting a wallet debit',()=>{
 const view=['Market','Sell Item','Item: Courage Scroll (Bound)','Quantity: 100',
  'Unit Price: 850 Kina','Total Price: 85,000 Kina','Registration Fee: 1,000 Kina'].join('\n');
 const event=parseMarketText(view);
 assert.equal(event?.kind,'listing_preview');
 assert.equal(event?.item_name,'Courage Scroll (Bound)');
 assert.equal(event?.quantity,100);
 assert.equal(event?.unit_price,850);
 assert.equal(event?.gross,85000);
 assert.equal(event?.listing_fee,1000);
 assert.equal(event?.currency_kind,'unknown');
 assert.equal(event?.proceeds,null);
 assert.equal(validateMarketObservation(event),true);
});
test('settlement screen remains an observation, not verified Market income',()=>{
 const view=['Market','Settlement','Item: Refining Stone','Quantity: 5',
  'Proceeds: 337,500 Kina'].join('\n');
 const event=parseMarketText(view);
 assert.equal(event?.kind,'settlement_visible');
 assert.equal(event?.proceeds,337500);
 assert.equal(event?.listing_fee,null);
});
test('purchase preview is not silently promoted to a purchase receipt',()=>{
 const view=['Marketplace','Buy Now','Item: Courage Scroll','Quantity: 10',
  'Unit Price: 1,100 Kina','Total Cost: 11,000 Kina'].join('\n');
 const event=parseMarketText(view);
 assert.equal(event?.kind,'purchase_preview');
 assert.equal(event?.gross,11000);
});
test('market navigation can mention other tabs without a false conflicting action',()=>{
 const view=['Market','Buy Now   Settlement   Listing','Sell Item',
  'Item: Courage Scroll','Quantity: 100','Unit Price: 750 Kina',
  'Registration Fee: 500 Kina'].join('\n');
 assert.equal(parseMarketText(view)?.kind,'listing_preview');
});
test('unstructured chat, obscured item, invalid fee and generic amount are ignored',()=>{
 assert.equal(parseMarketText('Market\nKinah 500000\nLost connection'),null);
 assert.equal(parseMarketText('Trade Broker\nListing\nItem: Scroll\nQuantity: 10\nListing Fee: 0 Kina'),null);
 assert.equal(parseMarketText('Market\nSettlement\nItem: Refining Stone\nQuantity: 4\nProceeds: -50 Kina'),null);
 assert.equal(parseMarketText('Some app\nItem: Courage Scroll\nQuantity: 100\nListing Fee: 100 Kina'),null);
});
test('event hash is stable per day/character and changes with transaction details',()=>{
 const a=parseMarketText('Market\nSelling\nItem: Courage Scroll\nQuantity: 3\nUnit Price: 100 Kina\nListing Fee: 10 Kina');
 const b={...a,listing_fee:11};
 assert.ok(a);
 assert.equal(signature(a,'Ceti','NA West','2026-11-09'),signature(a,'Ceti','NA West','2026-11-09'));
 assert.notEqual(signature(a,'Ceti','NA West','2026-11-09'),signature(b,'Ceti','NA West','2026-11-09'));
 assert.notEqual(signature(a,'Ceti','NA West','2026-11-09'),signature(a,'Other','NA West','2026-11-09'));
});
test('rejects forged completed Market receipts or unverified wallet kinds',()=>{
 const observation=parseMarketText('Market\nSelling\nItem: Courage Scroll\nQuantity: 3\nUnit Price: 100 Kina\nListing Fee: 10 Kina');
 assert.equal(validateMarketObservation({...observation,kind:'verified_market_sale'}),false);
 assert.equal(validateMarketObservation({...observation,currency_kind:'bound'}),false);
 assert.equal(validateMarketObservation({...observation,listing_fee:-20}),false);
});
