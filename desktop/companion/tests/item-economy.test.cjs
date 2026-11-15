'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {attribute}=require('../item-economy.js');
const session='1234567890abcdef1234567890abcdef';
const newSession='abcdef1234567890abcdef1234567890';
const day=Date.parse('2026-11-09T07:00:00Z');
const time=(second)=>new Date(Date.parse('2026-11-09T08:00:00Z')+second*1000).toISOString();
const item=(id,qty,second,opts={})=>({
 id,type:'item_change',item_id:531060004,delta:qty,
 occurred_at:time(second),observation_session:session,source:'decoded',...opts
});
const mov=(id,amount,second,opts={})=>({
 id,amount,direction:amount<0?'out':'in',currency:'unbound',
 occurred_at:time(second),session,...opts,amount:Math.abs(amount)
});
test('groups many Courage Scroll purchases by same item and independent outflows',()=>{
 const events=[
  item('a',50,0),item('b',20,10),
  item('c',100,20)
 ];
 const movements={changes:[mov('w1',-50000,0.2),mov('w2',-20000,10.2),mov('w3',-100000,20.4)]};
 const result=attribute(events,movements,day);
 assert.equal(result.matches.length,3);
 assert.equal(result.groups.length,1);
 assert.equal(result.groups[0].totalQuantity,170);
 assert.equal(result.groups[0].totalKina,170000);
 assert.equal(result.groups[0].item_id,531060004);
 assert.equal(result.groups[0].observations,3);
 assert.equal(result.matches[0].confidence,'possible');
});
test('a wallet outflow with no item gain is not assigned an invented item',()=>{
 const r=attribute([], {changes:[mov('w',-9999,3)]},day);
 assert.equal(r.matches.length,0);
 assert.equal(r.unmatched.length,1);
});
test('mixed inventory changes are ambiguous: no arbitrary cost allocation',()=>{
 const r=attribute([
 item('a',10,0),item('b',5,0.3,{item_id:511060016})
 ],{changes:[mov('w',-5000,0.2)]},day);
 assert.equal(r.matches.length,0);
 assert.equal(r.unmatched[0].reason,'multiple item types nearby');
});
test('item consumption with Kina outflow does not masquerade as a purchase',()=>{
 const r=attribute([item('a',-10,0)],{changes:[mov('w',-5000,0)]},day);
 assert.equal(r.matches.length,0);
});
test('item loss and nearby Kina gain suggest possible sale, not verified market sale',()=>{
 const r=attribute([item('a',-10,0)],{changes:[mov('w',7000,1)]},day);
 assert.equal(r.matches[0].direction,'in');
 assert.equal(r.matches[0].confidence,'possible');
 assert.equal(r.matches[0].unitCost,700);
 assert.equal(Object.hasOwn(r.matches[0],'market'),false);
});
test('market settlement delayed from listing is not falsely assigned to removed inventory',()=>{
 const r=attribute([item('a',-10,0)],{changes:[mov('w',7000,30)]},day);
 assert.equal(r.matches.length,0);
});
test('different sessions do not correlate, even at identical times',()=>{
 const r=attribute([item('a',20,0)],{changes:[mov('w',-5000,0,{session:newSession})]},day);
 assert.equal(r.matches.length,0);
});
test('two wallet outflows do not reuse one item event as two purchases',()=>{
 const r=attribute([item('a',20,0)],{changes:[
 mov('w1',-1000,0),mov('w2',-1000,0.6)
 ]},day);
 assert.equal(r.matches.length,1);
 assert.equal(r.unmatched.length,1);
});
test('old and unverified manual item events are ignored',()=>{
 const r=attribute([item('a',20,0,{source:'manual'})],{changes:[mov('w',-1000,0)]},day);
 assert.equal(r.matches.length,0);
});

const origin=(id,itemEventId,qty,sec,opts={})=>({
 id,type:'item_origin',item_event_id:itemEventId,item_id:531060004,
 quantity:qty,origin:'ground_pickup',source:'decoded',
 observation_session:session,occurred_at:time(sec),...opts
});
test('corroborated ground pickups are excluded from possible Kina purchases',()=>{
 const r=attribute([
  item('loot-a',20,0),
  origin('source-a','loot-a',20,0.3)
 ],{changes:[mov('w',-10000,0.5)]},day);
 assert.equal(r.verifiedGround,1);
 assert.equal(r.groundGroups[0].totalQuantity,20);
 assert.equal(r.matches.length,0);
 assert.equal(r.unmatched.length,1);
});
test('a ground source for the wrong session, quantity or item is ignored',()=>{
 const r=attribute([
  item('loot-a',20,0),
  origin('wrong-session','loot-a',20,0.3,{observation_session:newSession}),
  origin('wrong-quantity','loot-a',21,0.3),
  origin('wrong-id','loot-a',20,0.3,{item_id:511060016}),
  origin('late','loot-a',20,2)
 ],{changes:[mov('w',-10000,0.5)]},day);
 assert.equal(r.verifiedGround,0);
 assert.equal(r.matches.length,1);
 assert.equal(r.matches[0].confidence,'possible');
});
test('one item event cannot be confirmed as two ground pickups',()=>{
 const r=attribute([
  item('loot-a',20,0),
  origin('a','loot-a',20,0.2),
  origin('b','loot-a',20,0.3)
 ],{changes:[]},day);
 assert.equal(r.verifiedGround,1);
 assert.equal(r.groundGroups[0].observations,1);
});
