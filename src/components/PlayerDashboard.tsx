import React,{useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowUpRight,Bookmark,BookOpen,CalendarClock,Check,ChevronDown,ChevronUp,Clock3,Plus,Save,ShieldCheck,Trash2,UserRound} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {ensurePlayerProfile} from '../lib/playerProfile';
import {PLAYER_CLASSES,recommendedGuides,type PlayerProfile,type SuggestedGuide} from '../lib/playerData';
import {globalResetSnapshot,countdown,completionKey,visibleTasks,
  type PlayerCharacter} from '../lib/globalReset';
import {parseChecklistTasks,projectedTickets,ticketOwner,ticketId,type ChecklistTask,type TicketBalance} from '../lib/checklistConfig';

type Props={user:User;checklistItemsJson:string;guides:SuggestedGuide[];onGuide:(slug:string)=>void;onLibrary:()=>void};
type CharDraft={name:string;class_name:string;faction:string;server_name:string;backdrop:PlayerCharacter['backdrop']};
const emptyDraft:CharDraft={name:'',class_name:'',faction:'',server_name:'My server',backdrop:'violet'};
const characterFields='id,user_id,name,class_name,faction,server_name,backdrop,is_main,created_at';
const themes:[PlayerCharacter['backdrop'],string][]=[['violet','Twilight'],['frost','Moonlit'],['ember','Dusk']];
const fail=(err:unknown)=>{const e=err as {message?:string;code?:string};
 return e?.code==='42P01'||e?.code==='PGRST205'
   ? 'Character tracking needs the new Supabase migration. Ask the site owner to run 20261013_character_dashboard.sql.'
   :e?.message||'Could not save your changes. Please try again.';
};

