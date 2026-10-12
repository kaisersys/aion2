import React, {useState, useEffect, useCallback, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Search, Menu, X, ChevronDown, ChevronRight, ArrowUpRight, BookOpen, Shield, Swords, Sparkles, Compass, Gem, ScrollText, LogIn, ArrowLeft} from 'lucide-react';
import './style.css';
const AdminPanel = React.lazy(() => import('./admin/AdminPanel'));
const GuideArticle = React.lazy(() => import('./components/GuideArticle'));
import { getPublishedGuides, type GuideRecord } from './lib/guides';
import { isSupabaseConfigured } from './lib/supabase';
import type { JSONContent } from '@tiptap/core';

type Guide={slug:string;title:string;category:string;summary:string;read:string;accent:string;body:string[];featured?:boolean;content?:JSONContent};
const starterGuides:Guide[]=[
{slug:'first-steps',title:'The First Steps of a Daeva',category:'Getting Started',summary:'Everything you need to know before your journey begins.',read:'8 MIN READ',accent:'ice',featured:true,body:['Choose your class according to how you enjoy playing. Learn your core abilities before investing heavily in equipment.','Follow the main campaign, unlock essential systems, and use the guild chat whenever you have questions.']},
{slug:'ranger',title:'Ranger — Path of the Hunter',category:'Classes',summary:'Skills, stigma choices, rotations, and stat priorities.',read:'12 MIN READ',accent:'gold',featured:true,body:['A class overview for guild members. Add tested builds, screenshots, and rotations here.','Separate your solo, group, and PvP setups so new players can quickly find what they need.']},
{slug:'gear',title:'Equipment Progression',category:'Progression',summary:'From your first upgrades to the next major gear milestone.',read:'10 MIN READ',accent:'violet',featured:true,body:['Prioritize efficient upgrades, and make a clear plan before spending expensive materials.','Use this page for gear tiers, enhancement priorities, and resource checklists.']},
{slug:'abyss',title:'The Abyss Field Manual',category:'PvP & Abyss',summary:'Guild tactics, sieges, and battlefield fundamentals.',read:'7 MIN READ',accent:'red',body:['Coordinate your team before engaging. Positioning, objective timing, and communication matter.','Document your guild’s preferred strategies and callouts here.']},
{slug:'dungeons',title:'Dungeon Expedition Guide',category:'Dungeons & Raids',summary:'Preparation, team roles, and encounter notes.',read:'9 MIN READ',accent:'ice',body:['List each encounter’s critical mechanics and recommended preparation.','Keep guides short enough to review before a run, with expandable detail for anyone who needs it.']},
{slug:'crafting',title:'Crafting & Gathering',category:'Professions',summary:'Materials, equipment recipes, and economy essentials.',read:'6 MIN READ',accent:'gold',body:['Track ingredients and explain which items are worth crafting.','Add a guild materials wishlist and update it as content changes.']}
];
function routeFromHash():string {
  const hash=window.location.hash;
  if(hash==='#admin')return 'admin';
  if(hash==='#/library')return 'library';
  if(hash.startsWith('#/guides/')) {
    try {return 'guide:'+decodeURIComponent(hash.slice('#/guides/'.length).split('?')[0]);}
    catch{return 'home';}
  }
  return 'home';
}
const navigation=[{title:'DISCOVER',items:['Getting Started','Progression','Professions']},{title:'CLASSES',items:['Classes']},{title:'CHALLENGES',items:['Dungeons & Raids','PvP & Abyss']}];
function App(){
 const [page,setPage]=useState(routeFromHash);const [category,setCategory]=useState('All Guides');const [search,setSearch]=useState('');const [finderQuery,setFinderQuery]=useState('');const [finderFocused,setFinderFocused]=useState(false);const [menu,setMenu]=useState(false);const [openMenu,setOpenMenu]=useState<string|null>(null);
 const heroRef=useRef<HTMLElement|null>(null);
 const [publishedGuides,setPublishedGuides]=useState<GuideRecord[]>([]);
 const [guidesError,setGuidesError]=useState('');
 const [guidesLoading,setGuidesLoading]=useState(isSupabaseConfigured);
 const refreshGuides=useCallback(async()=>{
   if(!isSupabaseConfigured) return;
   try {
     const results=await getPublishedGuides();
     setPublishedGuides(results);
     setGuidesError('');
   }catch(error){setGuidesError('Unable to load published guides. Please try again later.');console.error(error);}
   finally{setGuidesLoading(false);}
 },[]);
 useEffect(()=>{void refreshGuides();},[refreshGuides]);
 useEffect(()=>{
   const updateRoute=()=>{setPage(routeFromHash());window.scrollTo({top:0,behavior:'instant'});};
   window.addEventListener('hashchange',updateRoute);
   return ()=>window.removeEventListener('hashchange',updateRoute);
 },[]);
 // Move the painting, distant starlight and nearby haze independently.
 // CSS variables avoid re-rendering the guide finder on pointer or scroll events.
 useEffect(()=>{
   if(page!=='home')return;
   const hero=heroRef.current;
   if(!hero)return;
   const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
   const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
   if(reduceMotion.matches)return;
   let pointerX=0,pointerY=0,frame=0;
   const update=()=>{
     frame=0;
     const scroll=Math.max(0,Math.min(window.scrollY,hero.offsetHeight));
     const factor=window.innerWidth<=760?.55:1;
     hero.style.setProperty('--hero-bg-x',(-pointerX*8*factor).toFixed(1)+'px');
     hero.style.setProperty('--hero-bg-y',(scroll*.13*factor-pointerY*5*factor).toFixed(1)+'px');
     hero.style.setProperty('--hero-mid-x',(-pointerX*17*factor).toFixed(1)+'px');
     hero.style.setProperty('--hero-mid-y',(scroll*.23*factor-pointerY*10*factor).toFixed(1)+'px');
     hero.style.setProperty('--hero-fg-x',(-pointerX*27*factor).toFixed(1)+'px');
     hero.style.setProperty('--hero-fg-y',(scroll*.32*factor-pointerY*14*factor).toFixed(1)+'px');
   };
   const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
   const onPointerMove=(event:PointerEvent)=>{
     if(!finePointer.matches)return;
     const rect=hero.getBoundingClientRect();
     pointerX=(event.clientX-(rect.left+rect.width/2))/(rect.width/2);
     pointerY=(event.clientY-(rect.top+rect.height/2))/(rect.height/2);
     schedule();
   };
   const onPointerLeave=()=>{pointerX=0;pointerY=0;schedule();};
   const onMotionChange=()=>{
     if(reduceMotion.matches){
       if(frame)window.cancelAnimationFrame(frame);
       frame=0;
       for(const property of ['--hero-bg-x','--hero-bg-y','--hero-mid-x','--hero-mid-y','--hero-fg-x','--hero-fg-y']){
         hero.style.removeProperty(property);
       }
     }else schedule();
   };
   hero.addEventListener('pointermove',onPointerMove,{passive:true});
   hero.addEventListener('pointerleave',onPointerLeave);
   window.addEventListener('scroll',schedule,{passive:true});
   window.addEventListener('resize',schedule,{passive:true});
   reduceMotion.addEventListener('change',onMotionChange);
   schedule();
   return ()=>{
     if(frame)window.cancelAnimationFrame(frame);
     hero.removeEventListener('pointermove',onPointerMove);
     hero.removeEventListener('pointerleave',onPointerLeave);
     window.removeEventListener('scroll',schedule);
     window.removeEventListener('resize',schedule);
     reduceMotion.removeEventListener('change',onMotionChange);
   };
 },[page]);
 const dynamicGuides:Guide[]=publishedGuides.map(g=>({
   slug:g.slug,title:g.title,category:g.category,summary:g.summary,
   read:'GUILD GUIDE',accent:g.category==='Classes'?'gold':g.category==='Progression'?'violet':g.category==='PvP & Abyss'?'red':'ice',
   body:[],featured:g.featured,content:g.content
 }));
 const guides:Guide[]=[...dynamicGuides,...starterGuides.filter(g=>!dynamicGuides.some(d=>d.slug===g.slug))];
 const current=guides.find(g=>page==='guide:'+g.slug);const filtered=guides.filter(g=>(category==='All Guides'||g.category===category)&&(g.title+' '+g.summary+' '+g.category).toLowerCase().includes(search.toLowerCase()));
 const suggestions=finderQuery.trim()?guides.filter(g=>(g.title+' '+g.category+' '+g.summary).toLowerCase().includes(finderQuery.toLowerCase())).slice(0,4):[];
 const go=(slug:string)=>{
   window.location.hash=slug==='admin'?'admin':slug==='home'?'':slug==='library'?'/library':'/guides/'+encodeURIComponent(slug);
   setPage(slug==='admin'||slug==='home'||slug==='library'?slug:'guide:'+slug);
   setMenu(false);setOpenMenu(null);window.scrollTo({top:0,behavior:'smooth'});
 };
 useEffect(()=>{
   if(!page.startsWith('guide:'))return;
   const section=new URLSearchParams(window.location.hash.split('?')[1]||'').get('section');
   if(!section)return;
   const task=window.setTimeout(()=>document.getElementById(section)?.scrollIntoView({block:'start'}),350);
   return ()=>window.clearTimeout(task);
 },[page,publishedGuides.length]);
 const choose=(cat:string)=>{setSearch('');setFinderQuery('');setFinderFocused(false);setCategory(cat);go('library');};
 const openSuggestion=(slug:string)=>{setFinderQuery('');setFinderFocused(false);go(slug)};
 const quickTopics=[{label:'CLASSES',category:'Classes',icon:<Swords size={19}/>},{label:'GEAR',category:'Progression',icon:<Gem size={19}/>},{label:'DUNGEONS',category:'Dungeons & Raids',icon:<Shield size={19}/>},{label:'ABYSS',category:'PvP & Abyss',icon:<Compass size={19}/>},{label:'CRAFTING',category:'Professions',icon:<ScrollText size={19}/>},{label:'ALL GUIDES',category:'All Guides',icon:<BookOpen size={19}/>}];
 return <div className="site">
   <header className="header"><button className="brand" onClick={()=>go('home')} aria-label="Home"><img className="brand-logo" src="/assets/branding/aion-logo.avif" alt="Aion" width="110" height="74"/><span className="brand-lines"><strong>ATREIA <em>STREET</em></strong><small>INDEPENDENT GUILD CODEX</small></span></button>
   <nav className={'nav '+(menu?'nav-open':'')} aria-label="Main navigation">
   <button className="nav-link" onClick={()=>go('home')}>HOME</button><button className="nav-link nav-emphasis" onClick={()=>choose('All Guides')}>GUIDE FINDER <ArrowUpRight size={13}/></button>
   {navigation.map(n=><div className="nav-group" key={n.title} onMouseEnter={()=>setOpenMenu(n.title)} onMouseLeave={()=>setOpenMenu(null)}>
    <button className="nav-link" aria-expanded={openMenu===n.title} onClick={()=>setOpenMenu(openMenu===n.title?null:n.title)}>{n.title}<ChevronDown size={13}/></button>
    <div className={'dropdown '+(openMenu===n.title?'show':'')}>{n.items.map(item=><button key={item} onClick={()=>choose(item)}><span>{item}</span><ChevronRight size={14}/></button>)}</div>
   </div>)}
   <button className="nav-link" onClick={()=>choose('All Guides')}>ALL GUIDES</button><button className="nav-link mobile-admin-link" onClick={()=>go('admin')}>ADMIN AREA</button>
   </nav><div className="header-actions"><button className="header-search" onClick={()=>go('library')} aria-label="Search guides"><Search size={19}/></button><button className="outline-button" onClick={()=>go('admin')}>ADMIN <ArrowUpRight size={14}/></button><button className="mobile-toggle" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button></div></header>
   {page==='home'? <><section className="hero" ref={heroRef}><div className="hero-art" aria-hidden="true"/><div className="hero-sky" aria-hidden="true"/><div className="hero-foreground" aria-hidden="true"/>
   <div className="hero-content">
    <div className="hero-copy">
     <div className="eyebrow"><span/>A SANCTUARY OF KNOWLEDGE<span/></div><h1>THE PATH OF<br/><i>THE DAEVA</i></h1><div className="ornament">✧ ─── ✦ ─── ✧</div><p>Knowledge is our greatest weapon. Explore battle-tested guides, discoveries, and wisdom from your fellow guild members.</p><button className="gold-button" onClick={()=>choose('All Guides')}>EXPLORE THE CODEX <ArrowUpRight size={16}/></button>
     <div className="hero-finder">
    <form className="finder-form" role="search" onSubmit={e=>{e.preventDefault();setSearch(finderQuery.trim());setCategory('All Guides');setFinderFocused(false);go('library')}}>
     <div className="finder-label"><Search size={15}/> FIND YOUR GUIDE</div>
     <div className="finder-field-wrap">
      <label className="finder-field"><Search size={20}/><input type="search" value={finderQuery} onChange={e=>setFinderQuery(e.target.value)} onFocus={()=>setFinderFocused(true)} placeholder="Search builds, classes, dungeons..." aria-label="Search guides"/></label>
      <button type="submit" className="finder-submit">SEARCH <ArrowUpRight size={15}/></button>
      {finderFocused&&finderQuery.trim()&&<div className="finder-suggestions" aria-label="Matching guides">{suggestions.length? suggestions.map(g=><button type="button" key={g.slug} onClick={()=>openSuggestion(g.slug)}><span><strong>{g.title}</strong><small>{g.category}</small></span><ArrowUpRight size={16}/></button>):<div className="finder-empty">No exact matches. Press Search to explore the full library.</div>}</div>}
     </div>
    </form>
    <div className="finder-topics"><div className="finder-label"><Sparkles size={15}/> BROWSE BY TOPIC</div><div className="finder-topic-grid">{quickTopics.map(topic=><button key={topic.label} type="button" onClick={()=>choose(topic.category)} className="finder-topic">{topic.icon}<span>{topic.label}</span></button>)}</div></div>
   </div>
    </div>
   </div><div className="hero-bottom"><span>SCROLL TO DISCOVER</span><span className="line"/><span>THE GUILD ARCHIVES</span></div></section>
   <section className="intro section-wrap"><div className="section-kicker">✦ &nbsp; THE GUILD ARCHIVES &nbsp; ✦</div><h2>Discover Your <i>Destiny</i></h2><p className="section-description">From your first steps in Atreia to the fiercest battles, every journey begins with knowledge.</p><div className="category-grid">{[{title:'CLASS GUIDES',sub:'Master your calling',icon:<Swords size={30}/>,cat:'Classes',style:'gold'},{title:'GEAR & PROGRESSION',sub:'Forge your strength',icon:<Gem size={30}/>,cat:'Progression',style:'violet'},{title:'DUNGEONS & RAIDS',sub:'Face the unknown',icon:<Shield size={30}/>,cat:'Dungeons & Raids',style:'ice'},{title:'THE ABYSS',sub:'Conquer the skies',icon:<Compass size={30}/>,cat:'PvP & Abyss',style:'red'}].map(c=><button className={'category-tile '+c.style} key={c.title} onClick={()=>choose(c.cat)}><span className="tile-icon">{c.icon}</span><div><strong>{c.title}</strong><small>{c.sub}</small></div><ArrowUpRight className="tile-arrow" size={19}/></button>)}</div></section>
   <section className="featured section-wrap"><div className="section-top"><div><div className="section-kicker left">CURATED BY THE GUILD</div><h2>Featured <i>Guides</i></h2></div><button className="text-action" onClick={()=>choose('All Guides')}>VIEW ALL GUIDES <ArrowUpRight size={17}/></button></div><div className="guide-grid">{guides.filter(g=>g.featured).map(g=><GuideCard guide={g} key={g.slug} onClick={()=>go(g.slug)}/>)}</div></section>
   <section className="join-banner"><span>THE JOURNEY IS BETTER TOGETHER</span><h2>United by <i>Purpose</i></h2><p>Built for our guild. Written by our adventurers. Shared with everyone.</p><button className="gold-button" onClick={()=>choose('All Guides')}>ENTER THE ARCHIVES <ArrowUpRight size={16}/></button></section></>:
   page==='library'?<main className="inner-page section-wrap"><button className="back-link" onClick={()=>go('home')}><ArrowLeft size={16}/> BACK TO HOME</button><div className="section-kicker left">THE KNOWLEDGE ARCHIVE</div><h1>Guild <i>Guides</i></h1><p className="page-intro">Explore field manuals, class builds, progression paths, and guild strategies.</p><div className="library-controls"><label className="search-box"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guides..." aria-label="Search guides"/></label><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter by category">{['All Guides',...new Set(guides.map(g=>g.category))].map(c=><option key={c}>{c}</option>)}</select></div>{guidesError&&<p role="status" className="studio-message">{guidesError}</p>}<div className="guide-grid">{filtered.map(g=><GuideCard key={g.slug} guide={g} onClick={()=>go(g.slug)}/>)}</div>{filtered.length===0&&<p>No matching guides. Try another search.</p>}</main>:
   page==='admin'?<React.Suspense fallback={<main className="inner-page section-wrap"><p>Loading Guide Studio...</p></main>}><AdminPanel onExit={()=>go('home')} onContentChanged={()=>{void refreshGuides()}}/></React.Suspense>:
   current?<React.Suspense fallback={<main className="inner-page article-wrap"><p>Loading guide...</p></main>}>
     <GuideArticle key={current.slug} guide={current} onBack={()=>go('library')}/>
   </React.Suspense>:page.startsWith('guide:')?<main className="inner-page section-wrap">
     <button className="back-link" onClick={()=>go('library')}><ArrowLeft size={16}/> ALL GUIDES</button>
     <div className="section-kicker left">THE GUILD ARCHIVES</div>
     <h1>{guidesLoading?'Loading guide...':'Guide unavailable'}</h1>
     {!guidesLoading&&<p className="page-intro">This guide may not exist yet, or it has not been published. Only published posts are visible to visitors.</p>}
   </main>:null}

   <footer><div className="footer-brand">✦ &nbsp; AION II <span>GUILD CODEX</span></div><p>An independent fan-made community guide project. Not affiliated with or endorsed by NCSOFT.</p><div>FORGED IN KNOWLEDGE · UNITED IN PURPOSE</div></footer>
 </div>
}
function GuideCard({guide,onClick}:{guide:Guide;onClick:()=>void}){return <button className={'guide-card '+guide.accent} onClick={onClick}><div className="card-visual"><span className="card-glyph">{guide.accent==='gold'?'⌁':guide.accent==='violet'?'✧':guide.accent==='red'?'✦':'◇'}</span></div><div className="card-content"><span className="card-category">{guide.category.toUpperCase()} <span>• {guide.read}</span></span><h3>{guide.title}</h3><p>{guide.summary}</p><span className="card-action">READ GUIDE <ArrowUpRight size={15}/></span></div></button>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
