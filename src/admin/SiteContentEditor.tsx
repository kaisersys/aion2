import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Eye, ImagePlus, RotateCcw, Save, X } from 'lucide-react';
import {
  DEFAULT_SITE_CONTENT, SITE_CONTENT_GROUPS, getSiteSnapshot,
  normalizeSiteContent, saveSiteContent, siteContentLimit, validProfilePhotoUrl,
  type SiteContent, type SiteContentKey, type SiteSnapshot
} from '../lib/siteContent';
import { supabase } from '../lib/supabase';

type Props = {
  userId: string; onBack: () => void; onPublished: () => void;
  /** Optional adapters allow isolated browser tests without changing live Supabase data. */
  loadSnapshot?: typeof getSiteSnapshot;
  publishContent?: typeof saveSiteContent;
};
const labelFor=(key:SiteContentKey)=>key
  .replace(/([a-z])([A-Z])/g,'$1 $2')
  .replace(/^(Hero|Intro|Navigation|Featured|Join|Journey|Mission|Profile|Latest|Library|Footer|Brand|Topic|Category) /i,'')
  .replace(/^([a-z])/,(c)=>c.toUpperCase());
const isLong=(key:SiteContentKey)=>key==='profileBio' || key==='latestEmpty' || key.toLowerCase().includes('description');

export default function SiteContentEditor({userId,onBack,onPublished,loadSnapshot=getSiteSnapshot,publishContent=saveSiteContent}:Props){
  const [snapshot,setSnapshot]=useState<SiteSnapshot|null>(null);
  const [draft,setDraft]=useState<SiteContent>(()=>normalizeSiteContent({}));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const photoInputRef=useRef<HTMLInputElement>(null);
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
    if(dirty && !window.confirm('Discard your unsaved site text changes?'))return;
    onBack();
  };
  const update=(key:SiteContentKey,value:string)=>{
    setNotice('');setError('');
    setDraft(prev=>({...prev,[key]:value}));
  };
  const uploadPhoto=async(file?:File)=>{
    if(!file || uploadingPhoto)return;
    const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
    const suffix=extensions[file.type];
    if(!suffix || file.size>5*1024*1024){setError('Choose a JPG, PNG, WebP or AVIF portrait smaller than 5 MB.');return;}
    if(!supabase || !userId){setError('Guide Studio must be configured and you must be signed in to upload a portrait.');return;}
    setUploadingPhoto(true);setError('');setNotice('');
    try{
      const filename='profiles/'+userId+'/'+crypto.randomUUID()+'.'+suffix;
      const {error:uploadError}=await supabase.storage.from('guide-images').upload(filename,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {data}=supabase.storage.from('guide-images').getPublicUrl(filename);
      if(!validProfilePhotoUrl(data.publicUrl))throw new Error('Could not verify the uploaded image URL.');
      setDraft(prev=>({...prev,profilePhotoUrl:data.publicUrl}));
      setNotice('Portrait uploaded. Select Publish changes to display it on the website. Uploaded images are publicly accessible even before publishing.');
    }catch(err){setError('Portrait upload failed: '+String((err as Error)?.message||err));}
    finally{setUploadingPhoto(false);}
  };
  const save=async()=>{
    if(!snapshot||saving||uploadingPhoto)return;
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
        <button type="button" className="gold-button" disabled={loading||saving||uploadingPhoto||!dirty} onClick={()=>void save()}><Save size={16}/>{saving?'Publishing...':'Publish changes'}</button>
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
            {SITE_CONTENT_GROUPS[section].keys.map(key=>key==='profilePhotoUrl'
              ? <div key={key} className="site-copy-photo-field site-copy-wide">
                  <span className="site-copy-photo-label">Your portrait</span>
                  <div className="site-copy-photo-layout">
                    <div className="site-copy-photo-preview">{draft.profilePhotoUrl
                      ? <img src={draft.profilePhotoUrl} alt="Profile portrait preview"/>
                      : <div className="site-copy-photo-placeholder"><ImagePlus size={28}/><span>No photo uploaded</span></div>}</div>
                    <div className="site-copy-photo-actions">
                      <p>Upload a portrait for the About Me section. JPG, PNG, WebP or AVIF, up to 5 MB. Square or vertical images work best.</p>
                      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden
                        onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void uploadPhoto(file);}}/>
                      <div className="site-copy-photo-buttons">
                        <button type="button" className="studio-quiet-button" disabled={uploadingPhoto||saving} onClick={()=>photoInputRef.current?.click()}><ImagePlus size={16}/>{uploadingPhoto?'Uploading...':draft.profilePhotoUrl?'Replace photo':'Upload photo'}</button>
                        {draft.profilePhotoUrl&&<button type="button" className="studio-quiet-button" disabled={uploadingPhoto||saving} onClick={()=>update('profilePhotoUrl','')}>Remove photo</button>}
                      </div>
                      <small>Uploads are public in the image library. Changes to the visible homepage still require Publish changes.</small>
                    </div>
                  </div>
                </div>
              : <label key={key} className={isLong(key)?'site-copy-wide':''}>
                  <span>{labelFor(key)}</span>
                  {isLong(key)
                    ? <textarea aria-label={labelFor(key)} rows={key==='profileBio'?7:3} maxLength={siteContentLimit(key)} value={draft[key]} onChange={e=>update(key,e.target.value)} />
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
        <button type="button" className="gold-button" disabled={!dirty||saving||uploadingPhoto} onClick={()=>void save()}><Save size={16}/>{saving?'Publishing...':'Publish changes'}</button>
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
          <section className="site-copy-preview-profile">
            <div className="site-copy-preview-portrait">{draft.profilePhotoUrl
              ? <img src={draft.profilePhotoUrl} alt={'Portrait of '+draft.profileName}/>
              : <div className="site-copy-photo-placeholder"><ImagePlus size={28}/><span>Portrait placeholder</span></div>}</div>
            <div><div className="section-kicker">{draft.profileEyebrow}</div>
              <h2>{draft.profileTitle} <i>{draft.profileAccent}</i></h2>
              <strong>{draft.profileName}</strong><small>{draft.profileRole}</small>
              {draft.profileBio.split(/\n+/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}
            </div>
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
            <div className="section-kicker">{draft.latestEyebrow}</div><h2>{draft.latestTitle} <i>{draft.latestAccent}</i></h2><p>{draft.latestDescription}</p><p>{draft.latestEmpty}</p>
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
