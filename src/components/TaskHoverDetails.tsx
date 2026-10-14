import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Info} from 'lucide-react';
import type {ChecklistTask} from '../lib/checklistConfig';

type Props={
  task:ChecklistTask;
  children:(infoButton:React.ReactNode)=>React.ReactNode;
};

/**
 * One accessible, floating description for both daily and weekly tasks.
 * Portal outside scenic artwork overflow; allow scrolling longer blurbs.
 */
export default function TaskHoverDetails({task,children}:Props){
  const anchorRef=useRef<HTMLDivElement>(null);
  const tooltipRef=useRef<HTMLDivElement>(null);
  const hideTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [visible,setVisible]=useState(false);
  const [position,setPosition]=useState({left:16,top:16,width:320});
  const tooltipId='player-task-details-'+task.type+'-'+task.key;

  const clearHide=()=>{
    if(hideTimer.current!==null){clearTimeout(hideTimer.current);hideTimer.current=null;}
  };
  const show=()=>{clearHide();setVisible(true);};
  const hide=()=>{clearHide();setVisible(false);};
  const delayHide=()=>{
    clearHide();
    hideTimer.current=setTimeout(()=>{hideTimer.current=null;setVisible(false);},180);
  };

  useLayoutEffect(()=>{
    if(!visible)return;
    const anchor=anchorRef.current?.getBoundingClientRect();
    if(!anchor)return;
    const width=Math.min(430,window.innerWidth-32);
    const measuredHeight=tooltipRef.current?.getBoundingClientRect().height??160;
    const left=Math.max(16,Math.min(anchor.left,window.innerWidth-width-16));
    const below=anchor.bottom+9;
    const above=anchor.top-9-measuredHeight;
    const preferAbove=window.innerHeight-below<measuredHeight+16 && above>=12;
    const wanted=preferAbove?above:below;
    const top=Math.max(12,Math.min(wanted,window.innerHeight-measuredHeight-12));
    setPosition(p=>p.left===left&&p.top===top&&p.width===width?p:{left,top,width});
  },[visible,task.hint,task.label]);

  useEffect(()=>{
    if(!visible)return;
    const onPointer=(e:PointerEvent)=>{
      const target=e.target as Node;
      if(!anchorRef.current?.contains(target)&&!tooltipRef.current?.contains(target))hide();
    };
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')hide();};
    const onScroll=(e:Event)=>{
      if(tooltipRef.current?.contains(e.target as Node))return;
      hide();
    };
    const onResize=()=>hide();
    document.addEventListener('pointerdown',onPointer);
    document.addEventListener('keydown',onKey);
    window.addEventListener('scroll',onScroll,true);
    window.addEventListener('resize',onResize);
    return ()=>{
      document.removeEventListener('pointerdown',onPointer);
      document.removeEventListener('keydown',onKey);
      window.removeEventListener('scroll',onScroll,true);
      window.removeEventListener('resize',onResize);
    };
  },[visible]);
  useEffect(()=>()=>clearHide(),[]);

  const infoButton=<button type="button"
    className={'player-weekly-info player-task-info'+(task.type==='daily'?' player-daily-info':'')}
    onClick={()=>{clearHide();setVisible(was=>!was);}}
    aria-label={'About '+task.label} aria-expanded={visible} aria-describedby={visible?tooltipId:undefined}
    title={'More about '+task.label}><Info size={15}/></button>;

  return <>
    <div ref={anchorRef} className="player-task-hover-anchor"
      onMouseEnter={show} onMouseLeave={delayHide} onFocusCapture={show}
      onBlurCapture={event=>{
        if(!event.currentTarget.contains(event.relatedTarget as Node|null))delayHide();
      }}>
      {children(infoButton)}
    </div>
    {visible&&createPortal(
      <div id={tooltipId} ref={tooltipRef} role="tooltip"
        className="player-weekly-tooltip player-task-tooltip"
        style={{left:position.left,top:position.top,width:position.width}}
        onMouseEnter={clearHide} onMouseLeave={delayHide}>
        <div className="player-weekly-tooltip-kicker">{task.group} · {task.type==='daily'?'Daily':'Weekly'}</div>
        <strong>{task.label}</strong>
        {task.hint&&<p className="player-task-tooltip-description">{task.hint}</p>}
        {task.scope==='server'&&<small>Shared across characters on the same server</small>}
        {task.faction&&<small>{task.faction} only</small>}
      </div>,document.body
    )}
  </>;
}
