import React, { useEffect, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Info, Pencil, ShieldAlert, Sparkles, X, ZoomIn } from 'lucide-react';

export type GalleryImage = { src: string; alt: string; caption: string };

export function safeGuideHref(href: string): string | null {
  const value = (href ?? '').trim();
  if (value.startsWith('#/guides/') || value.startsWith('#/')) return value;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function safeGuideImage(src: string): string | null {
  const value = (src ?? '').trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

const field = (element: HTMLElement, name: string, fallback: string) => element.getAttribute('data-' + name) || fallback;
const attr = (name: string, fallback = '') => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => field(el, name, fallback),
  renderHTML: (attrs: Record<string, string>) => ({ ['data-' + name]: attrs[name] ?? fallback })
});

function BlockControls({editable,onEdit,onRemove}: {editable:boolean;onEdit:()=>void;onRemove:()=>void}) {
  if (!editable) return null;
  return <div className="guide-block-tools" contentEditable={false}>
    <button type="button" onClick={onEdit}><Pencil size={13}/> Edit block</button>
    <button type="button" onClick={onRemove}><X size={13}/> Remove</button>
  </div>;
}

function promptValue(message:string,current:string,max=220) {
  const result = window.prompt(message, current);
  return result === null ? null : result.trim().slice(0,max);
}

function ButtonView({node,editor,updateAttributes,deleteNode}: NodeViewProps) {
  const label = String(node.attrs.label || 'Read guide');
  const href = safeGuideHref(String(node.attrs.href || ''));
  const variant = node.attrs.variant === 'outline' ? 'outline' : 'gold';
  const edit = () => {
    const nextLabel = promptValue('Button label',label,90); if(nextLabel===null) return;
    const nextHref = promptValue('Link (https://... or #/guides/guide-slug)',String(node.attrs.href||''),600);
    if(nextHref===null) return;
    if (!safeGuideHref(nextHref)) {window.alert('Enter a safe HTTPS, HTTP, or internal guide link.');return;}
    updateAttributes({label:nextLabel||'Read guide',href:nextHref});
  };
  return <NodeViewWrapper className="guide-block-shell">
    <div className="guide-button-block" contentEditable={false}>
      {href ? <a className={variant==='gold'?'guide-cta guide-cta-gold':'guide-cta guide-cta-outline'} href={href} target={href.startsWith('#')||href.startsWith('/')?'_self':'_blank'} rel="noopener noreferrer" onClick={e=>{if(editor.isEditable)e.preventDefault()}}>{label}<ArrowUpRight size={16}/></a> : <span className="guide-cta guide-cta-outline">Add a button link</span>}
      <BlockControls editable={editor.isEditable} onEdit={edit} onRemove={deleteNode}/>
    </div>
  </NodeViewWrapper>;
}

function CalloutView({node,editor,updateAttributes,deleteNode}: NodeViewProps) {
  const tone = ['tip','warning','note'].includes(node.attrs.tone) ? String(node.attrs.tone) : 'tip';
  const title=String(node.attrs.title || 'Field note');
  const body=String(node.attrs.body || '');
  const edit=()=>{
    const t=promptValue('Box heading',title,100);if(t===null)return;
    const b=promptValue('Box text',body,1200);if(b===null)return;
    const toneInput=promptValue('Style: tip, warning, or note',tone,20);
    if(toneInput===null)return;
    updateAttributes({title:t,body:b,tone:['tip','warning','note'].includes(toneInput)?toneInput:tone});
  };
  return <NodeViewWrapper className="guide-block-shell">
    <aside className={'guide-callout guide-callout-'+tone} contentEditable={false}>
      <div className="guide-callout-heading">{tone==='warning'?<ShieldAlert size={19}/>:tone==='note'?<Info size={19}/>:<Sparkles size={19}/>}<strong>{title}</strong></div>
      <p>{body}</p>
      <BlockControls editable={editor.isEditable} onEdit={edit} onRemove={deleteNode}/>
    </aside>
  </NodeViewWrapper>;
}