export default function PlayerDashboard({user,checklistItemsJson,guides,onGuide,onLibrary}:Props){
 const [profile,setProfile]=useState<PlayerProfile|null>(null);
 const [accountName,setAccountName]=useState('');
 const [accountEditing,setAccountEditing]=useState(false);
 const [characters,setCharacters]=useState<PlayerCharacter[]>([]);
 const [activeId,setActiveId]=useState('');
 const [characterDraft,setCharacterDraft]=useState<CharDraft>(emptyDraft);
 const [adding,setAdding]=useState(false);
 const [newCharacter,setNewCharacter]=useState<CharDraft>({...emptyDraft});
 const [busy,setBusy]=useState(false);
 const [savingKey,setSavingKey]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);
 const [saved,setSaved]=useState<string[]>([]);
 const [checks,setChecks]=useState<string[]>([]);
 const [ticketRows,setTicketRows]=useState<TicketBalance[]>([]);
 const [ticketDrafts,setTicketDrafts]=useState<Record<string,string>>({});
 const [ticketSetupRequired,setTicketSetupRequired]=useState(false);
 const catalog=useMemo(()=>parseChecklistTasks(checklistItemsJson),[checklistItemsJson]);
 const [guideTab,setGuideTab]=useState<'recommended'|'saved'>('recommended');
 const [now,setNow]=useState(()=>Date.now());
 const resets=useMemo(()=>globalResetSnapshot(new Date(now)),[now]);
 const periodKey=resets.day+':'+resets.week;

 useEffect(()=>{
   const update=()=>setNow(Date.now());
   const timer=window.setInterval(update,1000);
   document.addEventListener('visibilitychange',update);
   return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update);};
 },[]);

 useEffect(()=>{
   if(!supabase)return;
   let active=true;
   const client=supabase;
   setLoading(true);setError('');
   void (async()=>{
     try{
       const [p,c,b,ct,st,bank]=await Promise.all([
         client.from('player_profiles').select('user_id,display_name,class_name,faction').eq('user_id',user.id).maybeSingle(),
         client.from('player_characters').select(characterFields).eq('user_id',user.id).order('created_at',{ascending:true}),
         client.from('player_saved_guides').select('guide_slug').eq('user_id',user.id),
         client.from('player_character_task_completions').select('character_id,task_key,period_start').eq('user_id',user.id).in('period_start',[resets.day,resets.week]),
         client.from('player_server_task_completions').select('server_name,task_key,period_start').eq('user_id',user.id).in('period_start',[resets.day,resets.week]),
         client.from('player_ticket_balances').select('owner_scope,owner_key,task_key,balance,anchor_reset').eq('user_id',user.id)
       ]);
       for(const result of [p,c,b,ct,st])if(result.error)throw result.error;
       const missingBank=Boolean(bank.error&&(bank.error.code==='42P01'||bank.error.code==='PGRST205'||/player_ticket_balances/.test(bank.error.message||'')));
       if(bank.error&&!missingBank)throw bank.error;
       const record=await ensurePlayerProfile(client,user,p.data as PlayerProfile|null);
       let rows=(c.data||[]) as PlayerCharacter[];
       if(!rows.length){
         const created=await client.from('player_characters').insert({
           user_id:user.id,name:record.display_name,class_name:record.class_name,
           faction:record.faction,server_name:'My server',backdrop:'violet',is_main:true
         }).select(characterFields).single();
         if(created.error&&created.error.code!=='23505')throw created.error;
         if(created.data)rows=[created.data as PlayerCharacter];
         else{
           const existing=await client.from('player_characters').select(characterFields).eq('user_id',user.id).order('created_at',{ascending:true});
           if(existing.error)throw existing.error;
           rows=(existing.data||[]) as PlayerCharacter[];
         }
       }
       if(!active)return;
       setProfile(record);setAccountName(record.display_name);
       setCharacters(rows);
       setActiveId(before=>rows.some(c=>c.id===before)?before:rows.find(c=>c.is_main)?.id||rows[0]?.id||'');
       setSaved((b.data||[]).map(r=>r.guide_slug));
       setTicketSetupRequired(missingBank);
       setTicketRows((bank.data||[]) as TicketBalance[]);
       setTicketDrafts({});
       setChecks([
         ...(ct.data||[]).map(r=>'character:'+r.character_id+':'+r.task_key+':'+r.period_start),
         ...(st.data||[]).map(r=>'server:'+r.server_name+':'+r.task_key+':'+r.period_start)
       ]);
     }catch(e){if(active)setError(fail(e));}
     finally{if(active)setLoading(false);}
   })();
   return ()=>{active=false;};
 },[user.id,periodKey]);

 const selected=characters.find(c=>c.id===activeId)||null;
 useEffect(()=>{
   if(selected)setCharacterDraft({name:selected.name,class_name:selected.class_name,
     faction:selected.faction,server_name:selected.server_name,backdrop:selected.backdrop});
 },[selected?.id,selected?.name,selected?.class_name,selected?.faction,selected?.server_name,selected?.backdrop]);

 const validateCharacter=(draft:CharDraft)=>{
   const name=draft.name.trim(),server=draft.server_name.trim();
   if(!name||name.length>40)throw new Error('Use a character name between 1 and 40 characters.');
   if(!server||server.length>48)throw new Error('Use a server name between 1 and 48 characters.');
   return {...draft,name,server_name:server};
 };
 const addCharacter=async(e:React.FormEvent)=>{
   e.preventDefault();if(!supabase||busy)return;
   if(characters.length>=8){setError('This dashboard supports up to eight characters.');return;}
   setBusy(true);setError('');setNotice('');
   try{
     const details=validateCharacter(newCharacter);
     const {data,error:err}=await supabase.from('player_characters')
       .insert({...details,user_id:user.id,is_main:false}).select(characterFields).single();
     if(err)throw err;
     const next=data as PlayerCharacter;
     setCharacters(old=>[...old,next]);setActiveId(next.id);
     setAdding(false);setNewCharacter({...emptyDraft,server_name:details.server_name,backdrop:details.backdrop});
     setNotice('New character added. Its own checklist starts empty.');
   }catch(err){setError(fail(err));}
   finally{setBusy(false);}
 };
 const saveDetails=async(e:React.FormEvent)=>{
   e.preventDefault();if(!selected||!supabase||busy)return;
   setBusy(true);setError('');setNotice('');
   try{
     const details=validateCharacter(characterDraft);
     const {data,error:err}=await supabase.from('player_characters')
       .update(details).eq('user_id',user.id).eq('id',selected.id).select(characterFields).single();
     if(err)throw err;
     setCharacters(old=>old.map(c=>c.id===selected.id?data as PlayerCharacter:c));
     setNotice('Character details and checklist appearance saved.');
   }catch(err){setError(fail(err));}
   finally{setBusy(false);}
 };
 const removeCharacter=async()=>{
   if(!selected||selected.is_main||!supabase||busy)return;
   if(!window.confirm('Remove '+selected.name+'? Its personal checklist history will be deleted. This cannot be undone.'))return;
   setBusy(true);setError('');setNotice('');
   const {error:err}=await supabase.from('player_characters').delete().eq('user_id',user.id).eq('id',selected.id);
   if(err)setError(fail(err));
   else{
     setCharacters(old=>old.filter(c=>c.id!==selected.id));
     setActiveId(characters.find(c=>c.is_main)?.id||'');
     setNotice('Character removed.');
   }
   setBusy(false);
 };
 const saveAccount=async(e:React.FormEvent)=>{
   e.preventDefault();if(!supabase||busy||!profile)return;
   const display_name=accountName.trim();
   if(display_name.length<2||display_name.length>40){setError('Display name must be between 2 and 40 characters.');return;}
   setBusy(true);setError('');setNotice('');
   const {error:err}=await supabase.from('player_profiles').update({display_name,updated_at:new Date().toISOString()})
     .eq('user_id',user.id);
   if(err)setError(fail(err));
   else{setProfile(old=>old?{...old,display_name}:old);setAccountEditing(false);setNotice('Account display name saved.');}
   setBusy(false);
 };
 const taskDone=(task:GameTask)=>Boolean(selected&&checks.includes(completionKey(task,selected,resets.day,resets.week)));
 const toggleTask=async(task:GameTask)=>{
   if(!selected||!supabase||savingKey||loading||error.includes('migration'))return;
   const key=completionKey(task,selected,resets.day,resets.week);
   const done=checks.includes(key);
   const period_start=task.type==='daily'?resets.day:resets.week;
   const table=task.scope==='server'?'player_server_task_completions':'player_character_task_completions';
   const identity=task.scope==='server'?{server_name:selected.server_name}:{character_id:selected.id};
   setSavingKey(key);setError('');setNotice('');
   const request=done
     ? supabase.from(table).delete().eq('user_id',user.id)
       .eq(task.scope==='server'?'server_name':'character_id',task.scope==='server'?selected.server_name:selected.id)
       .eq('task_key',task.key).eq('period_start',period_start)
     : supabase.from(table).upsert({user_id:user.id,...identity,task_key:task.key,period_start},{
       onConflict:task.scope==='server'?'user_id,server_name,task_key,period_start':'user_id,character_id,task_key,period_start',
       ignoreDuplicates:true
     });
   const {error:err}=await request;
   if(err)setError(fail(err));
   else setChecks(old=>done?old.filter(k=>k!==key):[...new Set([...old,key])]);
   setSavingKey('');
 };
 const saveGuide=async(slug:string)=>{
   if(!supabase||savingKey)return;
   setSavingKey(slug);setError('');
   const isSaved=saved.includes(slug);
   const request=isSaved
     ? supabase.from('player_saved_guides').delete().eq('user_id',user.id).eq('guide_slug',slug)
     : supabase.from('player_saved_guides').upsert({user_id:user.id,guide_slug:slug},{
       onConflict:'user_id,guide_slug',ignoreDuplicates:true
     });
   const {error:err}=await request;
   if(err)setError(fail(err));else setSaved(old=>isSaved?old.filter(s=>s!==slug):[...new Set([...old,slug])]);
   setSavingKey('');
 };
 const characterDaily=selected?visibleTasks(catalog.filter(t=>t.type==='daily'),selected):[];
 const characterWeekly=selected?visibleTasks(catalog.filter(t=>t.type==='weekly'),selected):[];
 const dailyDone=characterDaily.filter(taskDone).length;
 const weeklyDone=characterWeekly.filter(taskDone).length;
 const recommend=useMemo(()=>recommendedGuides(guides,profile&&selected?{...profile,class_name:selected.class_name}:profile,saved),[guides,profile,selected?.class_name,saved]);
 const displayed=guideTab==='saved'?guides.filter(g=>saved.includes(g.slug)):recommend;

 const bankEntry=(task:ChecklistTask)=>{
   if(!selected||!task.recharge)return null;
   const owner=ticketOwner(task,selected);
   const id=ticketId(owner,task.key);
   const row=ticketRows.find(r=>ticketId(r,r.task_key)===id)||null;
   const resetKey=task.type==='daily'?resets.day:resets.week;
   const current=row?projectedTickets(row,resetKey,task.recharge,task.type):null;
   return {owner,id,row,current,resetKey};
 };
 const saveBalance=async(task:ChecklistTask,explicit?:number)=>{
   if(!supabase||!user||savingKey||ticketSetupRequired||!task.recharge)return;
   const state=bankEntry(task);if(!state)return;
   const input=explicit??Number(ticketDrafts[state.id]);
   if(!Number.isInteger(input)||input<0||input>task.recharge.cap){
     setError('Enter a whole number of tickets between 0 and '+task.recharge.cap+'.');return;
   }
   setSavingKey('ticket:'+state.id);setError('');setNotice('');
   const {error:err}=await supabase.from('player_ticket_balances').upsert({
     user_id:user.id,...state.owner,task_key:task.key,
     balance:input,anchor_reset:state.resetKey,updated_at:new Date().toISOString()
   },{onConflict:'user_id,owner_scope,owner_key,task_key'}).select('owner_scope,owner_key,task_key,balance,anchor_reset').single();
   if(err)setError(fail(err));
   else {
     setTicketRows(old=>[...old.filter(r=>ticketId(r,r.task_key)!==state.id),
       {...state.owner,task_key:task.key,balance:input,anchor_reset:state.resetKey}]);
     setTicketDrafts(old=>{const next={...old};delete next[state.id];return next;});
   }
   setSavingKey('');
 };

 const fmtDate=(time:number)=>new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(time));

 const renderList=(title:string,tasks:ChecklistTask[],done:number,period:'daily'|'weekly')=>{
   const grouped=[...new Set(tasks.map(t=>t.group))];
   return <section className={'player-panel player-checklist player-scenic player-scenic-'+period+' theme-'+(selected?.backdrop||'violet')}
     aria-label={title} key={period}>
     <div className="player-scenic-art" aria-hidden="true"/>
     <div className="player-scenic-scrim" aria-hidden="true"/>
     <div className="player-checklist-interior">
       <div className="player-panel-top">
         <div><div className="section-kicker left">{period==='daily'?'EVERY DAY':'EVERY WEDNESDAY'}</div>
           <h2>{title}</h2></div><span className="player-count">{done}/{tasks.length}</span>
       </div>
       <div className="player-checklist-progress"><span style={{width:(tasks.length?done/tasks.length*100:0)+'%'}}/></div>
       <p className="player-checklist-caption">{period==='daily'?'Checklist refreshes at the next daily reset':'Checklist refreshes at the next weekly reset'}.
         Banked entries and charges may carry over in-game.</p>
       {grouped.map(group=><div className="player-task-group" key={group}>
         <h3>{group}</h3>
         <div className="player-task-list">
           {tasks.filter(task=>task.group===group).map(task=>{
             const completed=taskDone(task);
             const key=completionKey(task,selected!,resets.day,resets.week);
             const bank=bankEntry(task);
             return <div className="player-task-entry" key={task.key}>
               <label className={'player-task'+(completed?' done':'')}>
                 <input type="checkbox" checked={completed} disabled={loading||Boolean(savingKey)||Boolean(error&&error.includes('migration'))}
                   onChange={()=>void toggleTask(task)}/>
                 <span className="player-task-check"><Check size={15}/></span>
                 <span><strong>{task.label}</strong><small>{task.hint}</small></span>
                 {task.scope==='server'&&<span className="player-shared-tag" title="Shared across characters on this server">SERVER</span>}
                 {savingKey===key&&<span className="player-saving-indicator">Saving…</span>}
               </label>
               {bank&&<div className="player-ticket-tracker">
                 <span className="player-ticket-title">{bank.current===null?'Optional ticket tracker':bank.current+' / '+task.recharge!.cap+' tickets estimated'}</span>
                 <span className="player-ticket-rate">+{task.recharge!.amount} / {task.type==='daily'?'day':'week'} · cap {task.recharge!.cap}</span>
                 {ticketSetupRequired?<small className="player-ticket-error">Ticket saving needs the new Supabase migration.</small>:
                 <form className="player-ticket-controls" onSubmit={e=>{e.preventDefault();void saveBalance(task);}}>
                   <label>
                     <span className="sr-only">{task.label} current tickets</span>
                     <input aria-label={task.label+' current tickets'} type="number" min={0} max={task.recharge!.cap} step={1}
                       value={ticketDrafts[bank.id]??(bank.current===null?'':String(bank.current))}
                       placeholder="Current tickets" disabled={Boolean(savingKey)}
                       onChange={e=>setTicketDrafts(old=>({...old,[bank.id]:e.target.value}))}/>
                   </label>
                   <button type="submit" disabled={Boolean(savingKey)||bank.current===null&&ticketDrafts[bank.id]===undefined}>Save balance</button>
                   {bank.current!==null&&<button type="button" disabled={Boolean(savingKey)||bank.current===0}
                     onClick={()=>void saveBalance(task,Math.max(0,bank.current!-1))}>− 1 used</button>}
                 </form>}
               </div>}
             </div>;
           })}
         </div>
       </div>)}
     </div>
   </section>;
 };
 return <div className="player-dashboard-v2">
   <div className="player-account-overview">
     <div><div className="section-kicker left">ACCOUNT DETAILS</div>
       <div className="player-account-label"><UserRound size={20}/><strong>{profile?.display_name||'Daeva'}</strong>
         <small>{user.email||'Signed in'}</small></div>
     </div>
     <button type="button" className="player-secondary-button" onClick={()=>setAccountEditing(v=>!v)}>
       {accountEditing?<ChevronUp size={16}/>:<ChevronDown size={16}/>} {accountEditing?'Close account details':'Edit account'}
     </button>
   </div>
   {accountEditing&&<form className="player-account-edit player-form" onSubmit={e=>void saveAccount(e)}>
     <label>Account display name<input required minLength={2} maxLength={40} value={accountName} onChange={e=>setAccountName(e.target.value)}/></label>
     <button type="submit" className="player-secondary-button" disabled={busy}><Save size={15}/> Save account</button>
   </form>}
   {notice&&<p className="player-feedback" role="status">{notice}</p>}
   {error&&<p className="player-feedback error" role="alert">{error}</p>}
   {ticketSetupRequired&&<p className="player-feedback error" role="status">The optional ticket counter needs one more Supabase SQL migration. Existing character checklists remain available.</p>}
   {loading?<p className="player-note" role="status">Loading your character roster and checklists…</p>:!selected?
    <p className="player-note">Your character list is unavailable. {error?'Check the migration above.':'Refresh the page to load your main character.'}</p>:<>
     <div className="player-roster-header"><div>
       <div className="section-kicker left">YOUR CHARACTERS</div><h2>Choose your <i>adventurer</i></h2>
     </div><button type="button" className="player-secondary-button" onClick={()=>setAdding(v=>!v)} disabled={characters.length>=8}><Plus size={16}/> Add character</button></div>
     <div className="player-character-tabs" role="tablist" aria-label="Your characters">
       {characters.map(c=><button role="tab" type="button" aria-selected={c.id===selected.id}
         className={'player-character-tab'+(c.id===selected.id?' selected':'')}
         key={c.id} onClick={()=>{setActiveId(c.id);setNotice('');setError('');setAdding(false);}}>
         <span>{c.name}</span><small>{c.class_name||'Adventurer'}{c.is_main?' · MAIN':''}</small>
       </button>)}
     </div>
     {adding&&<form className="player-panel player-character-form player-form" onSubmit={e=>void addCharacter(e)}>
       <strong>New character</strong>
       <div className="player-character-fields">
         <label>Character name<input required maxLength={40} value={newCharacter.name} onChange={e=>setNewCharacter(v=>({...v,name:e.target.value}))}/></label>
         <label>Class<select value={newCharacter.class_name} onChange={e=>setNewCharacter(v=>({...v,class_name:e.target.value}))}>{PLAYER_CLASSES.map(c=><option key={c} value={c}>{c||'Choose a class'}</option>)}</select></label>
         <label>Server<input required maxLength={48} value={newCharacter.server_name} onChange={e=>setNewCharacter(v=>({...v,server_name:e.target.value}))}/></label>
         <label>Faction<select value={newCharacter.faction} onChange={e=>setNewCharacter(v=>({...v,faction:e.target.value}))}><option value="">Choose faction</option><option>Elyos</option><option>Asmodian</option></select></label>
       </div><button className="player-secondary-button" type="submit" disabled={busy}><Plus size={15}/> Create character tab</button>
     </form>}
     <form className="player-panel player-active-character player-form" onSubmit={e=>void saveDetails(e)}>
       <div className="player-panel-top"><div className="section-kicker left">CHARACTER DETAILS · {selected.is_main?'MAIN':'ALT'}</div>
         {!selected.is_main&&<button type="button" className="player-delete-button" onClick={()=>void removeCharacter()} disabled={busy}><Trash2 size={14}/> Remove</button>}
       </div>
       <div className="player-character-fields">
         <label>Name<input required maxLength={40} value={characterDraft.name} onChange={e=>setCharacterDraft(v=>({...v,name:e.target.value}))}/></label>
         <label>Class<select value={characterDraft.class_name} onChange={e=>setCharacterDraft(v=>({...v,class_name:e.target.value}))}>{PLAYER_CLASSES.map(c=><option key={c} value={c}>{c||'Choose a class'}</option>)}</select></label>
         <label>Server<input required maxLength={48} value={characterDraft.server_name} onChange={e=>setCharacterDraft(v=>({...v,server_name:e.target.value}))}/></label>
         <label>Faction<select value={characterDraft.faction} onChange={e=>setCharacterDraft(v=>({...v,faction:e.target.value}))}><option value="">Choose faction</option><option>Elyos</option><option>Asmodian</option></select></label>
         <label>Checklist scenery<select value={characterDraft.backdrop} onChange={e=>setCharacterDraft(v=>({...v,backdrop:e.target.value as CharDraft['backdrop']}))}>{themes.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
       </div>
       <div className="player-character-actions"><span>Server-wide tasks sync across alts with the same server name.</span>
         <button type="submit" className="player-secondary-button" disabled={busy}><Save size={15}/> Save details</button></div>
     </form>
     <section className="player-reset-section" aria-label="Global AION 2 reset timers">
       <div className="player-reset-header"><div className="section-kicker left">GLOBAL RESET TIMERS</div><span><Clock3 size={15}/> UTC 07:00 · LIVE</span></div>
       <div className="player-reset-grid">
         <div className="player-reset-tile"><span>DAILY RESET</span><strong role="timer">{countdown(resets.untilDaily)}</strong>
           <small>{fmtDate(resets.nextDaily)}</small></div>
         <div className="player-reset-tile"><span>WEEKLY RESET</span><strong role="timer">{countdown(resets.untilWeekly)}</strong>
           <small>{fmtDate(resets.nextWeekly)} · Wed 07:00 UTC</small></div>
       </div>
       <p className="player-reset-note"><CalendarClock size={15}/> Community-reported Global schedule. At each reset, this character’s checkmarks roll over automatically.
         Verify official in-game timers after patches or maintenance.</p>
     </section>
     <div className="player-main-checklists">
       {renderList('Daily cooldowns',characterDaily,dailyDone,'daily')}
       {renderList('Weekly cooldowns',characterWeekly,weeklyDone,'weekly')}
     </div>
     <section className="player-panel player-guides-section">
       <div className="player-guides-head"><div><div className="section-kicker left">YOUR FIELD LIBRARY</div><h2>Guides for your journey</h2></div>
         <div className="player-guide-tabs" role="tablist" aria-label="Guide views">
           <button role="tab" aria-selected={guideTab==='recommended'} onClick={()=>setGuideTab('recommended')}><ShieldCheck size={16}/> Recommended</button>
           <button role="tab" aria-selected={guideTab==='saved'} onClick={()=>setGuideTab('saved')}><Bookmark size={16}/> Saved ({saved.length})</button>
         </div>
       </div>
       <div className="player-recommended-grid">{displayed.length?displayed.map(g=><article className="player-guide" key={g.slug}>
         <div><small>{g.category}</small><strong>{g.title}</strong><p>{g.summary}</p></div>
         <div className="player-guide-buttons">
           <button onClick={()=>onGuide(g.slug)}>Read <ArrowUpRight size={14}/></button>
           <button aria-label={(saved.includes(g.slug)?'Remove saved ':'Save ')+g.title}
             title={saved.includes(g.slug)?'Remove bookmark':'Save guide'} disabled={Boolean(savingKey)}
             onClick={()=>void saveGuide(g.slug)}><Bookmark size={16} fill={saved.includes(g.slug)?'currentColor':'none'}/></button>
         </div>
       </article>):<p className="player-panel-description">No guides saved yet. Select Recommended and bookmark one to start your collection.</p>}</div>
       <button className="player-text-button" onClick={onLibrary}>Explore the full guide library <ArrowUpRight size={15}/></button>
     </section>
   </>}
 </div>;
}
