export type ResetScope='character'|'server';
export type GameTask={key:string;label:string;hint:string;type:'daily'|'weekly';scope:ResetScope;group:string;faction?:'Elyos'|'Asmodian'};
export type PlayerCharacter={
 id:string;user_id:string;name:string;class_name:string;faction:string;
 server_name:string;backdrop:'violet'|'frost'|'ember';is_main:boolean;created_at:string
};

// Community-reported AION 2 Global clock, cross-checked against the October 2026
// Steam client data at aion2data.com/checklist. Overrides may be required after patches.
// 16:00 UTC+9 = 07:00 UTC; Wednesday = weekly rollover.
// Do not use the visitor's local calendar date as a period identifier.
export const GLOBAL_RESET_UTC_HOUR=7;
const DAY=86400000;
export function globalResetSnapshot(now:Date=new Date()){
 const t=now.getTime();
 const dayAtReset=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),GLOBAL_RESET_UTC_HOUR);
 const startDaily=t>=dayAtReset?dayAtReset:dayAtReset-DAY;
 const dailyDate=new Date(startDaily);
 const daysSinceWednesday=(dailyDate.getUTCDay()+4)%7;
 const startWeekly=startDaily-daysSinceWednesday*DAY;
 const nextDaily=startDaily+DAY;
 const nextWeekly=startWeekly+7*DAY;
 const toKey=(value:number)=>new Date(value).toISOString().slice(0,10);
 return {day:toKey(startDaily),week:toKey(startWeekly),nextDaily,nextWeekly,
   untilDaily:nextDaily-t,untilWeekly:nextWeekly-t};
}
export function countdown(ms:number){
 const seconds=Math.max(0,Math.floor(ms/1000));
 const hours=Math.floor(seconds/3600);
 const mins=Math.floor(seconds%3600/60);
 const secs=seconds%60;
 return [hours,mins,secs].map(v=>String(v).padStart(2,'0')).join(':');
}
export function completionKey(task:GameTask,character:PlayerCharacter,day:string,week:string){
 return (task.scope==='server'?'server:'+character.server_name:'character:'+character.id)+':'+task.key+':'+(task.type==='daily'?day:week);
}