function SkillView({node,editor,updateAttributes,deleteNode}: NodeViewProps) {
  const a=node.attrs;
  const icon=safeGuideImage(String(a.iconSrc||''));
  const href=safeGuideHref(String(a.relatedHref||''));
  const edit=()=>{
    const name=promptValue('Skill or gear name',String(a.title||''),100);if(name===null)return;
    const description=promptValue('Description',String(a.description||''),600);if(description===null)return;
    const tag=promptValue('Category / tags',String(a.tag||''),100);if(tag===null)return;
    const iconSrc=promptValue('Optional icon image URL (https://...)',String(a.iconSrc||''),700);if(iconSrc===null)return;
    if(iconSrc && !safeGuideImage(iconSrc)){window.alert('Icon must be a safe image URL.');return;}
    const relatedHref=promptValue('Related guide link (optional)',String(a.relatedHref||''),700);if(relatedHref===null)return;
    if(relatedHref && !safeGuideHref(relatedHref)){window.alert('Enter a safe link.');return;}
    updateAttributes({title:name,description,tag,iconSrc,relatedHref});
  };
  return <NodeViewWrapper className="guide-block-shell">
    <div className="guide-skill-card" contentEditable={false}>
      <div className="guide-skill-main">
        {icon ? <img className="guide-skill-icon" src={icon} alt="" loading="lazy"/> : <span className="guide-skill-icon guide-skill-placeholder">✧</span>}
        <div><span className="guide-skill-eyebrow">{String(a.tag||'FIELD MANUAL')}</span><h3>{String(a.title||'Skill or equipment')}</h3><p>{String(a.description||'')}</p></div>
      </div>
      {href && <a href={href} target={href.startsWith('#')||href.startsWith('/')?'_self':'_blank'} rel="noopener noreferrer" onClick={e=>{if(editor.isEditable)e.preventDefault()}} className="guide-skill-related">RELATED GUIDE <ArrowUpRight size={14}/></a>}
      <BlockControls editable={editor.isEditable} onEdit={edit} onRemove={deleteNode}/>
    </div>
  </NodeViewWrapper>;
}

function normalizeImages(value: unknown): GalleryImage[] {
  if(!Array.isArray(value)) return [];
  return value.slice(0,24).filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item==='object')
    .map(item=>({src:String(item.src||''),alt:String(item.alt||''),caption:String(item.caption||'')}))
    .filter(image=>Boolean(safeGuideImage(image.src)));
}

function GalleryView({node,editor,updateAttributes,deleteNode}: NodeViewProps) {
  const [active,setActive]=useState<number|null>(null);
  const images=normalizeImages(node.attrs.images);
  const columns=node.attrs.columns===2?2:3;
  useEffect(()=>{
    if(active===null)return;
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setActive(null);
      if(event.key==='ArrowRight')setActive(i=>i===null?null:(i+1)%images.length);
      if(event.key==='ArrowLeft')setActive(i=>i===null?null:(i+images.length-1)%images.length);
    };
    window.addEventListener('keydown',keydown);
    return ()=>window.removeEventListener('keydown',keydown);
  },[active,images.length]);
  const edit=()=>{
    const nextColumns=promptValue('Gallery columns: 2 or 3',String(columns),1);
    if(nextColumns===null)return;
    updateAttributes({columns:nextColumns==='2'?2:3});
  };
  const editImage=(index:number)=>{
    const previous=images[index];
    const caption=promptValue('Image caption (leave blank for none)',previous.caption,250);
    if(caption===null)return;
    const alt=promptValue('Accessible image description',previous.alt,250);
    if(alt===null)return;
    updateAttributes({images:images.map((img,i)=>i===index?{...img,caption,alt}:img)});
  };
  return <NodeViewWrapper className="guide-block-shell">
    <div className="guide-gallery" contentEditable={false}>
      <div className={'guide-gallery-grid columns-'+columns}>
        {images.map((img,index)=><figure key={index} className="guide-gallery-item">
          <button type="button" onClick={()=>setActive(index)} title={'Enlarge '+(img.alt||'image')}><img src={safeGuideImage(img.src)||''} alt={img.alt} loading="lazy"/><ZoomIn size={18} className="guide-gallery-zoom"/></button>
          {img.caption&&<figcaption>{img.caption}</figcaption>}
          {editor.isEditable && <div className="guide-gallery-controls"><button type="button" onClick={()=>editImage(index)}>Edit caption</button><button type="button" onClick={()=>updateAttributes({images:images.filter((_,i)=>i!==index)})}>Remove image</button></div>}
        </figure>)}
      </div>
      {images.length===0&&<p>No images in this gallery. Insert another gallery to add images.</p>}
      <BlockControls editable={editor.isEditable} onEdit={edit} onRemove={deleteNode}/>
      {active!==null && images[active] && <div className="guide-lightbox" role="dialog" aria-modal="true" aria-label="Image gallery viewer" onClick={()=>setActive(null)}>
        <button type="button" className="guide-lightbox-close" onClick={()=>setActive(null)} aria-label="Close gallery"><X size={24}/></button>
        {images.length>1&&<button type="button" className="guide-lightbox-prev" onClick={e=>{e.stopPropagation();setActive((active+images.length-1)%images.length)}} aria-label="Previous image"><ChevronLeft size={26}/></button>}
        <figure onClick={e=>e.stopPropagation()}><img src={images[active].src} alt={images[active].alt}/><figcaption>{images[active].caption||images[active].alt} {images.length>1 && <span>· {active+1} / {images.length}</span>}</figcaption></figure>
        {images.length>1&&<button type="button" className="guide-lightbox-next" onClick={e=>{e.stopPropagation();setActive((active+1)%images.length)}} aria-label="Next image"><ChevronRight size={26}/></button>}
      </div>}
    </div>
  </NodeViewWrapper>;
}

