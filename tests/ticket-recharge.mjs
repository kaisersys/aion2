import assert from 'node:assert/strict';
import {build} from 'esbuild';
// Bundle the real TypeScript source and its dependency instead of constructing
// a nested data URI that some Node/TS combinations parse incorrectly.
const result=await build({
 entryPoints:['src/lib/checklistConfig.ts'],bundle:true,write:false,
 platform:'node',format:'esm',logLevel:'silent'
});
const {DEFAULT_CHECKLIST_TASKS,validChecklistTasks,parseChecklistTasks,
 projectedTickets,ticketOwner,ticketId}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
assert.ok(DEFAULT_CHECKLIST_TASKS.length>30);
const nightmare=DEFAULT_CHECKLIST_TASKS.find(t=>t.key==='nightmare');
assert.deepEqual(nightmare.recharge,{amount:2,cap:14});
assert.ok(validChecklistTasks(DEFAULT_CHECKLIST_TASKS));
const serialized=JSON.stringify(DEFAULT_CHECKLIST_TASKS);
assert.equal(parseChecklistTasks(serialized).length,DEFAULT_CHECKLIST_TASKS.length);
assert.ok(!validChecklistTasks([...DEFAULT_CHECKLIST_TASKS,nightmare]),'duplicate task keys must be rejected');
assert.ok(!validChecklistTasks([{...nightmare,recharge:{amount:5,cap:2}}]),'recharge rate cannot exceed cap');
assert.ok(!validChecklistTasks([{...nightmare,scope:'everyone'}]),'invalid sharing scope must be rejected');
const snapshot={owner_scope:'character',owner_key:'abc',task_key:'nightmare',balance:5,anchor_reset:'2026-10-13'};
assert.equal(projectedTickets(snapshot,'2026-10-13',nightmare.recharge,'daily'),5);
assert.equal(projectedTickets(snapshot,'2026-10-14',nightmare.recharge,'daily'),7);
assert.equal(projectedTickets(snapshot,'2026-10-15',nightmare.recharge,'daily'),9);
assert.equal(projectedTickets(snapshot,'2026-10-30',nightmare.recharge,'daily'),14);
assert.equal(projectedTickets(snapshot,'2026-10-12',nightmare.recharge,'daily'),5);
const weekly={...snapshot,balance:1,anchor_reset:'2026-10-14'};
assert.equal(projectedTickets(weekly,'2026-10-20',{amount:3,cap:12},'weekly'),1);
assert.equal(projectedTickets(weekly,'2026-10-21',{amount:3,cap:12},'weekly'),4);
const server=ticketOwner({...nightmare,scope:'server'},{id:'123',server_name:'Server A'});
assert.equal(ticketId(server,'nightmare'),'server:Server A:nightmare');
const char=ticketOwner(nightmare,{id:'123',server_name:'Server A'});
assert.equal(ticketId(char,'nightmare'),'character:123:nightmare');
console.log('PASS editable checklist validation, duplicate-key and invalid recharge detection');
console.log('PASS optional tickets project across daily/weekly resets, preserve unused tickets and respect caps');
console.log('PASS per-character and per-server storage ownership');
