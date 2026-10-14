import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../src/lib/globalReset.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {globalResetSnapshot,countdown,completionKey,visibleTasks,DAILY_GAME_TASKS,WEEKLY_GAME_TASKS}=
  await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));

const before=globalResetSnapshot(new Date('2026-10-13T06:59:59Z'));
const after=globalResetSnapshot(new Date('2026-10-13T07:00:00Z'));
assert.equal(before.day,'2026-10-12');
assert.equal(after.day,'2026-10-13');
assert.equal(before.untilDaily,1000);
assert.equal(after.untilDaily,86400000);
assert.equal(countdown(before.untilDaily),'00:00:01');

const beforeWeekly=globalResetSnapshot(new Date('2026-10-14T06:59:59Z'));
const afterWeekly=globalResetSnapshot(new Date('2026-10-14T07:00:00Z'));
assert.equal(beforeWeekly.week,'2026-10-07');
assert.equal(afterWeekly.week,'2026-10-14');
assert.equal(beforeWeekly.untilWeekly,1000);
assert.equal(afterWeekly.untilWeekly,7*86400000);

// US West Coast winter reset is Tuesday 23:00 PST, but UTC keys still hold.
const westWinter=globalResetSnapshot(new Date('2026-11-04T06:59:59Z'));
assert.equal(westWinter.week,'2026-10-28');
const winterReset=globalResetSnapshot(new Date('2026-11-04T07:00:00Z'));
assert.equal(winterReset.week,'2026-11-04');

const main={id:'char-1',server_name:'My server',faction:'Elyos'};
const alt={id:'char-2',server_name:'My server',faction:'Elyos'};
const otherServer={id:'char-3',server_name:'Other server',faction:'Asmodian'};
const serverTask=DAILY_GAME_TASKS.find(t=>t.key==='duty');
const ownTask=DAILY_GAME_TASKS.find(t=>t.key==='nightmare');
assert.ok(serverTask&&ownTask);
assert.equal(completionKey(serverTask,main,after.day,after.week),completionKey(serverTask,alt,after.day,after.week));
assert.notEqual(completionKey(serverTask,main,after.day,after.week),completionKey(serverTask,otherServer,after.day,after.week));
assert.notEqual(completionKey(ownTask,main,after.day,after.week),completionKey(ownTask,alt,after.day,after.week));
assert.ok(DAILY_GAME_TASKS.length>=15&&WEEKLY_GAME_TASKS.length>=20);
assert.ok(visibleTasks(WEEKLY_GAME_TASKS,main).some(t=>t.key==='supply-elyos'));
assert.ok(!visibleTasks(WEEKLY_GAME_TASKS,main).some(t=>t.key==='supply-asmodian'));
assert.ok(visibleTasks(WEEKLY_GAME_TASKS,otherServer).some(t=>t.key==='supply-asmodian'));
console.log('PASS Global 07:00 UTC daily & Wednesday weekly boundaries, including Pacific DST');
console.log('PASS server-shared and per-character checklist isolation');
console.log('PASS full tracker activity coverage and faction filters');
