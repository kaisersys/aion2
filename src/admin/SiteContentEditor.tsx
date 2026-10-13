import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Eye, ImagePlus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_SITE_CONTENT, SITE_CONTENT_GROUPS, getSiteSnapshot,
  normalizeSiteContent, saveSiteContent, siteContentLimit,
  type SiteContent, type SiteContentKey, type SiteSnapshot
} from '../lib/siteContent';

type Props = {
  userId: string; onBack: () => void; onPublished: () => void;
  /** Optional adapters allow isolated browser tests without changing live Supabase data. */
  loadSnapshot?: typeof getSiteSnapshot;
  publishContent?: typeof saveSiteContent;
};
const labelFor=(key:SiteContentKey)=>key
  .replace(/([a-z])([A-Z])/g,'$1 $2')
  .replace(/^(Hero|Intro|Navigation|Featured|Join|Journey|Mission|Recent|About|Library|Footer|Brand|Topic|Category) /i,'')
  .replace(/^([a-z])/,(c)=>c.toUpperCase());
const isLong=(key:SiteContentKey)=>key.toLowerCase().includes('description') || key === 'aboutBio' || key === 'recentEmpty';

export default function SiteContentEditor({userId,onBack,onPublished,loadSnapshot=getSiteSnapshot,publishContent=saveSiteContent}:Props){
  const [snapshot,setSnapshot]=useState<SiteSnapshot|null>(null);
  const [draft,setDraft]=useState<SiteContent>(()=>normalizeSiteContent({}));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [uploadingPortrait,setUploadingPortrait]=useState(false);
  const portraitInput=useRef<HTMLInputElement>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [preview,setPreview]=useState(false);
  const [section,setSection]=useState(0);
  const [revisionIndex,setRevisionIndex]=useState('0');
  const dirty=useMemo(()=>snapshot!==null && JSON.stringify(draft)!==JSON.stringify(snapshot.values),[draft,snapshot]);
  useEffect(()=>{
    let mounted=true;
    void loadSnapshot().then(result=>{
      if(!mounted)return;
      setSnapshot(result);setDraft(result.values);
    }).catch(err=>{if(mounted)setError('Could not load site copy: '+String(err?.message||err));})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[loadSnapshot]);
  useEffect(()=>{
    if(!preview)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setPreview(false);};
    document.addEventListener('keydown',onKey);
    return ()=>document.removeEventListener('keydown',onKey);
  },[preview]);
  const back=()=>{
    if(uploadingPortrait)return;
    if(dirty && !window.confirm('Discard your unsaved site text changes?'))return;
    onBack();
  };
  const update=(key:SiteContentKey,value:string)=>{
    setNotice('');setError('');
    setDraft(prev=>({...prev,[key]:value}));
  };
  const uploadPortrait=async(file?:File)=>{
    if(!file||uploadingPortrait)return;
    setNotice('');setError('');
    const formats:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
    const extension=formats[file.type];
    if(!extension||file.size>5*1024*1024||file.size===0){
      setError('Choose a JPG, PNG, WebP or AVIF image under 5 MB.');return;
    }
    if(!supabase||!userId){setError('Sign in as an administrator before uploading a portrait.');return;}
    setUploadingPortrait(true);
    try{
      const path=userId+'/profile/'+crypto.randomUUID()+'.'+extension;
      const {error:uploadError}=await supabase.storage.from('guide-images').upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {data}=supabase.storage.from('guide-images').getPublicUrl(path);
      update('aboutPortraitUrl',data.publicUrl);
      setNotice('Portrait uploaded. Select Publish changes to show it on your homepage.');
    }catch(err){setError('Portrait upload failed: '+String((err as Error)?.message||err));}
    finally{
      setUploadingPortrait(false);
      if(portraitInput.current)portraitInput.current.value='';
    }
  };
  const save=async()=>{
    if(!snapshot||saving||uploadingPortrait)return;
    setSaving(true);setError('');setNotice('');
    try{
      const next=await publishContent(draft,snapshot,userId);
      setSnapshot(next);setDraft(next.values);setRevisionIndex('0');
      setNotice('Published! Your updated website text is live.');onPublished();
    }catch(err){setError('Could not publish: '+String((err as Error)?.message||err));}
    finally{setSaving(false);}
  };
  const restore=()=>{
    if(!snapshot?.revisions.length)return;
    const selected=snapshot.revisions[Number(revisionIndex)];
    if(!selected)return;
    setDraft({...selected.values});
    setNotice('Previous wording loaded. Select Publish changes to put it on the live site.');
    setError('');
  };
  return <div className="site-copy-editor">
    <div className="studio-topbar">
      <button type="button" className="back-link" onClick={back}><ArrowLeft size={16}/> ADMIN DASHBOARD</button>
      <div className="studio-actions">
        <button type="button" className="studio-quiet-button" disabled={loading} onClick={()=>setPreview(true)}><Eye size={16}/> Preview changes</button>
        <button type="button" className="gold-button" disabled={loading||saving||uploadingPortrait||!dirty} onClick={()=>void save()}><Save size={16}/>{saving?'Publishing...':'Publish changes'}</button>
      </div>
    </div>
    <div className="section-kicker left">ADMIN SANCTUM · WEBSITE COPY</div>
    <h1>Site <i>Content</i></h1>
    <p className="site-copy-lead">Edit headings, navigation, category descriptions, buttons, and footer wording. Publishing updates the live site without a GitHub deployment.</p>
    {loading?<p role="status">Loading website text...</p>:<>
      <div className="site-copy-status">
        <span>{dirty?'Unsaved changes':'All changes saved'} {dirty?'· Preview before publishing':''}</span>
        <span>{snapshot?.updatedAt?'Last published '+new Date(snapshot.updatedAt).toLocaleString():'Using original site wording'}</span>
      </div>
      {error&&<p role="alert" className="studio-message">{error}</p>}
      {notice&&<p role="status" className="studio-message">{notice}</p>}
      <div className="site-copy-layout">
        <nav className="site-copy-nav" aria-label="Website text sections">
          {SITE_CONTENT_GROUPS.map((group,i)=><button type="button" key={group.title} className={section===i?'active':''} onClick={()=>setSection(i)}>{group.title}</button>)}
        </nav>
        <section className="site-copy-fields" aria-labelledby="copy-section-title">
          <h2 id="copy-section-title">{SITE_CONTENT_GROUPS[section].title}</h2>
          <div className="site-copy-field-grid">
            {SITE_CONTENT_GROUPS[section].keys.map(key=>key==='aboutPortraitUrl'?<div className="site-copy-wide site-portrait-uploader" key={key}>
              <strong>Profile photo</strong>
              <div className="site-portrait-upload-layout">
                <div className="site-portrait-image">{draft.aboutPortraitUrl
                  ? <img src={draft.aboutPortraitUrl} alt="Your uploaded creator portrait"/>
                  : <span><ImagePlus size={35}/><small>No portrait selected</small></span>}</div>
                <div className="site-portrait-controls">
                  <p>Upload your own portrait or character picture. Accepted: JPG, PNG, WebP or AVIF, up to 5 MB.</p>
                  <input type="file" ref={portraitInput} accept="image/jpeg,image/png,image/webp,image/avif" hidden
                    aria-label="Upload profile photo" onChange={event=>void uploadPortrait(event.currentTarget.files?.[0])}/>
                  <button type="button" className="studio-quiet-button" disabled={uploadingPortrait||saving}
                    onClick={()=>portraitInput.current?.click()}><ImagePlus size={16}/>{uploadingPortrait?'Uploading photo…':draft.aboutPortraitUrl?'Replace photo':'Upload photo'}</button>
                  {draft.aboutPortraitUrl&&<button type="button" className="studio-quiet-button" disabled={uploadingPortrait||saving}
                    onClick={()=>update('aboutPortraitUrl','')}><Trash2 size={15}/> Remove from homepage</button>}
                  <small>Uploads are stored publicly immediately. Only publishing changes the photo displayed on your site. Unused uploads remain in storage.</small>
                </div>
              </div>
            </div>:<label key={key} className={isLong(key)?'site-copy-wide':''}>
              <span>{labelFor(key)}</span>
              {isLong(key)
                ? <textarea aria-label={labelFor(key)} rows={3} maxLength={siteContentLimit(key)} value={draft[key]} onChange={e=>update(key,e.target.value)} />
                : <input aria-label={labelFor(key)} value={draft[key]} maxLength={siteContentLimit(key)} onChange={e=>update(key,e.target.value)}/>}
              <small aria-hidden="true">{draft[key].length} / {siteContentLimit(key)} characters</small>
            </label>)}
          </div>
        </section>
      </div>
      <div className="site-copy-history">
        <div>
          <h2>History &amp; reset</h2>
          <p>Restore previous wording or the original defaults. Restoring only fills the editor until you publish.</p>
        </div>
        <div className="site-copy-history-actions">
          {Boolean(snapshot?.revisions.length)&&<>
            <label>Previous version
              <select aria-label="Previous version" value={revisionIndex} onChange={e=>setRevisionIndex(e.target.value)}>
                {snapshot!.revisions.map((rev,i)=><option key={i} value={String(i)}>{new Date(rev.at).toLocaleString()}</option>)}
              </select>
            </label>
            <button type="button" className="studio-quiet-button" onClick={restore}><RotateCcw size={16}/> Restore version</button>
          </>}
          <button type="button" className="studio-quiet-button" onClick={()=>{
            if(!window.confirm('Load original website wording into the editor? Changes are not published until you select Publish changes.'))return;
            setDraft(normalizeSiteContent(DEFAULT_SITE_CONTENT));
            setNotice('Original wording loaded. Publish to make it live.');setError('');
          }}><RotateCcw size={16}/> Reset to defaults</button>
        </div>
      </div>
      <div className="site-copy-bottom">
        <span>{dirty?'You have unpublished edits.':'Your website text is saved.'}</span>
        <button type="button" className="gold-button" disabled={!dirty||saving||uploadingPortrait} onClick={()=>void save()}><Save size={16}/>{saving?'Publishing...':'Publish changes'}</button>
      </div>
    </>}
    {preview&&createPortal(
      <div className="site-copy-preview-overlay" role="dialog" aria-modal="true" aria-label="Preview site text">
        <div className="site-copy-preview-toolbar">
          <span><Eye size={15}/> UNSAVED WEBSITE TEXT PREVIEW</span>
          <button type="button" onClick={()=>setPreview(false)}><X size={17}/> Back to editor</button>
        </div>
        <div className="site-copy-preview-content">
          <header className="site-copy-preview-brand"><strong>{draft.brandTitle} <em>{draft.brandAccent}</em></strong><small>{draft.brandSubtitle}</small></header>
          <section className="site-copy-preview-hero">
            <div className="section-kicker">{draft.heroEyebrow}</div>
            <h1>{draft.heroTitle} <i>{draft.heroAccent}</i></h1>
            <p>{draft.heroDescription}</p>
            <span className="site-copy-preview-button">{draft.heroButton}</span>
            <div className="site-copy-preview-search"><strong>{draft.heroFinderTitle}</strong><span>{draft.heroSearchPlaceholder}</span><b>{draft.heroSearchButton}</b></div>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.aboutEyebrow}</div>
            <h2>{draft.aboutTitle} <i>{draft.aboutAccent}</i></h2>
            <div className="site-copy-preview-profile">
              {draft.aboutPortraitUrl?<img src={draft.aboutPortraitUrl} alt="Creator portrait preview"/>:<div className="site-copy-preview-portrait-empty">PORTRAIT COMING SOON</div>}
              <div><strong>{draft.aboutName}</strong><small>{draft.aboutSubtitle}</small><p>{draft.aboutBio}</p></div>
            </div>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.recentEyebrow}</div><h2>{draft.recentTitle} <i>{draft.recentAccent}</i></h2>
            <p>{draft.recentDescription}</p><p>{draft.recentEmpty}</p>
            <span className="site-copy-preview-button">{draft.recentButton}</span>
            <p className="site-copy-preview-dynamic-note">Live cards are filled automatically from the most recently edited published guides.</p>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.journeyEyebrow}</div><h2>{draft.journeyTitle} <i>{draft.journeyAccent}</i></h2><p>{draft.journeyDescription}</p>
            <div className="site-copy-preview-steps">{[
              [draft.journeyStepOneLabel,draft.journeyStepOneTitle,draft.journeyStepOneDescription],
              [draft.journeyStepTwoLabel,draft.journeyStepTwoTitle,draft.journeyStepTwoDescription],
              [draft.journeyStepThreeLabel,draft.journeyStepThreeTitle,draft.journeyStepThreeDescription]
            ].map(([label,title,description])=><div key={title}><small>{label}</small><strong>{title}</strong><span>{description}</span></div>)}</div>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.introEyebrow}</div>
            <h2>{draft.introTitle} <i>{draft.introAccent}</i></h2>
            <p>{draft.introDescription}</p>
            <div className="site-copy-preview-categories">{([
              [draft.categoryClassesTitle,draft.categoryClassesDescription],
              [draft.categoryGearTitle,draft.categoryGearDescription],
              [draft.categoryDungeonsTitle,draft.categoryDungeonsDescription],
              [draft.categoryAbyssTitle,draft.categoryAbyssDescription]
            ] as const).map(([name,description])=><div key={name}><strong>{name}</strong><span>{description}</span></div>)}</div>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.featuredEyebrow}</div><h2>{draft.featuredTitle} <i>{draft.featuredAccent}</i></h2><p>{draft.featuredButton}</p>
            <div className="section-kicker">{draft.missionEyebrow}</div><h2>{draft.missionTitle} <i>{draft.missionAccent}</i></h2><p>{draft.missionDescription}</p>
            <div className="site-copy-preview-steps">{[[draft.missionOneTitle,draft.missionOneDescription],[draft.missionTwoTitle,draft.missionTwoDescription],[draft.missionThreeTitle,draft.missionThreeDescription]].map(([title,description])=><div key={title}><strong>{title}</strong><span>{description}</span></div>)}</div>
            <div className="section-kicker">{draft.joinEyebrow}</div><h2>{draft.joinTitle} <i>{draft.joinAccent}</i></h2>
            <p>{draft.joinDescription}</p><span className="site-copy-preview-button">{draft.joinButton}</span>
          </section>
          <section className="site-copy-preview-section">
            <div className="section-kicker">{draft.libraryEyebrow}</div>
            <h2>{draft.libraryTitle} <i>{draft.libraryAccent}</i></h2><p>{draft.libraryDescription}</p>
          </section>
          <footer><div className="footer-brand">✦ &nbsp; {draft.footerBrand} <span>{draft.footerTag}</span></div><p>{draft.footerDescription}</p><div>{draft.footerClosing}</div></footer>
          <p className="site-copy-preview-note"><Check size={15}/> Preview uses your unsaved text. Only Publish changes updates the live website.</p>
        </div>
      </div>,document.body)}
  </div>;
}