export const GuideButton = Node.create({
  name:'guideButton',group:'block',atom:true,selectable:true,
  addAttributes(){return {label:attr('label','Read guide'),href:attr('href',''),variant:attr('variant','gold')};},
  parseHTML(){return [{tag:'div[data-guide-button]'}];},
  renderHTML({HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-guide-button':'true'})];},
  addNodeView(){return ReactNodeViewRenderer(ButtonView);}
});
export const GuideCallout = Node.create({
  name:'guideCallout',group:'block',atom:true,selectable:true,
  addAttributes(){return {title:attr('title','Field note'),body:attr('body',''),tone:attr('tone','tip')};},
  parseHTML(){return [{tag:'div[data-guide-callout]'}];},
  renderHTML({HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-guide-callout':'true'})];},
  addNodeView(){return ReactNodeViewRenderer(CalloutView);}
});
export const GuideSkillCard = Node.create({
  name:'guideSkillCard',group:'block',atom:true,selectable:true,
  addAttributes(){return {title:attr('title','Skill or equipment'),description:attr('description',''),tag:attr('tag',''),iconSrc:attr('iconSrc',''),relatedHref:attr('relatedHref','')};},
  parseHTML(){return [{tag:'div[data-guide-skill-card]'}];},
  renderHTML({HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-guide-skill-card':'true'})];},
  addNodeView(){return ReactNodeViewRenderer(SkillView);}
});
export const GuideGallery = Node.create({
  name:'guideGallery',group:'block',atom:true,selectable:true,
  addAttributes(){return {
    images:{
      default:[],
      parseHTML:(el:HTMLElement)=>{try{return JSON.parse(el.getAttribute('data-images')||'[]');}catch{return [];}},
      renderHTML:(attrs:Record<string,unknown>)=>({'data-images':JSON.stringify(attrs.images||[])})
    },
    columns:{default:3,parseHTML:(el:HTMLElement)=>Number(el.getAttribute('data-columns')||3),renderHTML:(attrs:Record<string,unknown>)=>({'data-columns':attrs.columns===2?'2':'3'})}
  };},
  parseHTML(){return [{tag:'div[data-guide-gallery]'}];},
  renderHTML({HTMLAttributes}){return ['div',mergeAttributes(HTMLAttributes,{'data-guide-gallery':'true'})];},
  addNodeView(){return ReactNodeViewRenderer(GalleryView);}
});
