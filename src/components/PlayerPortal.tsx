import React, {useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowLeft,ArrowUpRight,Bookmark,CalendarCheck,ShieldCheck,Sparkles} from 'lucide-react';
import {supabase,isSupabaseConfigured} from '../lib/supabase';
import PlayerDashboard from './PlayerDashboard';
import type {SuggestedGuide} from '../lib/playerData';

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
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).has('password-reset'))setMode('password');
    const {data}=supabase?.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY')setMode('password');
    })??{data:null};
    return ()=>data?.subscription.unsubscribe();
  },[]);

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
          options:{data:{display_name:displayName},emailRedirectTo:window.location.origin+'/?welcome=1'}
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

  if(!isSupabaseConfigured)return <main className="player-page inner-page section-wrap narrow">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="section-kicker left">ATREIA STREET ACCOUNTS</div>
    <h1>Player <i>Accounts</i></h1>
    <p className="player-note">Player accounts are not connected to the site's authentication provider yet. The site owner must configure Supabase to enable sign-ups.</p>
  </main>;

  if(!user||mode==='password')return <main className="player-page inner-page section-wrap">
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
        <p className="page-intro">Your characters, reset timers, and guides — all in one place.</p></div>
      <button className="player-signout" onClick={()=>void supabase?.auth.signOut()}>Sign out</button>
    </div>
    <PlayerDashboard user={user} guides={guides} onGuide={onGuide} onLibrary={onLibrary}/>
  </main>;
}
