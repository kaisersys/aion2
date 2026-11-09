'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {describeServer,serverMatches,discoverProfile,findDiscovered}=require('../discovery.cjs');
test('known Global region server IDs resolve to a region and a server name',()=>{
 assert.equal(describeServer(1204).name,'NA West - Kaisinel');
 assert.equal(describeServer(2304).name,'Europe - Lumiel');
 assert.ok(serverMatches('Kaisinel',1204));
 assert.ok(serverMatches('NA West - Kaisinel',1204));
 assert.equal(serverMatches('NA East - Kaisinel',1204),false);
});
test('discovers character automatically and does not duplicate subsequent packets',()=>{
 const first=discoverProfile([],'Ceti',1204);
 assert.equal(first.changed,true);
 assert.deepEqual(first.profiles.map(p=>p.character),['Ceti']);
 assert.equal(first.profile.serverId,1204);
 const second=discoverProfile(first.profiles,'Ceti',1204);
 assert.equal(second.changed,false);
 assert.equal(second.profiles.length,1);
});
test('different server IDs keep otherwise identical character names separate',()=>{
 const first=discoverProfile([],'Ceti',1204);
 const second=discoverProfile(first.profiles,'Ceti',1304);
 assert.equal(second.profiles.length,2);
 assert.notEqual(second.profile.server,first.profile.server);
});
test('matches existing manual profiles using a verified server alias',()=>{
 const manual=[{character:'Ceti',server:'Kaisinel'}];
 const found=discoverProfile(manual,'Ceti',1204);
 assert.equal(found.profiles.length,1);
 assert.equal(found.profiles[0].serverId,1204);
 assert.equal(findDiscovered(found.profiles,'Ceti',1204)?.server,'Kaisinel');
});
test('unknown IDs do not invent a server label or merge by name only',()=>{
 const one=discoverProfile([],'Ceti',9999);
 assert.equal(one.profile.server,'Aion 2 server 9999');
 const two=discoverProfile(one.profiles,'Ceti',9998);
 assert.equal(two.profiles.length,2);
 assert.equal(describeServer(9999).aliases.length,0);
});
test('invalid or missing character data cannot create a profile',()=>{
 const empty=discoverProfile([],'',1204);
 const invalid=discoverProfile([],'Ceti',-1);
 assert.equal(empty.changed,false);
 assert.equal(invalid.changed,false);
});
