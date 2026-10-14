import {DAILY_GAME_TASKS,WEEKLY_GAME_TASKS,type GameTask} from './globalReset';

/** Public tracker catalog; publication is restricted by existing admin_users RLS. */
export type ChecklistTask=GameTask & {recharge?:{amount:number;cap:number}};
export const DEFAULT_CHECKLIST_TASKS:ChecklistTask[]=[
  ...DAILY_GAME_TASKS.map(task=>task.key==='nightmare'
    ? {...task,recharge:{amount:2,cap:14}}:task),
  ...WEEKLY_GAME_TASKS
];
export const CHECKLIST_LIMIT=90;
export const CHECKLIST_JSON_LIMIT=45000;

export function validChecklistTasks(input:unknown):input is ChecklistTask[]{
  if(!Array.isArray(input)||input.length>CHECKLIST_LIMIT)return false;
  const keys=new Set<string>();
  return input.every(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const row=value as Record<string,unknown>;
    if(typeof row.key!=='string'||!/^[-a-z0-9]{1,90}$/.test(row.key)||keys.has(row.key))return false;
    keys.add(row.key);
    if(typeof row.label!=='string'||!row.label.trim()||row.label.length>100)return false;
    if(typeof row.hint!=='string'||row.hint.length>240)return false;
    if(typeof row.group!=='string'||!row.group.trim()||row.group.length>60)return false;
    if(row.type!=='daily'&&row.type!=='weekly')return false;
    if(row.scope!=='character'&&row.scope!=='server')return false;
    if(row.faction!==undefined&&row.faction!=='Elyos'&&row.faction!=='Asmodian')return false;
    if(row.recharge!==undefined){
      if(!row.recharge||typeof row.recharge!=='object'||Array.isArray(row.recharge))return false;
      const r=row.recharge as Record<string,unknown>;
      if(typeof r.amount!=='number'||!Number.isInteger(r.amount)||r.amount<1||r.amount>500)return false;
      if(typeof r.cap!=='number'||!Number.isInteger(r.cap)||r.cap<1||r.cap>100000)return false;
      if(Number(r.amount)>Number(r.cap))return false;
    }
    return true;
  });
}
export function parseChecklistTasks(value:string):ChecklistTask[]{
  try{
    const parsed:unknown=JSON.parse(value);
    return validChecklistTasks(parsed)?parsed:DEFAULT_CHECKLIST_TASKS;
  }catch{return DEFAULT_CHECKLIST_TASKS;}
}

/** Each bank is a user-entered snapshot, never read from their game client. */
export type TicketBalance={
  owner_scope:'character'|'server';
  owner_key:string;task_key:string;balance:number;anchor_reset:string;
};
const startUtc=(key:string)=>Date.parse(key+'T00:00:00Z');
export function projectedTickets(
  saved:TicketBalance,
  period:string,
  rate:{amount:number;cap:number},
  frequency:'daily'|'weekly'
):number{
  const elapsed=startUtc(period)-startUtc(saved.anchor_reset);
  if(!Number.isFinite(elapsed))return Math.min(rate.cap,Math.max(0,saved.balance));
  const periods=Math.max(0,Math.floor(elapsed/(frequency==='daily'?86400000:7*86400000)));
  return Math.min(rate.cap,Math.max(0,saved.balance)+periods*rate.amount);
}
export function ticketOwner(task:ChecklistTask,character:{id:string;server_name:string}){
  return {owner_scope:task.scope,owner_key:task.scope==='server'?character.server_name:character.id};
}
export function ticketId(owner:{owner_scope:string;owner_key:string},key:string){
  return owner.owner_scope+':'+owner.owner_key+':'+key;
}
