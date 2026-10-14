import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Info} from 'lucide-react';
import type {ChecklistTask} from '../lib/checklistConfig';

type Props={
  task:ChecklistTask;
  checked:boolean;
  disabled:boolean;
  saving:boolean;
  onToggle:()=>void;
  balanceAction?:React.ReactNode;
};

/**
 * Keep dense weekly rows to one line, while preserving their full help text
 * in a viewport-positioned tooltip. The tooltip is portaled to document.body
 * so it is never clipped by the scenic checklist's overflow mask.
 */
export default function WeeklyTaskRow({task,checked,disabled,saving,onToggle,balanceAction}:Props){
  const rowRef=useRef<HTMLDivElement>(null);
  const tooltipRef=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  const [pos,setPos]=useState({left:16,top:16,above:false,width:300});
  const tooltipId='weekly-task-tip-'+task.key;

  const show=()=>{
    const bounds=rowRef.current?.getBoundingClientRect();
    if(!bounds)return;
    const width=Math.min(320,window.innerWidth-32);
    const left=Math.max(16,Math.min(bounds.left,window.innerWidth-width-16));
    // When the row is near the viewport bottom, place the blurb above it.
    const above=window.innerHeight-bounds.bottom<170 && bounds.top>180;
    setPos({left,top:above?bounds.top-9:bounds.bottom+9,above,width});
    setVisible(true);
  };
  const hide=()=>setVisible(false);
  useEffect(()=>{
    if(!visible)return;
    const closeOnScroll=()=>hide();
    const outside=(event:PointerEvent)=>{
      if(!rowRef.current?.contains(event.target as Node))hide();
    };
    window.addEventListener('scroll',closeOnScroll,true);
    window.addEventListener('resize',closeOnScroll);
    document.addEventListener('pointerdown',outside);
    return ()=>{
      window.removeEventListener('scroll',closeOnScroll,true);
      window.removeEventListener('resize',closeOnScroll);
      document.removeEventListener('pointerdown',outside);
    };
  },[visible]);

  useEffect(()=>{
    if(!visible||!tooltipRef.current)return;
    const height=tooltipRef.current.getBoundingClientRect().height;
    // Guard both edges after content wraps (especially on mobile).
    if(pos.above && pos.top-height<12){
      setPos(p=>({...p,top:12+height}));
    }else if(!pos.above && pos.top+height>window.innerHeight-12){
      setPos(p=>({...p,top:Math.max(12,window.innerHeight-height-12)}));
    }
  },[visible,pos.above,pos.top]);

  return <>
    <div ref={rowRef} className={'player-task player-weekly-row'+(checked?' done':'')}
      onMouseEnter={show} onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={event=>{
        if(!event.currentTarget.contains(event.relatedTarget as Node|null))hide();
      }}>
      <label className="player-weekly-label">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle}/>
        <span className="player-task-check"><Check size={15}/></span>
        <strong className="player-weekly-name">{task.label}</strong>
      </label>
      {balanceAction}
      <button type="button" className="player-weekly-info" onClick={show}
        aria-label={'About '+task.label} aria-describedby={visible?tooltipId:undefined}
        title={'More about '+task.label}>
        <Info size={15}/>
      </button>
      {saving&&<span className="player-saving-indicator">Saving…</span>}
    </div>
    {visible&&createPortal(
      <div ref={tooltipRef} id={tooltipId} role="tooltip" className="player-weekly-tooltip"
        style={{left:pos.left,top:pos.top,width:pos.width,transform:pos.above?'translateY(-100%)':undefined}}>
        <div className="player-weekly-tooltip-kicker">{task.group} · Weekly</div>
        <strong>{task.label}</strong>
        {task.hint&&<p>{task.hint}</p>}
        {task.scope==='server'&&<small>Shared across characters on the same server</small>}
        {task.faction&&<small>{task.faction} only</small>}
      </div>,document.body
    )}
  </>;
}
