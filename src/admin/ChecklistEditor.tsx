import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowDown,ArrowUp,Plus,RotateCcw,Save,Trash2} from 'lucide-react';
import {getSiteSnapshot,saveSiteContent,type SiteSnapshot} from '../lib/siteContent';
import {CHECKLIST_LIMIT,CHECKLIST_DESCRIPTION_LIMIT,DEFAULT_CHECKLIST_TASKS,parseChecklistTasks,validChecklistTasks,type ChecklistTask} from '../lib/checklistConfig';

type Props={userId:string;onBack:()=>void;onPublished:()=>void};
export default function ChecklistEditor({userId,onBack,onPublished}:Props){
 const [snapshot,setSnapshot]=useState<SiteSnapshot|null>(null);
 const [tasks,setTasks]=useState<ChecklistTask[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState<'daily'|'weekly'>('daily');
 const dirty=useMemo(()=>snapshot!==null&&JSON.stringify(tasks)!==JSON.stringify(parseChecklistTasks(snapshot.values.checklistItemsJson)),[tasks,snapshot]);
 useEffect(()=>{
   let active=true;
   void getSiteSnapshot().then(s=>{
     if(active){setSnapshot(s);setTasks(parseChecklistTasks(s.values.checklistItemsJson));}
   }).catch(e=>{if(active)setError(String(e?.message||e));})
     .finally(()=>{if(active)setLoading(false);});
   return ()=>{active=false;};
 },[]);
 const update=(key:string,patch:Partial<ChecklistTask>)=>{
   setNotice('');setError('');
   setTasks(old=>old.map(t=>t.key===key?{...t,...patch}:t));
 };
 const add=()=>{
   if(tasks.length>=CHECKLIST_LIMIT)return;
   const key='custom-'+crypto.randomUUID().slice(0,12);
   setTasks(old=>[...old,{key,label:'New Global activity',hint:'Describe what players should track',group:'Other',type:filter,scope:'character'}]);
   setNotice('');setError('');
 };
 const remove=(key:string)=>{setTasks(old=>old.filter(t=>t.key!==key));setNotice('');};
 const shift=(key:string,direction:-1|1)=>{
   setTasks(old=>{
     const subset=old.filter(t=>t.type===filter);
     const from=subset.findIndex(t=>t.key===key),to=from+direction;
     if(from<0||to<0||to>=subset.length)return old;
     const next=[...old];
     const a=next.findIndex(t=>t.key===key),b=next.findIndex(t=>t.key===subset[to].key);
     [next[a],next[b]]=[next[b],next[a]];
     return next;
   });
 };
 const publish=async()=>{
   if(!snapshot||saving)return;
   if(!validChecklistTasks(tasks)){setError('Review labels, unique keys, groups, description lengths, and recharge limits before publishing.');return;}
   setSaving(true);setError('');setNotice('');
   try{
     const result=await saveSiteContent({...snapshot.values,checklistItemsJson:JSON.stringify(tasks)},snapshot,userId);
     setSnapshot(result);setTasks(parseChecklistTasks(result.values.checklistItemsJson));
     setNotice('Checklist published. Players receive the updated tasks on their next page load.');
     onPublished();
   }catch(e){setError(String((e as Error)?.message||e));}
   finally{setSaving(false);}
 };
 const restore=()=>{if(!window.confirm('Restore the default checklist to this draft? You can still review it before publishing.'))return;setTasks(DEFAULT_CHECKLIST_TASKS.map(t=>({...t})));setNotice('Defaults loaded in editor. Publish to make them live.');};
 const back=()=>{if(dirty&&!window.confirm('Discard unpublished checklist edits?'))return;onBack();};
 const visible=tasks.filter(t=>t.type===filter);
 return <div className="checklist-editor">
   <button className="back-link" onClick={back}><ArrowLeft size={16}/> BACK TO STUDIO</button>
   <div className="section-kicker left">GUILD STAFF ONLY · PLAYER TRACKERS</div>
   <h1>Checklist <i>Editor</i></h1>
   <p className="page-intro">Manage the Global activity catalog without redeploying. Remove Korea-only entries, change daily/weekly schedules, and configure optional ticket recharges and caps. Existing saved checkmarks use stable task IDs, so renaming a task does not erase progress.</p>
   {error&&<p className="studio-message" role="alert">{error}</p>}
   {notice&&<p className="studio-message" role="status">{notice}</p>}
   {loading?<p>Loading checklist settings…</p>:<>
     <div className="checklist-editor-top">
       <div role="tablist" className="player-guide-tabs" aria-label="Checklist frequency">
         {(['daily','weekly'] as const).map(v=><button role="tab" key={v} aria-selected={filter===v} onClick={()=>setFilter(v)}>{v==='daily'?'Daily':'Weekly'} ({tasks.filter(t=>t.type===v).length})</button>)}
       </div>
       <div className="checklist-editor-actions">
         <button className="studio-quiet-button" type="button" onClick={restore}><RotateCcw size={15}/> Load defaults</button>
         <button className="studio-quiet-button" type="button" onClick={add} disabled={tasks.length>=CHECKLIST_LIMIT}><Plus size={15}/> Add activity</button>
         <button className="gold-button" type="button" onClick={()=>void publish()} disabled={!dirty||saving}><Save size={16}/>{saving?'Publishing…':'Publish checklist'}</button>
       </div>
     </div>
     <p className="player-panel-description">{visible.length} entries displayed. Changing a task's frequency moves it into the other tab. Set recharge only when the Global game version actually replenishes a banked resource.</p>
     <div className="checklist-editor-list">
       {visible.map((t,index)=><section className="checklist-editor-item" key={t.key}>
         <div className="checklist-editor-item-top">
           <span className="section-kicker left">#{index+1} · {t.key}</span>
           <div className="checklist-editor-item-buttons">
             <button aria-label={'Move '+t.label+' up'} type="button" disabled={index===0} onClick={()=>shift(t.key,-1)}><ArrowUp size={15}/></button>
             <button aria-label={'Move '+t.label+' down'} type="button" disabled={index===visible.length-1} onClick={()=>shift(t.key,1)}><ArrowDown size={15}/></button>
             <button aria-label={'Remove '+t.label} type="button" onClick={()=>remove(t.key)}><Trash2 size={15}/></button>
           </div>
         </div>
         <div className="checklist-editor-fields player-form">
           <label>Activity title<input value={t.label} maxLength={100} onChange={e=>update(t.key,{label:e.target.value})}/></label>
           <label>Group<input value={t.group} maxLength={60} onChange={e=>update(t.key,{group:e.target.value})}/></label>
           <label className="full checklist-description-field">Hover / tap description
             <textarea rows={4} value={t.hint} maxLength={CHECKLIST_DESCRIPTION_LIMIT}
               onChange={e=>update(t.key,{hint:e.target.value})}
               placeholder="Explain the activity, rewards, limits, and anything players should know about the Global version."/>
             <span className="checklist-description-meta">
               <span>Shown in the daily and weekly activity popover. Supports multiple paragraphs.</span>
               <span>{t.hint.length.toLocaleString()} / {CHECKLIST_DESCRIPTION_LIMIT.toLocaleString()} characters</span>
             </span>
           </label>
           <label>Reset<select value={t.type} onChange={e=>update(t.key,{type:e.target.value as 'daily'|'weekly'})}><option value="daily">Daily · 07:00 UTC</option><option value="weekly">Wednesday · 07:00 UTC</option></select></label>
           <label>Shared by<select value={t.scope} onChange={e=>update(t.key,{scope:e.target.value as 'character'|'server'})}><option value="character">Each character</option><option value="server">All characters on the same server</option></select></label>
           <label>Faction<select value={t.faction||''} onChange={e=>{
             const faction=e.target.value as 'Elyos'|'Asmodian'|'';
             const next={...t};if(!faction)delete next.faction;else next.faction=faction;
             setTasks(old=>old.map(item=>item.key===t.key?next:item));
           }}><option value="">Both factions</option><option value="Elyos">Elyos only</option><option value="Asmodian">Asmodian only</option></select></label>
         </div>
         <div className="checklist-recharge-settings">
           <label className="checklist-recharge-switch"><input type="checkbox" checked={Boolean(t.recharge)}
             onChange={e=>{
               if(e.target.checked)update(t.key,{recharge:{amount:1,cap:14}});
               else setTasks(old=>old.map(v=>{if(v.key!==t.key)return v;const next={...v};delete next.recharge;return next;}));
             }}/> Track rechargeable tickets</label>
           {t.recharge&&<div className="checklist-recharge-fields player-form">
             <label>Tickets added per {t.type==='daily'?'daily':'weekly'} reset
               <input type="number" min={1} max={500} value={t.recharge.amount}
                 onChange={e=>update(t.key,{recharge:{...t.recharge!,amount:Number(e.target.value)}})}/></label>
             <label>Maximum stored tickets
               <input type="number" min={1} max={100000} value={t.recharge.cap}
                 onChange={e=>update(t.key,{recharge:{...t.recharge!,cap:Number(e.target.value)}})}/></label>
           </div>}
         </div>
       </section>)}
     </div>
     <div className="checklist-editor-bottom">
       <span>{dirty?'Unpublished changes':'Checklist changes are saved'}</span>
       <button className="gold-button" type="button" onClick={()=>void publish()} disabled={!dirty||saving}><Save size={16}/> Publish checklist</button>
     </div>
   </>}
 </div>;
}
