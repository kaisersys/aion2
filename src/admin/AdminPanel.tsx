import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  ArrowLeft, Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Link2, ImagePlus, Table2, Quote, Undo2, Redo2,
  Save, Eye, Pencil, Plus, Trash2, LogOut, Upload, Globe2, Images, MousePointerClick, PanelTop, Sparkles, ExternalLink, X, Copy
} from 'lucide-react';
import { guideExtensions } from '../components/GuideContent';
import GuideArticle, { guideHref } from '../components/GuideArticle';
import { safeGuideHref, safeGuideImage, type GalleryImage } from '../components/GuideBlocks';
import { CATEGORIES, emptyDocument, guideSlug, type GuideRecord, type GuideStatus } from '../lib/guides';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SITE_CONTENT_SLUG } from '../lib/siteContent';
import SiteContentEditor from './SiteContentEditor';

type Props = { onExit: () => void; onContentChanged: () => void };

type StudioBlock = 'button' | 'callout' | 'skill';

function Toolbar({ editor, onChooseImage, onChooseGallery, onInsertBlock }: {
  editor:ReturnType<typeof useEditor>;
  onChooseImage:()=>void;
  onChooseGallery:()=>void;
  onInsertBlock:(type:StudioBlock)=>void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => tick(value => value + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => { editor.off('selectionUpdate', refresh); editor.off('transaction', refresh); };
  }, [editor]);
  if (!editor) return null;
  const b = (label: string, icon: React.ReactNode, handler: () => void, active = false) =>
    <button type="button" key={label} className={'studio-tool' + (active ? ' active' : '')}
      title={label} aria-label={label} onClick={handler}>{icon}</button>;
  return <div className="studio-toolbar" role="toolbar" aria-label="Article formatting">
    {b('Bold', <Bold size={17}/>, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
    {b('Italic', <Italic size={17}/>, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
    {b('Heading 1', <Heading1 size={19}/>, () => editor.chain().focus().toggleHeading({level:1}).run(), editor.isActive('heading',{level:1}))}
    {b('Heading 2', <Heading2 size={19}/>, () => editor.chain().focus().toggleHeading({level:2}).run(), editor.isActive('heading',{level:2}))}
    {b('Heading 3', <Heading2 size={15}/>, () => editor.chain().focus().toggleHeading({level:3}).run(), editor.isActive('heading',{level:3}))}
    {b('Bulleted list', <List size={18}/>, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
    {b('Numbered list', <ListOrdered size={18}/>, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
    {b('Quote', <Quote size={18}/>, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
    {b('Link', <Link2 size={18}/>, () => {
      const existing=String(editor.getAttributes('link').href||'');
      const input=window.prompt('Link to a URL or another guide (#/guides/your-slug). Clear to remove.',existing||'#/guides/');
      if(input===null)return;
      if(!input.trim()){editor.chain().focus().unsetLink().run();return;}
      const href=safeGuideHref(input);
      if(!href){window.alert('Use HTTPS, HTTP, mailto, or an internal #/guides/... link.');return;}
      const internal=href.startsWith('#')||href.startsWith('/')||(href.startsWith('http')&&new URL(href).origin===window.location.origin);
      editor.chain().focus().extendMarkRange('link').setLink({href,target:internal?'_self':'_blank'}).run();
    },editor.isActive('link'))}
    {b('Upload image', <ImagePlus size={18}/>, onChooseImage)}
    {b('Image gallery', <Images size={18}/>, onChooseGallery)}
    {b('Link button', <MousePointerClick size={18}/>, ()=>onInsertBlock('button'))}
    {b('Info / tip box', <PanelTop size={18}/>, ()=>onInsertBlock('callout'))}
    {b('Skill / gear card', <Sparkles size={18}/>, ()=>onInsertBlock('skill'))}
    {b('Insert table', <Table2 size={18}/>, () => editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run())}
    {editor.isActive('table') && b('Delete table', <Trash2 size={17}/>, () => editor.chain().focus().deleteTable().run())}
    <span className="studio-toolbar-spacer"/>
    {b('Undo', <Undo2 size={18}/>, () => editor.chain().focus().undo().run())}
    {b('Redo', <Redo2 size={18}/>, () => editor.chain().focus().redo().run())}
  </div>;
}

function BlockComposer({kind,onClose,onInsert}:{
  kind:StudioBlock;onClose:()=>void;
  onInsert:(type:string,attrs:Record<string,unknown>)=>void;
}) {
  const [label,setLabel]=useState('View related guide');
  const [href,setHref]=useState('#/guides/');
  const [variant,setVariant]=useState('gold');
  const [title,setTitle]=useState(kind==='skill'?'Skill or equipment name':'Field note');
  const [description,setDescription]=useState('');
  const [tag,setTag]=useState('RANGER · SKILL GUIDE');
  const [tone,setTone]=useState('tip');
  const [iconSrc,setIconSrc]=useState('');
  const [relatedHref,setRelatedHref]=useState('');
  const [error,setError]=useState('');
  const submit=(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(kind==='button'){
      if(!safeGuideHref(href)){setError('Provide a safe link (https://... or #/guides/guide-slug).');return;}
      onInsert('guideButton',{label:label.trim()||'Read guide',href:href.trim(),variant});
    }else if(kind==='callout'){
      onInsert('guideCallout',{title:title.trim()||'Field note',body:description.trim(),tone});
    }else{
      if(iconSrc&&!safeGuideImage(iconSrc)){setError('Use a safe HTTPS icon image URL.');return;}
      if(relatedHref&&!safeGuideHref(relatedHref)){setError('Use a valid related guide URL.');return;}
      onInsert('guideSkillCard',{title:title.trim()||'Skill or equipment',description:description.trim(),tag:tag.trim(),iconSrc:iconSrc.trim(),relatedHref:relatedHref.trim()});
    }
  };
  return <div className="studio-block-composer" role="dialog" aria-label="Insert a reusable article block">
    <div className="studio-block-heading"><strong>{kind==='button'?'INSERT LINK BUTTON':kind==='callout'?'INSERT FIELD NOTE':'INSERT SKILL OR GEAR CARD'}</strong><button type="button" className="studio-tool" onClick={onClose} aria-label="Close block editor"><X size={17}/></button></div>
    <form onSubmit={submit} className="studio-block-fields">
      {kind==='button'?<>
        <label>Button text<input value={label} maxLength={90} onChange={e=>setLabel(e.target.value)} required/></label>
        <label>Destination URL<input value={href} onChange={e=>setHref(e.target.value)} placeholder="#/guides/ranger" required/></label>
        <label>Button style<select value={variant} onChange={e=>setVariant(e.target.value)}><option value="gold">Gold</option><option value="outline">Outlined</option></select></label>
      </>:kind==='callout'?<>
        <label>Heading<input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label>
        <label>Message<textarea rows={3} maxLength={1200} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>Style<select value={tone} onChange={e=>setTone(e.target.value)}><option value="tip">Tip</option><option value="note">Note</option><option value="warning">Warning</option></select></label>
      </>:<>
        <label>Name<input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} required/></label>
        <label>Skill or gear description<textarea rows={3} maxLength={600} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>Category / tags<input value={tag} maxLength={100} onChange={e=>setTag(e.target.value)}/></label>
        <label>Icon URL (optional)<input value={iconSrc} onChange={e=>setIconSrc(e.target.value)} placeholder="https://.../skill-icon.png"/></label>
        <label>Related guide URL (optional)<input value={relatedHref} onChange={e=>setRelatedHref(e.target.value)} placeholder="#/guides/ranger"/></label>
      </>}
      {error&&<p className="studio-message" role="alert">{error}</p>}
      <div className="studio-actions"><button type="button" className="studio-quiet-button" onClick={onClose}>Cancel</button><button type="submit" className="gold-button"><Plus size={15}/> Insert block</button></div>
    </form>
  </div>;
}

export function StudioEditor({ record, user, onSaved, onCancel }: {
  record: GuideRecord | null;
  user: User;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(record?.title ?? '');
  const [slug, setSlug] = useState(record?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(record));
  const [category, setCategory] = useState(record?.category ?? CATEGORIES[0]);
  const [summary, setSummary] = useState(record?.summary ?? '');
  const [featured, setFeatured] = useState(record?.featured ?? false);
  const [content, setContent] = useState<JSONContent>(record?.content ?? emptyDocument());
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [blockKind,setBlockKind] = useState<StudioBlock|null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const galleryInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!preview)return;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape' && !document.querySelector('.guide-lightbox'))setPreview(false);};
    window.addEventListener('keydown',onKey);
    return ()=>{document.body.style.overflow=oldOverflow;window.removeEventListener('keydown',onKey);};
  },[preview]);
  const editor = useEditor({
    extensions: guideExtensions,
    content: record?.content ?? emptyDocument(),
    onUpdate: ({ editor: next }) => setContent(next.getJSON()),
    immediatelyRender: false,
  });

  const chooseImage = () => fileInput.current?.click();
  const chooseGallery = () => galleryInput.current?.click();
  const uploadOne = async (file:File): Promise<GalleryImage> => {
    if(!supabase)throw new Error('Supabase is unavailable');
    const allowed:Record<string,string>={
      'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif'
    };
    const suffix=allowed[file.type];
    if(!suffix||file.size>10*1024*1024)throw new Error('Images must be JPG, PNG, WebP, AVIF, or GIF and under 10 MB each.');
    const path=`${user.id}/${crypto.randomUUID()}.${suffix}`;
    const {error}=await supabase.storage.from('guide-images').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error(error.message);
    const {data}=supabase.storage.from('guide-images').getPublicUrl(path);
    return {src:data.publicUrl,alt:file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' '),caption:''};
  };
  const uploadImage = async (file?:File) => {
    if(!file||!editor||uploading)return;
    setUploading(true);setMessage('');
    try{
      const image=await uploadOne(file);
      editor.chain().focus().insertContentAt(editor.state.selection.to,{type:'image',attrs:{src:image.src,alt:image.alt}}).run();
      setContent(editor.getJSON());
    }catch(error){setMessage('Image upload failed: '+(error instanceof Error?error.message:String(error)));}
    finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
  };
  const uploadGallery = async (files?:FileList|null) => {
    if(!files||!files.length||!editor||uploading)return;
    if(files.length>12){setMessage('Select up to 12 gallery images at once.');return;}
    setUploading(true);setMessage('');
    const images:GalleryImage[]=[];
    try{
      for(const file of Array.from(files))images.push(await uploadOne(file));
      editor.chain().focus().insertContentAt(editor.state.selection.to,{type:'guideGallery',attrs:{images,columns:images.length===2?2:3}}).run();
      setContent(editor.getJSON());
      setMessage('Gallery added. Click Edit caption under any image to add captions.');
    }catch(error){setMessage('Gallery upload interrupted: '+(error instanceof Error?error.message:String(error)));}
    finally{setUploading(false);if(galleryInput.current)galleryInput.current.value='';}
  };
  const insertBlock=(type:string,attrs:Record<string,unknown>)=>{
    if(!editor)return;
    editor.chain().focus().insertContentAt(editor.state.selection.to,{type,attrs}).run();
    setContent(editor.getJSON());setBlockKind(null);
  };
  const copyGuideLink=async()=>{
    const url=window.location.origin+window.location.pathname+guideHref(guideSlug(slug||title));
    try{await navigator.clipboard.writeText(url);setMessage('Guide URL copied. It works publicly after this guide is published.');}
    catch{window.prompt('Copy this guide link',url);}
  };

  const save = async (status: GuideStatus) => {
    if (!supabase || saving) return;
    const normalizedSlug = guideSlug(slug);
    if (!title.trim() || !normalizedSlug) { setMessage('Enter a title and a valid URL slug first.'); return; }
    if (normalizedSlug===SITE_CONTENT_SLUG) { setMessage('This URL is reserved for website settings. Choose another slug.'); return; }
    setSaving(true); setMessage('');
    const guide = {
      title: title.trim(), slug: normalizedSlug, summary: summary.trim(), category,
      featured, status, content: editor?.getJSON() ?? content,
      published_at: status === 'published' ? (record?.published_at ?? new Date().toISOString()) : record?.published_at ?? null,
    };
    const result = record
      ? await supabase.from('guides').update(guide).eq('id',record.id).select('id').single()
      : await supabase.from('guides').insert({...guide, author_id: user.id}).select('id').single();
    if (result.error) {
      setMessage('Could not save: ' + result.error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  };

  return <div className="studio-edit">
    <div className="studio-topbar">
      <button className="back-link" onClick={onCancel}><ArrowLeft size={16}/> ALL GUIDES</button>
      <div className="studio-actions">
        <button type="button" className="studio-quiet-button" onClick={()=>setPreview(true)}><Eye size={16}/> Full-page preview</button>
        <button type="button" className="studio-quiet-button" disabled={saving||uploading} onClick={()=>void save('draft')}><Save size={16}/> Save draft</button>
        <button type="button" className="gold-button" disabled={saving||uploading} onClick={()=>void save('published')}><Globe2 size={16}/>{saving?'Saving...':'Publish'}</button>
      </div>
    </div>
    <div className="section-kicker left">GUILD EDITOR · {record ? 'EDIT GUIDE' : 'NEW GUIDE'}</div>
    <h1>{record ? 'Edit' : 'Create'} <i>Guide</i></h1>
    <div className="studio-fields">
      <label>Guide title<input maxLength={180} value={title} onChange={e=> {
        setTitle(e.target.value);
        if (!slugTouched) setSlug(guideSlug(e.target.value));
      }} placeholder="e.g. Ranger PvE Build Guide"/></label>
      <label>URL slug<input value={slug} maxLength={100} onChange={e=>{setSlug(guideSlug(e.target.value));setSlugTouched(true)}} placeholder="ranger-pve-guide"/><span className="studio-field-hint">Shareable guide: atreiastreet.com/{guideHref(guideSlug(slug||title))}</span></label>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label>Short summary<textarea maxLength={600} rows={3} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="A short introduction used on guide cards..."/></label>
      <label className="studio-checkbox"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Feature this guide on the homepage</label>
    </div>
    <div className="studio-editor-card">
      <div className="studio-editor-title"><span>ARTICLE CONTENT</span><span>{uploading?'Uploading images...':'Visual editor · Insert reusable blocks from the toolbar'}</span></div>
      <Toolbar editor={editor} onChooseImage={chooseImage} onChooseGallery={chooseGallery} onInsertBlock={setBlockKind}/>
      {blockKind&&<BlockComposer key={blockKind} kind={blockKind} onClose={()=>setBlockKind(null)} onInsert={insertBlock}/>}
      <div className="studio-editor-canvas guide-rich-text"><EditorContent editor={editor}/></div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" hidden
        onChange={e=>void uploadImage(e.currentTarget.files?.[0])}/>
      <input ref={galleryInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" multiple hidden
        onChange={e=>void uploadGallery(e.currentTarget.files)}/>
      <div className="studio-editor-foot">
        <button type="button" className="studio-quiet-button" onClick={chooseImage} disabled={uploading}><Upload size={15}/> Add image</button>
        <button type="button" className="studio-quiet-button" onClick={chooseGallery} disabled={uploading}><Images size={15}/> Image gallery</button>
        <button type="button" className="studio-quiet-button" onClick={()=>void copyGuideLink()}><Copy size={15}/> Copy guide link</button>
        <span>Headings create an automatic table of contents. Click inserted blocks to edit them.</span>
      </div>
    </div>
    {preview&&createPortal(<div className="studio-page-preview" role="dialog" aria-modal="true" aria-label="Full page guide preview">
      <div className="studio-preview-bar"><span><Eye size={17}/> PRIVATE FULL-PAGE PREVIEW · NOT PUBLISHED</span><button type="button" className="studio-quiet-button" onClick={()=>setPreview(false)}><X size={17}/> Close preview</button></div>
      <div className="site studio-preview-site" onClickCapture={event=>{
        const anchor=(event.target as HTMLElement).closest('a');
        if(anchor && !anchor.closest('.article-sidebar'))event.preventDefault();
      }}>
        <header className="header studio-preview-header">
          <div className="brand"><img className="brand-logo" src="/assets/branding/aion-logo.avif" alt="Aion" width="110" height="74"/><span className="brand-lines"><strong>ATREIA <em>STREET</em></strong><small>INDEPENDENT GUILD CODEX</small></span></div>
          <span className="studio-preview-nav">DISCOVER &nbsp; · &nbsp; CLASSES &nbsp; · &nbsp; CHALLENGES &nbsp; · &nbsp; ALL GUIDES</span>
        </header>
        <GuideArticle preview guide={{slug:guideSlug(slug||title)||'preview',title,category,summary,read:'GUILD GUIDE',content:editor?.getJSON()??content}} onBack={()=>setPreview(false)}/>
        <footer><div className="footer-brand">✦ &nbsp; AION II <span>GUILD CODEX</span></div><p>An independent fan-made community guide project. Not affiliated with or endorsed by NCSOFT.</p><div>FORGED IN KNOWLEDGE · UNITED IN PURPOSE</div></footer>
      </div>
    </div>,document.body)}
    {message && <p className="studio-message" role="alert">{message}</p>}
  </div>;
}

export default function AdminPanel({ onExit, onContentChanged }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<GuideRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [editing, setEditing] = useState<GuideRecord | null | undefined>(undefined);
  const [siteEditing,setSiteEditing] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    const client = supabase;
    let mounted = true;
    void client.auth.getUser().then(({data})=>{
      if(mounted) setUser(data.user);
    }).catch(e=>{ if(mounted) setAuthError(String(e)); }).finally(()=>{
      if(mounted) setChecking(false);
    });
    const {data:{subscription}} = client.auth.onAuthStateChange((_event,session)=>{
      if(mounted) { setUser(session?.user ?? null); setChecking(false); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(()=>{
    if (!supabase || !user) { setIsAdmin(false); return; }
    const client = supabase;
    let active = true;
    setChecking(true);
    void client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle().then(({data,error})=>{
      if(active) {
        setIsAdmin(!error && Boolean(data));
        if(error) setAuthError('Could not check admin access: ' + error.message);
        setChecking(false);
      }
    });
    return ()=>{active=false;};
  },[user?.id]);

  const reload = async () => {
    if(!supabase) return;
    setLoadingRecords(true); setListError('');
    const {data,error}=await supabase.from('guides').select('*').order('updated_at',{ascending:false});
    if(error) setListError('Could not retrieve guides: '+error.message);
    else setRecords(((data??[]) as GuideRecord[]).filter(record=>record.slug!==SITE_CONTENT_SLUG));
    setLoadingRecords(false);
  };
  useEffect(()=>{ if(isAdmin) void reload(); },[isAdmin]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(!supabase) return;
    setBusy(true);setAuthError('');
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error) setAuthError(error.message);
    setPassword(''); setBusy(false);
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    setUser(null);setIsAdmin(false);setEditing(undefined);setSiteEditing(false);
  };
  const remove = async (record: GuideRecord) => {
    if(!supabase || !window.confirm(`Permanently delete "${record.title}"? This cannot be undone.`)) return;
    setListError('');
    const {error}=await supabase.from('guides').delete().eq('id',record.id);
    if(error) setListError('Could not delete: '+error.message);
    else { await reload(); onContentChanged(); }
  };

  if (!isSupabaseConfigured) return <main className="inner-page section-wrap narrow">
    <button className="back-link" onClick={onExit}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="section-kicker left">ADMIN SANCTUM</div><h1>Studio <i>Setup</i></h1>
    <div className="notice"><div><strong>The editor is installed, but Supabase isn't connected yet.</strong>
      <p>Check that GitHub's VITE_SUPABASE_URL is the full HTTPS Project URL from Supabase (for example https://your-project.supabase.co), not the database connection string. Then complete the setup steps in the repository README: run the SQL migration,
      invite your admin account, and set the GitHub Actions build secrets VITE_SUPABASE_URL and
      VITE_SUPABASE_ANON_KEY. The public site continues working until then.</p>
      <a href="https://github.com/kaisersys/aion2#guide-studio-setup" target="_blank" rel="noopener noreferrer">View setup instructions →</a>
    </div></div>
  </main>;

  return <main className="inner-page section-wrap studio-page">
    {!siteEditing&&<button className="back-link" onClick={onExit}><ArrowLeft size={16}/> BACK TO HOME</button>}
    {checking ? <p>Checking staff access...</p> :
     !user ? <div className="studio-login">
       <div className="section-kicker left">GUILD STAFF ONLY</div><h1>Admin <i>Sanctum</i></h1>
       <p>Sign in with your approved Supabase staff account.</p>
       <form onSubmit={e=>void signIn(e)}>
         <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
         <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
         {authError&&<p className="studio-message" role="alert">{authError}</p>}
         <button className="gold-button" disabled={busy} type="submit">{busy?'Signing in...':'Sign in'}</button>
       </form>
     </div> :
     !isAdmin ? <div className="studio-login">
       <h1>Access <i>Restricted</i></h1>
       <p>Your account is signed in, but it has not been approved as a guild editor. Ask the site owner to add your user ID to the <code>admin_users</code> table.</p>
       {authError && <p className="studio-message">{authError}</p>}
       <button className="studio-quiet-button" onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button>
     </div> :
     siteEditing ?
       <SiteContentEditor userId={user.id} onBack={()=>setSiteEditing(false)}
         onPublished={onContentChanged}/> :
     editing !== undefined ?
       <StudioEditor key={editing?.id ?? 'create-new'} record={editing ?? null} user={user}
         onCancel={()=>setEditing(undefined)}
         onSaved={()=>{setEditing(undefined);void reload();onContentChanged();}}/> :
       <>
        <div className="studio-topbar">
          <div><div className="section-kicker left">GUILD STAFF ONLY</div><h1>Guide <i>Studio</i></h1></div>
          <button className="studio-quiet-button" onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button>
        </div>
        <p className="page-intro">Write, preview, and publish guides without rebuilding your website.</p>
        <div className="studio-content-shortcut">
          <div>
            <strong>Site Content</strong>
            <p>Edit homepage titles, category descriptions, navigation, buttons and footer text. No deployment needed.</p>
          </div>
          <button type="button" className="studio-quiet-button" onClick={()=>setSiteEditing(true)}><Pencil size={16}/> Edit website text</button>
        </div>
        <div className="studio-topbar">
          <h2>Manage guides <span className="studio-count">{records.length}</span></h2>
          <button className="gold-button" onClick={()=>setEditing(null)}><Plus size={17}/> New Guide</button>
        </div>
        {listError && <p className="studio-message" role="alert">{listError}</p>}
        {loadingRecords ? <p>Loading guides...</p> :
          records.length===0 ? <div className="studio-empty">No saved guides yet. Select <strong>New Guide</strong> to create your first article.</div> :
          <div className="studio-guide-list">{records.map(record=><div className="studio-guide-row" key={record.id}>
            <div><span className={'studio-status '+record.status}>{record.status.toUpperCase()}</span>
              <span className="studio-category">{record.category}</span>
              <h3>{record.title}</h3>
              <small>/{record.slug} · Updated {new Date(record.updated_at).toLocaleDateString()}</small>
            </div>
            <div className="studio-row-actions">
              {record.status==='published'&&<a className="studio-quiet-button" href={guideHref(record.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> View</a>}
              <button className="studio-quiet-button" onClick={()=>setEditing(record)}><Pencil size={16}/> Edit</button>
              <button className="studio-icon-danger" title="Delete guide" aria-label={`Delete ${record.title}`} onClick={()=>void remove(record)}><Trash2 size={18}/></button>
            </div>
          </div>)}</div>}
       </>
    }
  </main>;
}
