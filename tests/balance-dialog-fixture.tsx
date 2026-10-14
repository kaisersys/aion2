import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import DailyTaskRow from './components/DailyTaskRow';
import WeeklyTaskRow from './components/WeeklyTaskRow';
import TicketBalanceDialog from './components/TicketBalanceDialog';
import {Wallet} from 'lucide-react';
import type {ChecklistTask} from './lib/checklistConfig';
import './style.css';

const daily:ChecklistTask[]=[
 {key:'nightmare',label:'Nightmare attempts',hint:'+2 tickets per day, banked up to 14',type:'daily',group:'Dungeons',scope:'character',recharge:{amount:2,cap:14}},
 {key:'conquest',label:'Conquest Dungeon',hint:'Claim your daily dungeon rewards',type:'daily',group:'Conquest',scope:'character',recharge:{amount:2,cap:10}},
 {key:'attendance',label:'Attendance check-in',hint:'Claim the daily reward',type:'daily',group:'Events',scope:'character'}
];
const weekly:ChecklistTask={key:'weekly-tickets',label:'Weekly ticket mission',hint:'Optional weekly bank',type:'weekly',group:'Rewards',scope:'character',recharge:{amount:1,cap:7}};
function Fixture(){
 const [done,setDone]=useState<string[]>([]);
 const [balances,setBalances]=useState<Record<string,number>>({nightmare:5});
 const [active,setActive]=useState<ChecklistTask|null>(null);
 const [pending,setPending]=useState(false);
 const toggle=(key:string)=>setDone(old=>old.includes(key)?old.filter(t=>t!==key):[...old,key]);
 const onSave=async(amount:number)=>{
   if(!active)return 'No activity selected';
   setPending(true);
   setBalances(old=>({...old,[active.key]:amount}));
   setPending(false);
   return null;
 };
 return <main style={{width:'min(calc(100% - 36px),720px)',margin:'90px auto 130px'}}>
   <h1>Balance Dialog Fixture</h1>
   <section className="player-panel player-checklist player-scenic player-scenic-daily" style={{minHeight:0,marginTop:25}}>
     <div className="player-scenic-art" aria-hidden="true"/>
     <div className="player-scenic-scrim" aria-hidden="true"/>
     <div className="player-checklist-interior">
       <h2>Daily cooldowns</h2>
       <div className="player-task-group"><h3>Daily objectives</h3><div className="player-task-list">
         {daily.map(task=><div key={task.key} className="player-task-entry">
           <DailyTaskRow task={task} checked={done.includes(task.key)} disabled={false}
             saving={false} current={balances[task.key]??null}
             onToggle={()=>toggle(task.key)} onBalance={()=>setActive(task)}/>
         </div>)}
       </div></div>
     </div>
   </section>
   <section className="player-panel player-checklist player-scenic player-scenic-weekly" style={{minHeight:0,marginTop:20}}>
    <div className="player-checklist-interior"><h2>Weekly cooldowns</h2>
     <div className="player-task-entry player-task-entry-weekly">
      <WeeklyTaskRow task={weekly} checked={done.includes(weekly.key)} disabled={false} saving={false}
        onToggle={()=>toggle(weekly.key)}
        balanceAction={<button className="player-balance-button player-balance-button-weekly" onClick={()=>setActive(weekly)}>
         <Wallet size={13}/> Balance</button>}/>
     </div>
    </div>
   </section>
   {active&&<TicketBalanceDialog key={active.key} task={active} characterName="Ranger Test"
     current={balances[active.key]??null} pending={pending} setupRequired={false}
     onSave={onSave} onClose={()=>setActive(null)}/>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
