import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarClock,Check,Minus,X} from 'lucide-react';
import type {ChecklistTask} from '../lib/checklistConfig';

type Props={
  task:ChecklistTask;
  characterName:string;
  current:number|null;
  pending:boolean;
  setupRequired:boolean;
  onClose:()=>void;
  onSave:(value:number)=>Promise<string|null>;
};

/** Editable ticket snapshots are separate from daily completion checkmarks. */
export default function TicketBalanceDialog({task,characterName,current,pending,setupRequired,onClose,onSave}:Props){
  const titleId=useId(),descriptionId=useId(),inputId=useId();
  const dialogRef=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const inputRef=useRef<HTMLInputElement>(null);
  const [draft,setDraft]=useState(current===null?'':String(current));
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const rate=task.recharge!;
  const valid=draft.trim()!==''&&Number.isInteger(Number(draft))&&Number(draft)>=0&&Number(draft)<=rate.cap;

  useEffect(()=>{
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    inputRef.current?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
      if(event.key!=='Tab'||!dialogRef.current)return;
      const items=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ));
      if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',onKeyDown);
    return ()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=previousOverflow;
      if(opener?.isConnected)opener.focus();
    };
  },[]);

  const apply=async(amount:number)=>{
    if(pending)return;
    if(!Number.isInteger(amount)||amount<0||amount>rate.cap){
      setError('Enter a whole number between 0 and '+rate.cap+'.');setSuccess('');return;
    }
    setError('');setSuccess('');
    const message=await onSave(amount);
    if(message){setError(message);return;}
    setDraft(String(amount));
    setSuccess('Ticket balance saved for '+characterName+'.');
  };
  return createPortal(
    <div className="player-balance-overlay" onMouseDown={event=>{
      if(event.target===event.currentTarget)onClose();
    }}>
      <div ref={dialogRef} className="player-balance-dialog" role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="player-balance-dialog-header">
          <div>
            <div className="section-kicker left">PERSONAL TICKET TRACKER</div>
            <h2 id={titleId}>{task.label}</h2>
            <p id={descriptionId}>Track your available tickets for <strong>{characterName}</strong>.</p>
          </div>
          <button type="button" className="player-balance-close" onClick={onClose}
            aria-label="Close balance dialog"><X size={20}/></button>
        </div>
        <div className="player-balance-summary">
          <div><span>Estimated balance</span><strong>{current===null?'—':current}<small> / {rate.cap}</small></strong></div>
          <div><span>Recharge</span><strong>+{rate.amount}</strong><small> per {task.type==='daily'?'day':'week'}</small></div>
        </div>
        <p className="player-balance-explanation"><CalendarClock size={16}/> Your saved count automatically
          increases at each {task.type==='daily'?'daily':'weekly'} reset, up to the cap. Record tickets you spend in-game to keep this estimate accurate.</p>
        <form className="player-balance-form" onSubmit={event=>{event.preventDefault();void apply(Number(draft));}}>
          <label htmlFor={inputId}>Current tickets</label>
          <p className="player-balance-field-help">Enter the number you currently have in AION 2. You can update it at any time.</p>
          <input ref={inputRef} id={inputId} aria-label={task.label+' current tickets'}
            type="number" inputMode="numeric" min="0" max={rate.cap} step="1"
            placeholder="Enter your ticket count" value={draft} disabled={pending||setupRequired}
            onChange={event=>{setDraft(event.target.value);setError('');setSuccess('');}}/>
          {setupRequired&&<p className="player-balance-dialog-error" role="alert">Ticket saving needs the player ticket balances Supabase migration.</p>}
          {error&&<p className="player-balance-dialog-error" role="alert">{error}</p>}
          {success&&<p className="player-balance-dialog-success" role="status"><Check size={15}/>{success}</p>}
          <div className="player-balance-actions">
            <button className="player-balance-save" type="submit" disabled={!valid||pending||setupRequired}>
              {pending?'Saving…':'Save balance'}
            </button>
            <button type="button" className="player-balance-used"
              disabled={current===null||current<=0||pending||setupRequired}
              onClick={()=>void apply(Math.max(0,(current??0)-1))}><Minus size={15}/> 1 ticket used</button>
            <button type="button" className="player-balance-done" onClick={onClose}>Done</button>
          </div>
        </form>
      </div>
    </div>,document.body
  );
}
