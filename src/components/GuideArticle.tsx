import React, { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { ArrowLeft, BookOpen, Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import GuideContent, { prepareGuideContent } from './GuideContent';

export type ArticleGuide = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  read?: string;
  content?: JSONContent;
  body?: string[];
};

export const guideHref = (slug:string) => '#/guides/' + encodeURIComponent(slug);

export default function GuideArticle({guide,onBack,preview=false}:{guide:ArticleGuide;onBack:()=>void;preview?:boolean}) {
  const [copied,setCopied]=useState(false);
  const headings=guide.content ? prepareGuideContent(guide.content).headings : [
    {id:'overview',text:'Overview',level:2},{id:'fieldnotes',text:'Field Notes',level:2}
  ];
  const jump=(event:React.MouseEvent<HTMLAnchorElement>,id:string)=>{
    event.preventDefault();
    if(!preview && guide.slug) {
      window.history.replaceState(null,'',guideHref(guide.slug)+'?section='+encodeURIComponent(id));
    }
    document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const share=async()=>{
    const url=window.location.origin+window.location.pathname+guideHref(guide.slug);
    try {await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2500);}
    catch {window.prompt('Copy this guide URL',url);}
  };
  return <main className="inner-page article-wrap">
    <div className="article-actions">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16}/>{preview?' BACK TO EDITOR':' ALL GUIDES'}</button>
      {!preview && <button type="button" className="article-share" onClick={()=>void share()}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'LINK COPIED':'COPY LINK'}</button>}
    </div>
    <div className="article-hero"><span className="section-kicker left">{guide.category.toUpperCase()} · {preview?'PRIVATE PREVIEW':guide.read||'GUILD GUIDE'}</span>
      <h1>{guide.title||'Untitled guide'}</h1><p>{guide.summary||'Your guide summary will appear here.'}</p>
      {preview&&<span className="article-draft-tag"><BookOpen size={15}/> UNSAVED PREVIEW · ONLY VISIBLE TO YOU</span>}
    </div>
    <article className="article">
      <nav className="article-sidebar" aria-label="In this guide">
        <span>IN THIS GUIDE</span>
        {headings.length ? headings.map((h,i)=>
          <a key={h.id} className={'article-toc-level-'+h.level} href={guideHref(guide.slug)+'?section='+encodeURIComponent(h.id)} onClick={e=>jump(e,h.id)}>
            {h.text}
          </a>) : <p className="article-toc-empty">Add headings to generate a table of contents.</p>}
        {!preview && <a className="article-toc-bottom" href={guideHref(guide.slug)} onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}}>↑ BACK TO TOP</a>}
      </nav>
      <div className="article-body">
        {guide.content ? <GuideContent key={JSON.stringify(guide.content)} content={guide.content}/> :
          <><h2 id="overview">Overview</h2><p>{guide.body?.[0]||''}</p>
          <h2 id="fieldnotes">Field Notes</h2><p>{guide.body?.[1]||''}</p>
          <div className="editorial-note"><Sparkles size={19}/><span>This is starter content. Final guides will be written and published through the secure guild admin panel.</span></div></>}
        {!preview&&<div className="article-end"><Sparkles size={15}/> FORGED IN KNOWLEDGE · UNITED IN PURPOSE</div>}
      </div>
    </article>
  </main>;
}
