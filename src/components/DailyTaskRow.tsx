import React from 'react';
import {Check,Wallet} from 'lucide-react';
import type {ChecklistTask} from '../lib/checklistConfig';
import TaskHoverDetails from './TaskHoverDetails';

type Props={
  task:ChecklistTask;
  checked:boolean;
  disabled:boolean;
  saving:boolean;
  current:number|null;
  onToggle:()=>void;
  onBalance:()=>void;
};

/** Daily rows show activity names, with explanations in a floating tooltip. */
export default function DailyTaskRow({task,checked,disabled,saving,current,onToggle,onBalance}:Props){
  return <TaskHoverDetails task={task}>{infoButton=>
    <div className={'player-task player-daily-row'+(checked?' done':'')}>
      <label className="player-daily-label">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}/>
        <span className="player-task-check"><Check size={15}/></span>
        <span className="player-daily-details">
          <strong>{task.label}</strong>
        </span>
      </label>
      {task.scope==='server'&&<span className="player-shared-tag" title="Shared between characters on the same server">SERVER</span>}
      {infoButton}
      {task.recharge&&<button type="button" className="player-balance-button"
        onClick={onBalance} aria-label={'Balance for '+task.label}>
        <Wallet size={14}/><span>Balance</span>
        {current!==null&&<span className="player-balance-count">{current}</span>}
      </button>}
      {saving&&<span className="player-saving-indicator">Saving…</span>}
    </div>
  }</TaskHoverDetails>;
}
