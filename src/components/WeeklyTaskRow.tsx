import React from 'react';
import {Check} from 'lucide-react';
import type {ChecklistTask} from '../lib/checklistConfig';
import TaskHoverDetails from './TaskHoverDetails';

type Props={
  task:ChecklistTask;
  checked:boolean;
  disabled:boolean;
  saving:boolean;
  onToggle:()=>void;
  balanceAction?:React.ReactNode;
};

/** Compact name-only weekly rows share the same scrollable tooltip as dailies. */
export default function WeeklyTaskRow({task,checked,disabled,saving,onToggle,balanceAction}:Props){
  return <TaskHoverDetails task={task}>{infoButton=>
    <div className={'player-task player-weekly-row'+(checked?' done':'')}>
      <label className="player-weekly-label">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}/>
        <span className="player-task-check"><Check size={15}/></span>
        <strong className="player-weekly-name">{task.label}</strong>
      </label>
      {balanceAction}
      {infoButton}
      {saving&&<span className="player-saving-indicator">Saving…</span>}
    </div>
  }</TaskHoverDetails>;
}
