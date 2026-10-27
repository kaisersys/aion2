import React,{useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowLeft,ArrowUpRight,Bell,Bookmark,BookmarkCheck,ChartNoAxesCombined,Clock3,ExternalLink,Info,Package,Plus,Search,Trash2} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {REGIONS,STARTER_ITEMS,MARKET_SOURCE,parseMarketFeed,latestPrice,
  type MarketItem,type MarketQuote,type PricePoint} from '../lib/marketCatalog';
import {loadMarketServers,loadMarketSnapshot,type MarketServer} from '../lib/marketFeed';
import {loadOfficialIcons} from '../lib/officialItemIcons';
import MarketPulse from './MarketPulse';
import './market.css';

type MarketPrefs={region:string;server:string;watchlist:string[];targets:Record<string,number>;notes:Record<string,PricePoint[]>};
type Tab='watchlist'|'explore'|'alerts';
const STORAGE='atreia-market-v1';
const AUTH_KEY='atreia_market_v1';
const FEED_URL=(import.meta.env.VITE_MARKET_FEED_URL||'').trim();
const initial:MarketPrefs={region:'NA East',server:'',watchlist:[],targets:{},notes:{}};
function readPrefs(value:unknown):MarketPrefs {
  if(!value || typeof value!=='object')return {...initial};
  const r=value as Record<string,unknown>;
  const watchlist=Array.isArray(r.watchlist)?r.watchlist.filter((s):s is string=>typeof s==='string'&&/^\d{5,15}$/.test(s)).slice(0,60):[];
  const targets:Record<string,number>={},notes:Record<string,PricePoint[]>={};
  if(r.targets&&typeof r.targets==='object')for(const [key,value] of Object.entries(r.targets)){
    if(key.length<=150&&Number.isSafeInteger(value)&&Number(value)>0)targets[key]=Number(value);
  }
  if(r.notes&&typeof r.notes==='object')for(const [key,value] of Object.entries(r.notes)){
    if(key.length>150||!Array.isArray(value))continue;
    notes[key]=value.slice(-60).flatMap((p):PricePoint[]=>{
      if(!p||typeof p!=='object')return [];
      const pt=p as Record<string,unknown>;
      if(typeof pt.at!=='string'||!Number.isFinite(Date.parse(pt.at))||typeof pt.price!=='number'||pt.price<=0||!Number.isFinite(pt.price))return [];
      return [{at:pt.at,price:pt.price}];
    });
  }
  return {region:typeof r.region==='string'&&REGIONS.some(x=>x===r.region)?r.region:initial.region,
    server:typeof r.server==='string'?r.server.slice(0,48):'',watchlist:[...new Set(watchlist)],targets,notes};
}
function localPrefs():MarketPrefs {try{return readPrefs(JSON.parse(localStorage.getItem(STORAGE)||'null'));}catch{return {...initial};}}
const keyFor=(region:string,server:string,id:string)=>[region.trim().toLowerCase(),server.trim().toLowerCase(),id].join(':');
const pretty=(v:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v);
const since=(iso:string)=>{
  const ms=Date.now()-Date.parse(iso);
  return !Number.isFinite(ms)?'Unknown':ms<0?'Just now':ms<3600000?Math.max(1,Math.floor(ms/60000))+'m ago':ms<86400000?Math.floor(ms/3600000)+'h ago':Math.floor(ms/86400000)+'d ago';
};
function Chart({points,days}:{points:PricePoint[];days:number}){
  const range=useMemo(()=>points.filter(p=>Date.parse(p.at)>=Date.now()-days*86400000).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),[points,days]);
  if(range.length<2)return <p className="market-muted">Not enough observations for a {days}-day chart. Save a few prices over time to see a trend.</p>;
  const width=620,height=155,min=Math.min(...range.map(p=>p.price)),max=Math.max(...range.map(p=>p.price));
  const from=Date.parse(range[0].at),to=Date.parse(range[range.length-1].at);
  const coord=(p:PricePoint)=>[20+580*(Date.parse(p.at)-from)/Math.max(1,to-from),
    134-114*(p.price-min)/Math.max(1,max-min)];
  const line=range.map(p=>coord(p).map(n=>n.toFixed(1)).join(',')).join(' ');
  return <div className="market-chart-wrap">
    <div className="market-chart-stats"><span>Low <strong>{pretty(min)}</strong></span><span>High <strong>{pretty(max)}</strong></span><span>{range.length} observations</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={days+' day recorded price trend: '+pretty(range[0].price)+' to '+pretty(range[range.length-1].price)} preserveAspectRatio="none">
      <line x1="20" y1="20" x2="600" y2="20" className="market-gridline"/>
      <line x1="20" y1="77" x2="600" y2="77" className="market-gridline"/>
      <line x1="20" y1="134" x2="600" y2="134" className="market-gridline"/>
      <polyline points={line} className="market-chart-line" fill="none"/>
    </svg>
    <div className="market-chart-dates"><span>{new Date(from).toLocaleDateString()}</span><span>{new Date(to).toLocaleDateString()}</span></div>
  </div>;
}
export default function MarketPage({user,onBack,onLogin}:{user:User|null;onBack:()=>void;onLogin:()=>void}){
  const [tab,setTab]=useState<Tab>('watchlist');
  const [prefs,setPrefs]=useState<MarketPrefs>(localPrefs);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('All');
  const [selected,setSelected]=useState<string|null>(null);
  const [notePrice,setNotePrice]=useState('');
  const [targetValue,setTargetValue]=useState('');
  const [chartDays,setChartDays]=useState(7);
  const [quotes,setQuotes]=useState<MarketQuote[]>([]);
  const [feedError,setFeedError]=useState('');
  const [feedLoading,setFeedLoading]=useState(Boolean(FEED_URL));
  const [marketServers,setMarketServers]=useState<MarketServer[]>([]);
  const [marketItems,setMarketItems]=useState<MarketItem[]>([]);
  const [lastRefresh,setLastRefresh]=useState('');
  const [characterServers,setCharacterServers]=useState<string[]>([]);
  const [officialIcons,setOfficialIcons]=useState<Record<string,string>>({});
  useEffect(()=>{
    const controller=new AbortController();
    void loadOfficialIcons(controller.signal).then(setOfficialIcons).catch(()=>{});
    return()=>controller.abort();
  },[]);

  // A player's own auth metadata stores a deliberately compact watchlist; no new SQL migration.
  useEffect(()=>{
    let active=true;setReady(false);setSaveError('');
    if(!user||!supabase){setPrefs(localPrefs());setReady(true);return;}
    void (async()=>{
      try{
        const {data,error}=await supabase!.auth.getUser();
        if(error)throw error;
        if(!active)return;
        const remote=data.user?.user_metadata?.[AUTH_KEY];
        setPrefs(remote?readPrefs(remote):localPrefs());
      }catch{if(active){setPrefs(localPrefs());setSaveError('Could not load your cloud watchlist. Local changes may not sync.');}}
      finally{if(active)setReady(true);}
    })();
    return()=>{active=false;};
  },[user?.id]);

  useEffect(()=>{
    if(!ready)return;
    try{localStorage.setItem(STORAGE,JSON.stringify(prefs));}catch{setSaveError('Local browser storage is unavailable.');}
    if(!user||!supabase)return;
    let cancelled=false;
    const timer=window.setTimeout(()=>{
      setSaving(true);
      void supabase!.auth.updateUser({data:{[AUTH_KEY]:prefs}}).then(({error})=>{
        if(!cancelled)setSaveError(error?'Could not sync watchlist to your account. Please try again.':'');
      }).catch(()=>{if(!cancelled)setSaveError('Could not sync watchlist to your account.');})
      .finally(()=>{if(!cancelled)setSaving(false);});
    },700);
    return()=>{cancelled=true;window.clearTimeout(timer);};
  },[prefs,ready,user?.id]);

  useEffect(()=>{
    if(!user||!supabase)return;
    let active=true;
    void supabase.from('player_characters').select('server_name').eq('user_id',user.id).then(({data,error})=>{
      if(active&&!error)setCharacterServers([...new Set((data||[]).map(c=>c.server_name).filter(s=>s&&s!=='My server'))]);
    });
    return()=>{active=false;};
  },[user?.id]);

  useEffect(()=>{
    if(FEED_URL)return;
    const controller=new AbortController();
    void loadMarketServers(controller.signal).then(servers=>setMarketServers(servers)).catch(()=>{
      // Personal notes and watchlists still work before the optional feed is enabled.
    });
    return()=>controller.abort();
  },[]);
  const matchedServer=marketServers.find(server=>server.region===prefs.region&&server.label===prefs.server);
  useEffect(()=>{
    const controller=new AbortController();
    if(!FEED_URL&&!matchedServer){
      setQuotes([]);setMarketItems([]);setFeedLoading(false);setLastRefresh('');
      return()=>controller.abort();
    }
    setFeedLoading(true);setFeedError('');
    void (async()=>{
      try{
        if(FEED_URL){
          const u=new URL(FEED_URL);
          if(u.protocol!=='https:')throw new Error('Only HTTPS market feeds are supported.');
          const response=await fetch(u.toString(),{signal:controller.signal,cache:'no-cache',headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('Market feed returned HTTP '+response.status);
          const raw=await response.json();
          if(!controller.signal.aborted){setQuotes(parseMarketFeed(raw));setMarketItems([]);}
        }else{
          const result=await loadMarketSnapshot(matchedServer!.id,controller.signal);
          if(!controller.signal.aborted){setQuotes(result.quotes);setMarketItems(result.items);setLastRefresh(result.refreshedAt);}
        }
      }catch(error){
        if(!controller.signal.aborted){
          setFeedError('Could not load prices for this server. Saved notes still work.');
          setQuotes([]);setMarketItems([]);
        }
      }finally{if(!controller.signal.aborted)setFeedLoading(false);}
    })();
    return()=>controller.abort();
  },[prefs.region,prefs.server,marketServers]);

  const set=(change:Partial<MarketPrefs>)=>setPrefs(old=>({...old,...change}));
  const addWatch=(id:string)=>setPrefs(old=>({...old,watchlist:old.watchlist.includes(id)?old.watchlist:[...old.watchlist,id].slice(0,60)}));
  const removeWatch=(id:string)=>setPrefs(old=>({...old,watchlist:old.watchlist.filter(x=>x!==id)}));
  const targetKey=(id:string)=>keyFor(prefs.region,prefs.server,id);
  const addTarget=(id:string,text:string)=>{
    const price=Number(text);
    if(!Number.isSafeInteger(price)||price<=0)return;
    setPrefs(old=>({...old,targets:{...old.targets,[targetKey(id)]:price}}));
    addWatch(id);setTargetValue('');
  };
  const removeTarget=(id:string)=>setPrefs(old=>{
    const targets={...old.targets};delete targets[targetKey(id)];
    return {...old,targets};
  });
  const addNote=(id:string)=>{
    const price=Number(notePrice);
    if(!Number.isSafeInteger(price)||price<=0||!prefs.server.trim())return;
    const key=targetKey(id);
    setPrefs(old=>({...old,notes:{...old.notes,[key]:[...(old.notes[key]||[]),{at:new Date().toISOString(),price}].slice(-60)}}));
    setNotePrice('');
  };

  const items=useMemo(()=>{
    const all=new Map<string,MarketItem>(STARTER_ITEMS.map(item=>[item.id,item]));
    for(const item of marketItems)all.set(item.id,item);
    for(const quote of quotes)if(quote.name){
      const previous=all.get(quote.id);
      all.set(quote.id,{id:quote.id,name:quote.name,category:quote.category||previous?.category||'Other',imageUrl:quote.imageUrl||previous?.imageUrl});
    }else if(quote.imageUrl&&all.has(quote.id)){all.set(quote.id,{...all.get(quote.id)!,imageUrl:quote.imageUrl});}
    return [...all.values()].map(item=>({...item,imageUrl:item.imageUrl||officialIcons[item.id]})).sort((a,b)=>a.name.localeCompare(b.name));
  },[quotes,marketItems,officialIcons]);
  // One indexed selection per server is considerably lighter on mobile than
  // repeatedly scanning every quote for each visible item and leaderboard.
  const serverQuotes=useMemo(()=>quotes.filter(q=>
    q.region.trim().toLowerCase()===prefs.region.trim().toLowerCase() &&
    q.server.trim().toLowerCase()===prefs.server.trim().toLowerCase()
  ),[quotes,prefs.region,prefs.server]);
  const quoteIndex=useMemo(()=>{
    const index=new Map<string,MarketQuote>();
    for(const quote of serverQuotes){
      const previous=index.get(quote.id);
      if(!previous||Date.parse(quote.observedAt)>Date.parse(previous.observedAt))index.set(quote.id,quote);
    }
    return index;
  },[serverQuotes]);
  const currentQuote=(id:string)=>quoteIndex.get(id);
  const noteFor=(id:string)=>latestPrice(prefs.notes[targetKey(id)]||[]);
  const quoteOrNote=(id:string)=>{
    const quote=currentQuote(id),note=noteFor(id);
    if(quote&&(!note||Date.parse(quote.observedAt)>=Date.parse(note.at)))return {price:quote.price,at:quote.observedAt,kind:'Feed',listings:quote.listings};
    if(note)return {price:note.price,at:note.at,kind:'Your note',listings:null};
    return null;
  };
  const rows=items.filter(item=>(tab==='explore'||prefs.watchlist.includes(item.id))&&
    (category==='All'||item.category===category)&&
    (item.name+' '+item.id).toLowerCase().includes(query.trim().toLowerCase()));
  const categories=['All',...new Set(items.map(i=>i.category))];
  const active=items.find(i=>i.id===selected);
  const key=active?targetKey(active.id):'';
  const points=active?[...(currentQuote(active.id)?.history||[]),...(prefs.notes[key]||[])]:[];
  const shownTargets=prefs.watchlist.map(id=>({id,item:items.find(i=>i.id===id),target:prefs.targets[targetKey(id)],price:quoteOrNote(id)})).filter(r=>r.item);
  const triggered=shownTargets.filter(r=>r.target&&r.price&&r.price.price<=r.target).length;
  const openFromPulse=(id:string)=>{
    const item=items.find(x=>x.id===id);
    if(!item)return;
    setTab('explore');
    setSelected(id);
    setQuery(item.name);
    setCategory('All');
    setNotePrice('');
    setTargetValue('');
    window.requestAnimationFrame(()=>document.getElementById('market-browse')?.scrollIntoView({behavior:'smooth',block:'start'}));
  };

  return <main className="market-page inner-page section-wrap">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> BACK TO HOME</button>
    <div className="market-header">
      <div><div className="section-kicker left">ATREIA STREET · PLAYER TOOLS</div>
        <h1>Market <i>Watch</i></h1>
        <p className="page-intro">A simple home for the items you care about. Track prices, save favorites, and set personal buy targets.</p>
      </div>
      <a className="market-external" href={MARKET_SOURCE} target="_blank" rel="noopener noreferrer">VIEW AION2.EXCHANGE <ExternalLink size={15}/></a>
    </div>
    <div className="market-controls">
      <label>Region<select value={prefs.region} onChange={e=>{set({region:e.target.value});setSelected(null);}}>{REGIONS.map(region=><option key={region}>{region}</option>)}</select></label>
      <label>World / server{marketServers.length?
        <select value={prefs.server} onChange={e=>{set({server:e.target.value});setSelected(null);}} aria-label="Choose faction and world">
          <option value="">Select world and faction</option>
          {prefs.server&&!marketServers.some(server=>server.label===prefs.server&&server.region===prefs.region)&&<option value={prefs.server}>Previously saved: {prefs.server}</option>}
          {marketServers.filter(server=>server.region===prefs.region).map(server=><option key={server.id} value={server.label}>{server.label}</option>)}
        </select>:
        <input list="market-known-servers" value={prefs.server} onChange={e=>{set({server:e.target.value});setSelected(null);}} placeholder="Enter your server" maxLength={48}/>}</label>
      <datalist id="market-known-servers">{characterServers.map(s=><option value={s} key={s}/>)}</datalist>
      <div className="market-sync"><span className={'market-dot '+(quotes.length?'online':'')}/>{feedLoading?'Checking prices…':quotes.length?quotes.length+' market quotes · '+(lastRefresh?since(lastRefresh):'feed'):'No live market feed'}</div>
    </div>
    {!prefs.server.trim()&&<div className="market-info" role="status"><Info size={17}/> Enter your world/server to keep prices, history and buy targets separate for each server.</div>}
    {!FEED_URL&&!marketServers.length&&<div className="market-info"><Info size={17}/><span><strong>Automatic market updates are not active.</strong> The scheduled feed requires approval from the source and must be enabled by the site owner. You can still save items, enter prices and open Aion2.exchange for listings.</span></div>}
    {lastRefresh&&Date.now()-Date.parse(lastRefresh)>86400000&&<div className="market-info"><Clock3 size={17}/> The latest market refresh is more than 24 hours old; double-check prices before buying.</div>}
    {feedError&&<div className="market-info" role="status">{feedError}</div>}
    {saveError&&<div className="market-info" role="alert">{saveError}</div>}
    <MarketPulse quotes={serverQuotes} items={items} server={prefs.server} loading={feedLoading} refreshedAt={lastRefresh} onOpen={openFromPulse}/>
    <div id="market-browse" className="market-workspace-heading"><div><span className="section-kicker left">YOUR PERSONAL MARKET</span><h2>Follow what <i>matters.</i></h2><p>Favorites, item discovery and buy targets — all in one place.</p></div></div>
    <div className="market-tabs" role="tablist" aria-label="Market tools">
      {([['watchlist','Watchlist',<Bookmark size={16}/>],['explore','Explore',<Search size={16}/>],['alerts','Targets',<Bell size={16}/>]] as const).map(([value,label,icon])=>
        <button key={value} role="tab" aria-selected={tab===value} className={tab===value?'active':''} onClick={()=>{setTab(value);setSelected(null);setQuery('');setCategory('All');}}>{icon}{label}{value==='watchlist'&&<span>{prefs.watchlist.length}</span>}{value==='alerts'&&triggered>0&&<span className="market-alert-count">{triggered}</span>}</button>)}
    </div>
    {tab==='alerts'?<section className="market-panel">
      <div className="market-panel-heading"><h2>Your buy targets</h2><span>{shownTargets.filter(row=>row.target).length} active</span></div>
      <p className="market-muted">Targets light up when a recorded price is at or below your amount. They are checked only while this page is open; no email, Discord, or background push is sent.</p>
      {!shownTargets.length?<div className="market-empty"><Bell size={28}/><h3>No watched items yet</h3><p>Add an item to your watchlist, then set a target price.</p><button onClick={()=>setTab('explore')}>Explore items <ArrowUpRight size={16}/></button></div>:
        shownTargets.map(row=><div className="market-target-row" key={row.id}><div><strong>{row.item!.name}</strong><small>{row.price?'Latest '+pretty(row.price.price)+' Kina · '+row.price.kind:'No recorded price'}</small></div>
          <form onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('target') as HTMLInputElement;addTarget(row.id,input.value);}}>
            <input name="target" type="number" step="1" min="1" placeholder={row.target?pretty(row.target):'Target Kina'} aria-label={'Target price for '+row.item!.name}/>
            <button type="submit" aria-label={'Save target for '+row.item!.name}>Save</button>
            {row.target&&<button type="button" className="market-quiet" onClick={()=>removeTarget(row.id)} aria-label={'Remove target for '+row.item!.name}><Trash2 size={15}/></button>}
          </form>
          {row.target&&<small className={'market-target-status '+(row.price&&row.price.price<=row.target?'hit':'')}>{row.price&&row.price.price<=row.target?'Target reached':'Target '+pretty(row.target)+' Kina'}</small>}
        </div>)}
    </section>:<>
      <div className="market-filters"><label className="market-search"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==='watchlist'?'Filter saved items…':'Search item name or ID…'}/></label>
        <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter market items by category">{categories.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      {tab==='watchlist'&&!prefs.watchlist.length?<div className="market-empty"><Bookmark size={29}/><h3>Build your watchlist</h3><p>Save items you buy regularly, then check them from your phone without searching again.</p><button onClick={()=>setTab('explore')}>Find items <Plus size={16}/></button></div>:
        <div className="market-items">{rows.length?rows.map(item=>{
          const observed=quoteOrNote(item.id),watching=prefs.watchlist.includes(item.id),target=prefs.targets[targetKey(item.id)],change24=currentQuote(item.id)?.changePct;
          return <article className="market-item" key={item.id}>
            <div className="market-item-icon"><Package size={23}/>{item.imageUrl&&<img src={item.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}</div>
            <div className="market-item-name"><strong>{item.name}</strong><small>{item.category} · #{item.id}</small>
              {target&&observed&&observed.price<=target&&<span className="market-reached">BUY TARGET REACHED</span>}
            </div>
            <div className="market-item-price"><strong>{observed?pretty(observed.price)+' Kina':'—'}</strong><small>{observed?observed.kind+' · '+since(observed.at):'No price recorded'}</small>{typeof change24==='number'&&<small className={change24>=0?'market-up':'market-down'}>{change24>=0?'+':''}{change24.toFixed(1)}% (24h)</small>}</div>
            <div className="market-item-actions"><button onClick={()=>watching?removeWatch(item.id):addWatch(item.id)} title={watching?'Remove from watchlist':'Add to watchlist'} aria-label={(watching?'Remove ':'Watch ')+item.name}>{watching?<BookmarkCheck size={19}/>:<Bookmark size={19}/>}</button>
              <button onClick={()=>{setSelected(selected===item.id?null:item.id);setNotePrice('');setTargetValue('');}} aria-expanded={selected===item.id}>Details <ArrowUpRight size={14}/></button></div>
            {selected===item.id&&<div className="market-detail">
              <div className="market-detail-top"><div><h3>{item.name}</h3><p>{observed?'Latest recorded: '+pretty(observed.price)+' Kina · '+new Date(observed.at).toLocaleString():'No price has been recorded on this server.'}</p></div>
                <a href={MARKET_SOURCE} target="_blank" rel="noopener noreferrer">Check live market <ExternalLink size={14}/></a></div>
              <div className="market-chart-switch"><strong>Price history</strong><div><button className={chartDays===7?'active':''} onClick={()=>setChartDays(7)}>7d</button><button className={chartDays===30?'active':''} onClick={()=>setChartDays(30)}>30d</button></div></div>
              <Chart points={points} days={chartDays}/>
              <div className="market-detail-forms">
                <form onSubmit={e=>{e.preventDefault();addNote(item.id);}}><label>Record an observed asking price (Kina)<input type="number" min="1" step="1" value={notePrice} onChange={e=>setNotePrice(e.target.value)} placeholder="e.g. 150000" disabled={!prefs.server.trim()}/></label><button type="submit" disabled={!prefs.server.trim()||!Number.isSafeInteger(Number(notePrice))||Number(notePrice)<=0}><Plus size={14}/> Save price</button></form>
                <form onSubmit={e=>{e.preventDefault();addTarget(item.id,targetValue);}}><label>Notify me on this page when at or below<input type="number" min="1" step="1" value={targetValue} onChange={e=>setTargetValue(e.target.value)} placeholder={target?'Current target: '+pretty(target):'Target price'} disabled={!prefs.server.trim()}/></label><button type="submit" disabled={!prefs.server.trim()||!Number.isSafeInteger(Number(targetValue))||Number(targetValue)<=0}><Bell size={14}/> Set target</button></form>
              </div>
              <p className="market-footnote"><Clock3 size={13}/> Manual notes are your own observations, not independently verified transactions. Feed prices, if enabled, are lowest observed asking prices.</p>
            </div>}
          </article>;
        }):<div className="market-empty"><Search size={26}/><h3>No matches</h3><p>Try a different search or category. The starter catalog is intentionally small until a data feed is approved.</p></div>}</div>}
      <div className="market-bottom-note"><Info size={15}/><span>{items.length} searchable item references. The catalog can expand automatically with a licensed feed. Prices never default to zero.</span></div>
    </>}
    <div className="market-footer-note"><ChartNoAxesCombined size={19}/><div><strong>{user?'Your watchlist syncs to your Atreia Street account.':'Want your watchlist on multiple devices?'}</strong>
       <p>{user?(saving?'Saving changes…':'Prices and favorites are stored in account preferences, with a browser backup.'):'You can browse and save locally now. Sign in to sync your watchlist and notes to your phone.'}</p></div>{!user&&<button onClick={onLogin}>Sign in <ArrowUpRight size={15}/></button>}</div>
    <p className="market-attribution">Fan-made companion; not affiliated with NCSOFT. AION 2 item names and artwork belong to their respective owners. Market data source, when authorized, will be credited here. Item artwork is linked directly from NCSOFT's official image CDN, not mirrored; missing image references use a fallback icon.</p>
  </main>;
}
