'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {addSpatialRows,numberToken,parseWords}=require('../market-spatial.cjs');
const {readMarket}=require('../market-ocr.cjs');
const headers='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
function word(text,x,y,w=100,h=35) {
 return ['5','1','1','1','1','1',String(x),String(y),String(w),String(h),'94',text].join('\t');
}
// Simplified Tesseract TSV: coordinates correspond to a scaled-up centered
// screenshot with left labels and right monetary values in different blocks.
const tsv=[
 headers,
 word('Total',230,596,109),word('Sale',354,596,93),word('Price',467,596,109),
 word('Sale',229,705,93),word('Price',342,705,107),
 word('Per',469,705,71),word('Item',558,705,92),
 word('Registration',232,888,263),word('Fee',515,888,76),
 word('Funds',232,996,128),
 word('1,165',1297,596,118),word('233',1337,705,78),
 word('23@',1364,872,135,66),word('478,715',1242,995,173)
].join('\n');
const columnwise=[
 'Are you sure you wish to list for sale?',
 'Total Sale Price','Sale Price Per Item','Registration Fee','Funds',
 'Cancel','Refining Stone','1,165 @','233 @','23@','478,715 @'
].join('\n');
test('actual screenshot OCR order: pair the 23 Kina registration fee by its on-screen Y location',()=>{
 const enriched=addSpatialRows(columnwise,tsv);
 assert.equal(enriched.positioned,true);
 assert.equal(enriched.fields['Registration Fee'],23);
 assert.equal(enriched.fields['Total Sale Price'],1165);
 assert.equal(enriched.fields['Sale Price Per Item'],233);
 assert.equal(enriched.fields.Funds,478715);
 const x=readMarket(enriched.text);
 assert.equal(x.status,'observed');
 assert.equal(x.screen_phase,'confirmation');
 assert.equal(x.evidence.fee,23);
 assert.equal(x.evidence.amount,1165);
 assert.equal(x.evidence.quantity,5);
 assert.equal(x.evidence.item_name,'Refining Stone');
});
test('plain text lacks positional fee; positional enrichment changes the result',()=>{
 assert.notEqual(readMarket(columnwise).status,'observed');
 assert.equal(readMarket(addSpatialRows(columnwise,tsv).text).status,'observed');
});
test('never use Funds 478715 as the fee, or invent a registration fee without a label',()=>{
 assert.equal(numberToken('23@'),23);
 assert.equal(numberToken('478,715'),478715);
 const noFee=tsv.split('\n').filter(line=>!line.endsWith('\tRegistration')&&!line.endsWith('\tFee')).join('\n');
 assert.equal(addSpatialRows(columnwise,noFee).fields['Registration Fee'],undefined);
 const x=readMarket(addSpatialRows('Are you sure you wish to list for sale?\nFunds',noFee).text);
 assert.notEqual(x.status,'observed');
});
test('rejects invalid and contradictory OCR positional data',()=>{
 assert.equal(parseWords('invalid').length,0);
 assert.equal(numberToken('23x'),null);
 assert.equal(numberToken('—'),null);
 const conflict=tsv+'\n'+word('99',1364,872);
 assert.equal(addSpatialRows(columnwise,conflict).fields['Registration Fee'],undefined);
});
