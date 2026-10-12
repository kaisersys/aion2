import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  ArrowLeft, Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Link2, ImagePlus, Table2, Quote, Undo2, Redo2,
  Save, Eye, Pencil, Plus, Trash2, LogOut, Upload, Globe2
} from 'lucide-react';
import GuideContent, { guideExtensions } from '../components/GuideContent';
import { CATEGORIES, emptyDocument, guideSlug, type GuideRecord, type GuideStatus } from '../lib/guides';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type Props = { onExit: () => void; onContentChanged: () => void };

function Toolbar({ editor, onChooseImage }: { editor: ReturnType<typeof useEditor>; onChooseImage: () => void }) {
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
    {b('Bulleted list', <List size={18}/>, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
    {b('Numbered list', <ListOrdered size={18}/>, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
    {b('Quote', <Quote size={18}/>, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
    {b('Link', <Link2 size={18}/>, () => {
      const href = window.prompt('Paste a URL (https://...)', editor.getAttributes('link').href || 'https://');
      if (href === null) return;
      if (!href.trim()) { editor.chain().focus().unsetLink().run(); return; }
      try {
        const url = new URL(href.trim());
        if (!['https:','http:','mailto:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
        editor.chain().focus().extendMarkRange('link').setLink({href:url.href}).run();
      } catch { window.alert('Please enter a valid HTTPS, HTTP, or mailto link.'); }
    }, editor.isActive('link'))}
    {b('Upload image', <ImagePlus size={18}/>, onChooseImage)}
    {b('Insert table', <Table2 size={18}/>, () => editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run())}
    {editor.isActive('table') && b('Delete table', <Trash2 size={17}/>, () => editor.chain().focus().deleteTable().run())}
    <span className="studio-toolbar-spacer"/>
    {b('Undo', <Undo2 size={18}/>, () => editor.chain().focus().undo().run())}
    {b('Redo', <Redo2 size={18}/>, () => editor.chain().focus().redo().run())}
  </div>;
}

function StudioEditor({ record, user, onSaved, onCancel }: {
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
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: guideExtensions,
    content: record?.content ?? emptyDocument(),
    onUpdate: ({ editor: next }) => setContent(next.getJSON()),
    immediatelyRender: false,
  });

  const chooseImage = () => fileInput.current?.click();
  const uploadImage = async (file?: File) => {
    if (!file || !supabase || !editor) return;
    const allowed: Record<string,string> = {
      'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/avif':'avif', 'image/gif':'gif'
    };
    const suffix = allowed[file.type];
    if (!suffix || file.size > 10 * 1024 * 1024) {
      setMessage('Images must be JPG, PNG, WebP, AVIF, or GIF and under 10 MB.');
      return;
    }
    setUploading(true); setMessage('');
    const path = `${user.id}/${crypto.randomUUID()}.${suffix}`;
    const { error } = await supabase.storage.from('guide-images').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) setMessage('Image upload failed: ' + error.message);
    else {
      const { data } = supabase.storage.from('guide-images').getPublicUrl(path);
      editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run();
      setContent(editor.getJSON());
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const save = async (status: GuideStatus) => {
    if (!supabase || saving) return;
    const normalizedSlug = guideSlug(slug);
    if (!title.trim() || !normalizedSlug) { setMessage('Enter a title and a valid URL slug first.'); return; }
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
        <button type="button" className="studio-quiet-button" onClick={()=>setPreview(!preview)}><Eye size={16}/>{preview?'Edit':'Preview'}</button>
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
      <label>URL slug<input value={slug} maxLength={100} onChange={e=>{setSlug(guideSlug(e.target.value));setSlugTouched(true)}} placeholder="ranger-pve-guide"/></label>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label>Short summary<textarea maxLength={600} rows={3} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="A short introduction used on guide cards..."/></label>
      <label className="studio-checkbox"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Feature this guide on the homepage</label>
    </div>
    <div className="studio-editor-card">
      <div className="studio-editor-title"><span>ARTICLE CONTENT</span><span>{uploading?'Uploading image...':preview?'Live preview':'Visual editor'}</span></div>
      <div style={{display:preview?'none':'block'}}>
        <Toolbar editor={editor} onChooseImage={chooseImage}/>
        <div className="studio-editor-canvas guide-rich-text"><EditorContent editor={editor}/></div>
      </div>
      {preview && <div className="studio-editor-canvas studio-preview"><GuideContent content={content}/></div>}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" hidden
        onChange={e=>void uploadImage(e.currentTarget.files?.[0])}/>
      <div className="studio-editor-foot">
        <button type="button" className="studio-quiet-button" onClick={chooseImage} disabled={uploading}><Upload size={15}/> Add image</button>
        <span>Click into the page to write, format, and insert screenshots.</span>
      </div>
    </div>
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
    else setRecords((data??[]) as GuideRecord[]);
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
    setUser(null);setIsAdmin(false);setEditing(undefined);
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
      <p>Finish the setup steps in the repository README: create a Supabase project, run the SQL migration,
      invite your admin account, and set the GitHub Actions build secrets VITE_SUPABASE_URL and
      VITE_SUPABASE_ANON_KEY. The public site continues working until then.</p>
      <a href="https://github.com/kaisersys/aion2#guide-studio-setup" target="_blank" rel="noopener noreferrer">View setup instructions →</a>
    </div></div>
  </main>;

  return <main className="inner-page section-wrap studio-page">
    <button className="back-link" onClick={onExit}><ArrowLeft size={16}/> BACK TO HOME</button>
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
              <button className="studio-quiet-button" onClick={()=>setEditing(record)}><Pencil size={16}/> Edit</button>
              <button className="studio-icon-danger" title="Delete guide" aria-label={`Delete ${record.title}`} onClick={()=>void remove(record)}><Trash2 size={18}/></button>
            </div>
          </div>)}</div>}
       </>
    }
  </main>;
}
