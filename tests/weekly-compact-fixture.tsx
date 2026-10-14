import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import WeeklyTaskRow from './components/WeeklyTaskRow';
import type {ChecklistTask} from './lib/checklistConfig';
import './style.css';

const tasks:ChecklistTask[]=[
 {key:'weekly-dungeon',label:'Dungeon Weekly Entry',hint:'Complete your dungeon entry before the weekly reset. Some activities have separate reward caps.\\n\\n'+('This is extended Global dungeon guidance, including recommended steps and reward reminders. '.repeat(17)),type:'weekly',group:'Dungeons',scope:'character'},
 {key:'weekly-pvp',label:'Abyss Participation and Weekly PvP Objectives',hint:'Participation and reward limits may differ by game mode and your progression.',type:'weekly',group:'PvP & Abyss',scope:'character'},
 {key:'weekly-server',label:'Shared Weekly Server Mission',hint:'This objective is shared by all alts playing on the same server.',type:'weekly',group:'Quests',scope:'server'}
];
function Fixture(){
 const [done,setDone]=useState<string[]>([]);
 return <div className="site">
   <main style={{width:'min(100% - 40px,620px)',margin:'100px auto 200px'}}>
    <h1>Compact Weekly Checklist Fixture</h1>
    <section className="player-panel player-checklist player-scenic player-scenic-weekly theme-violet" style={{minHeight:0,marginTop:25}}>
     <div className="player-scenic-art" aria-hidden="true"/>
     <div className="player-scenic-scrim" aria-hidden="true"/>
     <div className="player-checklist-interior">
       <h2>Weekly cooldowns</h2>
       <div className="player-task-group">
        <h3>Activities</h3>
        <div className="player-task-list">
         {tasks.map(t=><div className="player-task-entry player-task-entry-weekly" key={t.key}>
          <WeeklyTaskRow task={t} checked={done.includes(t.key)} disabled={false} saving={false}
            onToggle={()=>setDone(current=>current.includes(t.key)?current.filter(x=>x!==t.key):[...current,t.key])}/>
         </div>)}
        </div>
       </div>
     </div>
    </section>
    <button type="button" style={{marginTop:30,padding:12}}>Outside focus</button>
   </main>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
