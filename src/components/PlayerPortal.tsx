import React, {useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowLeft,ArrowUpRight,Bookmark,BookOpen,CalendarCheck,Check,LockKeyhole,LogOut,Save,ShieldCheck,Sparkles,UserRound} from 'lucide-react';
import {supabase,isSupabaseConfigured} from '../lib/supabase';
import {
  DAILY_TASKS,WEEKLY_TASKS,PLAYER_CLASSES,pacificPeriod,taskPeriod,recommendedGuides,
  type PlayerProfile,type PlayerTask,type SuggestedGuide
} from '../lib/playerData';

type Props={user:User|null;guides:SuggestedGuide[];onBack:()=>void;onGuide:(slug:string)=>void;onLibrary:()=>void};
type FormMode='signin'|'signup'|'forgot'|'password';
const friendlyError=(error:{message?:string;code?:string}|null)=>error?.code==='42P01' ||
  /relation .* does not exist|could not find the table/i.test(error?.message||'')
    ? 'Player tracking tables have not been activated yet. The site owner must apply the player-accounts SQL migration in Supabase before progress can be saved.'
    : error?.message||'An unexpected error occurred. Please try again.';

export default function PlayerPortal({user,guides,onBack,onGuide,onLibrary}:Props){
  const [mode,setMode]=useState<FormMode>('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [profile,setProfile]=useState<PlayerProfile|null>(null);
  const [profileDraft,setProfileDraft]=useState({display_name:'',class_name:'',faction:''});
  const [profileSaving,setProfileSaving]=useState(false);
  const [completed,setCompleted]=useState<string[]>([]);
  const [saved,setSaved]=useState<string[]>([]);
  const [activeTask,setActiveTask]=useState<string|null>(null);
  const [activeGuide,setActiveGuide]=useState<string|null>(null);
  const [loading,setLoading]=useState(Boolean(user));
  const [dataError,setDataError]=useState('');
  const [period,setPeriod]=useState(()=>pacificPeriod());
  const periodKey=period.day+':'+period.week;

  useEffect(()=>{
    const checkDate=()=>setPeriod(pacificPeriod());
    const timer=window.setInterval(checkDate,60000);
    document.addEventListener('visibilitychange',checkDate);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',checkDate);};
  },[]);
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).has('password-reset'))setMode('password');
    const {data}=supabase?.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY')setMode('password');
    })??{data:null};
    return ()=>data?.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!user || !supabase){
      setProfile(null);setCompleted([]);setSaved([]);setDataError('');setLoading(false);return;
    }
    const client=supabase;
    let valid=true;
    setLoading(true);setDataError('');setCompleted([]);setSaved([]);setProfile(null);
    void (async()=>{
      try{
        const [p,t,g]=await Promise.all([
          client.from('player_profiles').select('user_id,display_name,class_name,faction').eq('user_id',user.id).maybeSingle(),
          client.from('player_task_completions').select('task_key,period_start').eq('user_id',user.id).in('period_start',[period.day,period.week]),
          client.from('player_saved_guides').select('guide_slug').eq('user_id',user.id)
        ]);
        if(p.error||t.error||g.error)throw p.error||t.error||g.error;
        let record=p.data as PlayerProfile|null;
        if(!record){
          const rawName=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Daeva');
          const safeName=rawName.trim().slice(0,40)||'Daeva';
          const created=await client.from('player_profiles')
            .insert({user_id:user.id,display_name:safeName})
            .select('user_id,display_name,class_name,faction').single();
          if(created.error)throw created.error;
          record=created.data as PlayerProfile;
        }
        if(!valid)return;
        setProfile(record);
        setProfileDraft({display_name:record.display_name,class_name:record.class_name,faction:record.faction});
        setCompleted((t.data||[]).map(row=>row.task_key+':'+row.period_start));
        setSaved((g.data||[]).map(row=>row.guide_slug));
      }catch(e){
        if(valid)setDataError(friendlyError(e as {message?:string;code?:string}));
      }finally{if(valid)setLoading(false);}
    })();
    return ()=>{valid=false;};
  },[user?.id,periodKey]);

  const submitAuth=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase || busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      if(mode==='signup'){
        const displayName=name.trim();
        if(displayName.length<2 || displayName.length>40)throw new Error('Choose a display name between 2 and 40 characters.');
        if(password.length<8)throw new Error('Password must contain at least 8 characters.');
        const {data,error:authError}=await supabase.auth.signUp({
          email:email.trim(),password,
          options:{data:{display_name:displayName},emailRedirectTo:window.location.origin+'/#/account'}
        });
        if(authError)throw authError;
        setNotice(data.session?'Account created! Loading your dashboard.':'Check your inbox for a confirmation link, then return here to sign in. Your account does not grant editing privileges.');
        if(!data.session)setMode('signin');
      }else if(mode==='signin'){
        const {error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(authError)throw authError;
      }else if(mode==='forgot'){
        const {error:authError}=await supabase.auth.resetPasswordForEmail(email.trim(),{
          redirectTo:window.location.origin+'/?password-reset=1'
        });
        if(authError)throw authError;
        setNotice('If an account exists for that email, a password-reset link has been sent.');
      }else if(mode==='password'){
        if(password.length<8)throw new Error('Choose a password with at least 8 characters.');
        const {error:authError}=await supabase.auth.updateUser({password});
        if(authError)throw authError;
        window.history.replaceState(null,'',window.location.origin+'/#/account');
        setMode('signin');setNotice('Password updated. Your account is ready.');
      }
    }catch(err){setError(friendlyError(err as {message?:string;code?:string}));}
    finally{setPassword('');setBusy(false);}
  };

  const saveProfile=async(e:React.FormEvent)=>{
    e.preventDefault();if(!user||!supabase||!profile||profileSaving)return;
    const display_name=profileDraft.display_name.trim();
    if(display_name.length<2||display_name.length>40){setError('Your display name must be between 2 and 40 characters.');return;}
    setProfileSaving(true);setError('');setNotice('');
    const {error:saveError}=await supabase.from('player_profiles')
      .update({display_name,class_name:profileDraft.class_name,faction:profileDraft.faction,updated_at:new Date().toISOString()})
      .eq('user_id',user.id);
    if(saveError)setError(friendlyError(saveError));
    else {setProfile({...profile,display_name,class_name:profileDraft.class_name,faction:profileDraft.faction});setNotice('Profile saved. Guide recommendations have been updated.');}
    setProfileSaving(false);
  };
  const toggleTask=async(task:PlayerTask)=>{
    if(!user||!supabase||dataError||activeTask)return;
    const periodStart=taskPeriod(task,period);
    const key=task.key+':'+periodStart;
    const wasDone=completed.includes(key);
    setActiveTask(key);setError('');setNotice('');
    const request=wasDone
      ? supabase.from('player_task_completions').delete().eq('user_id',user.id).eq('task_key',task.key).eq('period_start',periodStart)
      : supabase.from('player_task_completions').upsert({user_id:user.id,task_key:task.key,period_start:periodStart},{onConflict:'user_id,task_key,period_start'});
    const {error:taskError}=await request;
    if(taskError)setError(friendlyError(taskError));
    else setCompleted(current=>wasDone?current.filter(k=>k!==key):[...current,key]);
    setActiveTask(null);
  };
  const toggleSaved=async(slug:string)=>{
    if(!user||!supabase||dataError||activeGuide)return;
    setActiveGuide(slug);setError('');setNotice('');
    const wasSaved=saved.includes(slug);
    const request=wasSaved
      ? supabase.from('player_saved_guides').delete().eq('user_id',user.id).eq('guide_slug',slug)
      : supabase.from('player_saved_guides').upsert({user_id:user.id,guide_slug:slug},{onConflict:'user_id,guide_slug'});
    const {error:saveError}=await request;
    if(saveError)setError(friendlyError(saveError));
    else setSaved(current=>wasSaved?current.filter(s=>s!==slug):[...current,slug]);
    setActiveGuide(null);
  };
  const dayDone=DAILY_TASKS.filter(t=>completed.includes(t.key+':'+period.day)).length;
  const weekDone=WEEKLY_TASKS.filter(t=>completed.includes(t.key+':'+period.week)).length;
  const suggestions=useMemo(()=>recommendedGuides(guides,profile,saved),[guides,profile,saved]);
  const bookmarks=guides.filter(g=>saved.includes(g.slug));

  if(!isSupabaseConfigured)return <main className="player-page inner-page section-wrap narrow">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="section-kicker left">ATREIA STREET ACCOUNTS</div>
    <h1>Player <i>Accounts</i></h1>
    <p className="player-note">Player accounts are not connected to the site's authentication provider yet. The site owner must configure Supabase to enable sign-ups.</p>
  </main>;

  if(!user)return <main className="player-page inner-page section-wrap">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="player-auth-grid">
      <div className="player-auth-intro">
        <div className="section-kicker left">YOUR JOURNEY · YOUR PROGRESS</div>
        <h1>Make Atreia <i>yours.</i></h1>
        <p>Save your favorite guides, check off daily and weekly goals, and discover what to read next. The dashboard is yours to keep.</p>
        <div className="player-benefits">
          <div><CalendarCheck size={19}/><span>Personal daily and weekly checklists</span></div>
          <div><Bookmark size={19}/><span>Saved guides across your devices</span></div>
          <div><Sparkles size={19}/><span>Suggestions based on your chosen class</span></div>
          <div><ShieldCheck size={19}/><span>Your progress is private to your account</span></div>
        </div>
      </div>
      <div className="player-panel player-auth-card">
        <div className="section-kicker left">{mode==='signup'?'CREATE YOUR ACCOUNT':mode==='forgot'?'RECOVER ACCOUNT':mode==='password'?'UPDATE PASSWORD':'WELCOME BACK'}</div>
        <h2>{mode==='signup'?'Join the codex':mode==='forgot'?'Reset password':mode==='password'?'Choose a new password':'Sign in'}</h2>
        {notice&&<p className="player-feedback" role="status">{notice}</p>}
        {error&&<p className="player-feedback error" role="alert">{error}</p>}
        <form onSubmit={e=>void submitAuth(e)} className="player-form">
          {mode==='signup'&&<label>Display name<input required maxLength={40} minLength={2} autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)} placeholder="Your Daeva name"/></label>}
          {mode!=='password'&&<label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
          {mode!=='forgot'&&<label>{mode==='password'?'New password':'Password'}<input required type="password" minLength={8} autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>}
          <button className="gold-button" type="submit" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':mode==='password'?'Save new password':'Sign in'} <ArrowUpRight size={16}/></button>
        </form>
        <div className="player-auth-links">
          {mode==='signin'?<><button onClick={()=>{setMode('signup');setError('');setNotice('');}}>Create an account</button><button onClick={()=>{setMode('forgot');setError('');setNotice('');}}>Forgot password?</button></>
           :<button onClick={()=>{setMode('signin');setError('');setNotice('');}}>Back to sign in</button>}
        </div>
        <p className="player-fineprint">Accounts are free. Tracking is manual, not linked to your game account. Staff publishing access is separate.</p>
      </div>
    </div>
  </main>;

  return <main className="player-page inner-page section-wrap">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="player-top">
      <div><div className="section-kicker left">ATREIA STREET · PERSONAL CODEX</div>
        <h1>My <i>Dashboard</i></h1>
        <p className="page-intro">Welcome back, {profile?.display_name||'Daeva'}. Keep your journey moving one objective at a time.</p></div>
      <button className="player-signout" onClick={()=>void supabase?.auth.signOut()}><LogOut size={16}/> Sign out</button>
    </div>
    {notice&&<p className="player-feedback" role="status">{notice}</p>}
    {error&&<p className="player-feedback error" role="alert">{error}</p>}
    {dataError&&<p className="player-feedback error" role="alert">{dataError}</p>}
    {loading?<p className="player-note" role="status">Loading your saved progress…</p>:<>
      <div className="player-stats">
        <div className="player-stat"><span>DAILY COMPLETION</span><strong>{dayDone}<small> / {DAILY_TASKS.length}</small></strong><div className="player-meter"><span style={{width:(dayDone/DAILY_TASKS.length*100)+'%'}}/></div></div>
        <div className="player-stat"><span>WEEKLY COMPLETION</span><strong>{weekDone}<small> / {WEEKLY_TASKS.length}</small></strong><div className="player-meter"><span style={{width:(weekDone/WEEKLY_TASKS.length*100)+'%'}}/></div></div>
        <div className="player-stat"><span>SAVED GUIDES</span><strong>{saved.length}</strong><small>Your personal reading list</small></div>
      </div>
      <p className="player-reset-note"><CalendarCheck size={14}/> Tracker periods refresh at midnight Pacific for dailies and Monday midnight Pacific for weeklies. These are website tracking periods, not verified in-game reset times.</p>
      <div className="player-dashboard-grid">
        <div className="player-column">
          {([{title:'Daily checklist',items:DAILY_TASKS,done:dayDone,total:DAILY_TASKS.length},{title:'Weekly checklist',items:WEEKLY_TASKS,done:weekDone,total:WEEKLY_TASKS.length}]).map(group=>
            <section className="player-panel player-checklist" key={group.title}>
              <div className="player-panel-top"><div><div className="section-kicker left">PERSONAL OBJECTIVES</div><h2>{group.title}</h2></div><span className="player-count">{group.done}/{group.total}</span></div>
              <div className="player-task-list">{group.items.map(task=>{
                const key=task.key+':'+taskPeriod(task,period);
                const done=completed.includes(key);
                return <label className={'player-task'+(done?' done':'')} key={key}>
                  <input type="checkbox" checked={done} disabled={Boolean(activeTask)||Boolean(dataError)} onChange={()=>void toggleTask(task)}/>
                  <span className="player-task-check"><Check size={15}/></span>
                  <span><strong>{task.label}</strong><small>{task.hint}</small></span>
                </label>;
              })}</div>
            </section>)}
        </div>
        <div className="player-column">
          <section className="player-panel">
            <div className="player-panel-top"><div className="section-kicker left">CHARACTER PROFILE</div><UserRound size={21}/></div>
            <h2>Your adventurer</h2>
            <form className="player-form" onSubmit={e=>void saveProfile(e)}>
              <label>Display name<input value={profileDraft.display_name} minLength={2} maxLength={40} required onChange={e=>setProfileDraft(v=>({...v,display_name:e.target.value}))}/></label>
              <label>Class<select value={profileDraft.class_name} onChange={e=>setProfileDraft(v=>({...v,class_name:e.target.value}))}>{PLAYER_CLASSES.map(c=><option key={c} value={c}>{c||'Choose your class'}</option>)}</select></label>
              <label>Faction<select value={profileDraft.faction} onChange={e=>setProfileDraft(v=>({...v,faction:e.target.value}))}><option value="">Prefer not to say</option><option value="Elyos">Elyos</option><option value="Asmodian">Asmodian</option></select></label>
              <button type="submit" className="player-secondary-button" disabled={profileSaving||Boolean(dataError)||!profile}><Save size={15}/>{profileSaving?'Saving…':'Save character details'}</button>
            </form>
          </section>
          <section className="player-panel">
            <div className="player-panel-top"><div className="section-kicker left">CURATED FOR YOU</div><Sparkles size={21}/></div>
            <h2>Suggested guides</h2>
            <p className="player-panel-description">Recommended using your class and guide categories.</p>
            <div className="player-guide-list">{suggestions.map(g=><div className="player-guide" key={g.slug}>
              <div><small>{g.category}</small><strong>{g.title}</strong><p>{g.summary}</p></div>
              <div className="player-guide-buttons"><button onClick={()=>onGuide(g.slug)}>Read <ArrowUpRight size={14}/></button><button aria-label={(saved.includes(g.slug)?'Remove saved ':'Save ')+g.title} title={saved.includes(g.slug)?'Remove bookmark':'Save guide'} disabled={Boolean(dataError)||Boolean(activeGuide)} onClick={()=>void toggleSaved(g.slug)}><Bookmark size={16} fill={saved.includes(g.slug)?'currentColor':'none'}/></button></div>
            </div>)}</div>
            <button className="player-text-button" onClick={onLibrary}>Browse all guides <ArrowUpRight size={15}/></button>
          </section>
          <section className="player-panel">
            <div className="player-panel-top"><div className="section-kicker left">PERSONAL READING LIST</div><BookOpen size={21}/></div>
            <h2>Saved guides</h2>
            {bookmarks.length?<div className="player-bookmarks">{bookmarks.map(g=><button key={g.slug} onClick={()=>onGuide(g.slug)}><Bookmark size={14} fill="currentColor"/>{g.title}<ArrowUpRight size={13}/></button>)}</div>
              :<p className="player-panel-description">Bookmark guides from the suggestions above to build your reading list.</p>}
          </section>
        </div>
      </div>
    </>}
  </main>;
}
