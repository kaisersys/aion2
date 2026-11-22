'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseKinaGains,gainRegions,KinaGainTracker}=require('../screen-activity.cjs');
test('recognizes explicitly positive Kina reward popups, not prices or balances',()=>{
 for(const sample of ['Obtained 250 Kina','You have received 1,200 Kinah','Kina +250','+250 Kina','Kina 250 obtained'])
  assert.deepEqual(parseKinaGains(sample),[{amount:sample.includes('1,200')?1200:250}],sample);
 for(const sample of ['Regular Kina: 250','Kina (All) 3,000','Registration Fee 250 Kina',
  'Market Listing Fee 250 Kina','Kina -250','Kina 250','You spent 250 Kina'])
  assert.deepEqual(parseKinaGains(sample),[],sample);
});
test('persistent reward emits once, a new identical toast can emit again only after disappearance',()=>{
 const tracker=new KinaGainTracker();
 assert.deepEqual(tracker.observe('Kina +100',1000),[]);
 assert.deepEqual(tracker.observe('Kina +100',2000),[{amount:100,occurred_at:new Date(2000).toISOString()}]);
 assert.deepEqual(tracker.observe('Kina +100',3000),[]);
 tracker.observe('nothing',4000);tracker.observe('nothing',5000);
 assert.deepEqual(tracker.observe('Kina +100',6000),[]);
 assert.deepEqual(tracker.observe('Kina +100',7000),[{amount:100,occurred_at:new Date(7000).toISOString()}]);
 tracker.reset();assert.deepEqual(tracker.observe('Kina +100',8000),[]);
});
test('notification OCR crops stay inside game image',()=>{
 const box={paragraphs:[{lines:[{text:'Received 125 Kina',bbox:{x0:1000,x1:1130,y0:680,y1:705}}]}]};
 const regions=gainRegions([box],1280,720);
 assert.equal(regions.length,1);assert.ok(regions[0].x+regions[0].width<=1280);
 assert.ok(regions[0].y+regions[0].height<=720);
});