// The user ticks each activity manually. Recharge counters may bank unused claims:
// the checklist clears, but this UI does NOT claim the game deletes unused tickets.
export const DAILY_GAME_TASKS:GameTask[]=[
 {key:'duty',label:'Duty Missions',hint:'5 per day · shared on server',type:'daily',scope:'server',group:'Quests'},
 {key:'command-quests',label:'Command item quests',hint:'Review the daily quest journal; scroll purchases are weekly',type:'daily',scope:'character',group:'Quests'},
 {key:'nightmare',label:'Nightmare attempts',hint:'+2 daily · banked up to the in-game cap',type:'daily',scope:'character',group:'Dungeons'},
 {key:'conq-krao',label:'Krao Cave · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'conq-urugugu',label:'Urugugu Canyon · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'conq-fire',label:'Fire Temple · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'conq-draupnir',label:'Draupnir · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'conq-vakron',label:'Vakron Sky Island · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'conq-ferocious',label:'Ferocious Horn Den · Conquest',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Conquest'},
 {key:'trans-deus',label:'Deus Research Base · Transcendence',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Transcendence'},
 {key:'trans-arkanis',label:'Shattered Arkanis · Transcendence',hint:'+2 reward claims daily',type:'daily',scope:'character',group:'Transcendence'},
 {key:'invasion',label:'Dimensional Invasion keys',hint:'+1 daily · shared on server',type:'daily',scope:'server',group:'Events'},
 {key:'shugo-server',label:'Shugo Festival · shared keys',hint:'Server-shared daily replenishment',type:'daily',scope:'server',group:'Events'},
 {key:'shugo-character',label:'Shugo Festival · character keys',hint:'Character replenishment',type:'daily',scope:'character',group:'Events'},
 {key:'attendance',label:'Attendance check-in',hint:'Claim the daily reward',type:'daily',scope:'character',group:'Events'}
];
export const WEEKLY_GAME_TASKS:GameTask[]=[
 ...[
  ['krao','Krao Cave'],['urugugu','Urugugu Canyon'],['fire','Fire Temple'],
  ['draupnir','Draupnir'],['vakron','Vakron Sky Island'],['ferocious','Ferocious Horn Den']
 ].map(([id,name]):GameTask=>({key:'explore-'+id,label:name+' · Exploration',hint:'7 reward claims per week',type:'weekly',scope:'character',group:'Exploration'})),
 {key:'raid-ludra',label:'Abyssal Forge · Ludra',hint:'Weekly final boss reward',type:'weekly',scope:'character',group:'Raids & Trials'},
 {key:'subjugation',label:'Subjugation',hint:'3 weekly entries shared across its dungeons',type:'weekly',scope:'character',group:'Raids & Trials'},
 {key:'ascension',label:'Ascension Trial',hint:'3 weekly entries; consider using your strongest gear',type:'weekly',scope:'character',group:'Raids & Trials'},
 {key:'unknown-fissure',label:'Daeva Bio-Research · Unknown Fissure',hint:'14 shared daily-dungeon entries per week',type:'weekly',scope:'server',group:'Dungeons'},
 {key:'abyss-lower',label:'Lower Abyss time',hint:'7 access hours per week',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'abyss-middle',label:'Middle Abyss time',hint:'7 access hours per week',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'abyss-upper',label:'Upper Abyss time',hint:'7 access hours per week',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'arena-single',label:'Arena · Solo',hint:'Check weekly participation/reward caps',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'arena-team',label:'Arena · Team',hint:'Check weekly participation/reward caps',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'arena-strategy',label:'Arena · Strategy',hint:'Check weekly participation/reward caps',type:'weekly',scope:'character',group:'Abyss & PvP'},
 {key:'supply-elyos',label:'Abyss Supply Request · Elyos',hint:'Weekly request tab',type:'weekly',scope:'character',group:'Quests',faction:'Elyos'},
 {key:'supply-asmodian',label:'Abyss Supply Request · Asmodian',hint:'Weekly request tab',type:'weekly',scope:'character',group:'Quests',faction:'Asmodian'},
 {key:'shop-century',label:'Centuryroot Token Shop',hint:'Review weekly purchase limits',type:'weekly',scope:'character',group:'Weekly shops'},
 {key:'shop-command',label:'Command Shop scrolls',hint:'Check PvE scroll allowance',type:'weekly',scope:'server',group:'Weekly shops'},
 {key:'shop-abyss-command',label:'Abyss Command Shop scrolls',hint:'Check PvP scroll allowance',type:'weekly',scope:'server',group:'Weekly shops'},
 {key:'shop-mid-command',label:'Mid Abyss Command Shop',hint:'Check weekly scroll stock',type:'weekly',scope:'server',group:'Weekly shops'},
 {key:'shop-command2',label:'Command Shop · other scrolls',hint:'Check weekly purchase limits',type:'weekly',scope:'server',group:'Weekly shops'},
 {key:'shop-trade-abyss',label:'Trade Shop · Abyss',hint:'Review weekly offers',type:'weekly',scope:'character',group:'Weekly shops'},
 {key:'shop-trade-nightmare',label:'Trade Shop · Nightmare',hint:'Review weekly offers',type:'weekly',scope:'character',group:'Weekly shops'},
 {key:'shop-trade-arena',label:'Trade Shop · Arena',hint:'Review weekly offers',type:'weekly',scope:'character',group:'Weekly shops'},
 {key:'shop-morph',label:'Substance Morph weekly limit',hint:'Check character and server limits',type:'weekly',scope:'character',group:'Weekly shops'}
];
export function visibleTasks(tasks:GameTask[],character:PlayerCharacter){
 return tasks.filter(task=>!task.faction||!character.faction||task.faction===character.faction);
}
