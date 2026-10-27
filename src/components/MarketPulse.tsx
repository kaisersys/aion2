import React,{useMemo,useState} from 'react';
import {ArrowUpRight,ArrowDownRight,BarChart3,Flame,Layers3,Package,TrendingUp,ChevronDown,ChevronUp,Info,Activity} from 'lucide-react';
import {buildMarketOverview,type MarketRanking,type RankKind} from '../lib/marketOverview';
import type {MarketItem,MarketQuote} from '../lib/marketCatalog';
import './marketPulse.css';

const integer=(value:number)=>new Intl.NumberFormat('en-US').format(value);
const compact=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
type Props={
  quotes:MarketQuote[];
  items:MarketItem[];
  server:string;
  loading:boolean;
  refreshedAt:string;
  onOpen:(id:string)=>void;
};
const sections:{key:RankKind;label:string;icon:typeof Flame}[]=[
  {key:'expensive',label:'Top prices',icon:Layers3},
  {key:'volume',label:'Most active',icon:BarChart3},
  {key:'hot',label:'Trending',icon:Flame}
];
function Icon({url}:{url?:string}){
  return <span className="pulse-item-icon"><Package size={17}/>{url&&<img alt="" src={url} loading="lazy" decoding="async"
    referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}}/>}</span>;
}
function Ranking({
  ranking,items,onOpen,expanded
}:{ranking:MarketRanking;items:Map<string,MarketItem>;onOpen:(id:string)=>void;expanded:boolean}){
  return <div className="pulse-rank-body">
    <div className="pulse-rank-description">{ranking.subtitle}</div>
    {ranking.items.length===0?<div className="pulse-empty">No verified data yet for this ranking.</div>:
      <div className="pulse-ranked-list">
        {ranking.items.slice(0,expanded?10:5).map((quote,index)=>{
          const item=items.get(quote.id);
          const title=item?.name||quote.name||'Item '+quote.id;
          const metric=ranking.basis==='sale'
            ?ranking.metric==='Units sold'?integer(quote.unitsSold||0):compact(quote.soldMaxPrice||0)+' Kinah'
            :ranking.basis==='change'
              ?Math.abs(quote.changePct||0).toFixed(1)+'%'
              :ranking.metric==='Listings'
                ?integer(quote.listings||0)
                :compact(quote.price)+' Kinah';
          return <button key={quote.id} type="button" className="pulse-rank-item" onClick={()=>onOpen(quote.id)} title={'Open '+title+' in Market Watch'}>
            <span className="pulse-rank-number">{String(index+1).padStart(2,'0')}</span>
            <Icon url={item?.imageUrl}/>
            <span className="pulse-rank-title"><strong>{title}</strong><small>{ranking.basis==='change'?'Currently '+compact(quote.price)+' Kinah':item?.category||quote.category||'Item'}</small></span>
            <span className={'pulse-rank-value '+(ranking.basis==='change'?(quote.changePct||0)<0?'down':'up':'')}>
              {ranking.basis==='change'&&((quote.changePct||0)<0?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>)}
              {metric}
              {ranking.basis==='change'&&<small>{(quote.changePct||0)<0?'Falling':'Rising'}</small>}
            </span>
          </button>;
        })}
      </div>}
  </div>;
}
export default function MarketPulse({quotes,items,server,loading,refreshedAt,onOpen}:Props){
  const [active,setActive]=useState<RankKind>('expensive');
  const [expanded,setExpanded]=useState(false);
  const overview=useMemo(()=>buildMarketOverview(quotes),[quotes]);
  const catalog=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const hasData=quotes.length>0;
  const fresh=refreshedAt&&Number.isFinite(Date.parse(refreshedAt))
    ?new Date(refreshedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
    :'Awaiting snapshot';
  return <section className="market-pulse" aria-label="Market pulse overview">
    <div className="pulse-heading">
      <div><span className="pulse-eyebrow"><Activity size={14}/> THE MARKET AT A GLANCE</span>
        <h2>Market <i>pulse.</i></h2>
        <p>{server?<>A closer look at <strong>{server}</strong>.</>:<>Choose your world to see what's happening in the market.</>}</p>
      </div>
      <div className="pulse-observed"><span className={hasData?'pulse-signal connected':'pulse-signal'}/><span>{loading?'Updating prices':hasData?'Snapshot loaded':'No live snapshot'}<small>{fresh}</small></span></div>
    </div>
    <div className="pulse-stats">
      <div className="pulse-stat"><div className="pulse-stat-label"><Layers3 size={15}/> Items on market</div><strong>{hasData?integer(overview.listedItems):'—'}</strong><small>Currently priced</small></div>
      <div className="pulse-stat"><div className="pulse-stat-label"><BarChart3 size={15}/> Open listings</div><strong>{hasData?compact(overview.totalListings):'—'}</strong><small>Listed offers, not trades</small></div>
      <div className="pulse-stat"><div className="pulse-stat-label"><TrendingUp size={15}/> 24h movers</div><strong>{hasData?integer(overview.changedItems):'—'}</strong><small>Price change ≥ 0.5%, 3+ listings</small></div>
    </div>
    {hasData?<div className="pulse-board">
      <div className="pulse-board-top">
        <div className="pulse-board-heading"><span className="pulse-eyebrow">SERVER LEADERBOARDS</span><strong>Top ten, at a glance</strong></div>
        <div className="pulse-modes" aria-label="Market leaderboard">
          {sections.map(({key,label,icon:Glyph})=><button key={key} type="button" className={active===key?'active':''} onClick={()=>{setActive(key);setExpanded(false);}} aria-pressed={active===key}><Glyph size={14}/>{label}</button>)}
        </div>
      </div>
      <div className="pulse-rank-grid">
        {sections.map(({key,label,icon:Glyph})=><div className={'pulse-rank-panel '+(active===key?'active':'')} key={key}>
          <div className="pulse-rank-heading"><span className="pulse-rank-glyph"><Glyph size={16}/></span><h3>{overview[key].title}</h3><span className="pulse-rank-metric">{overview[key].metric}</span></div>
          <Ranking ranking={overview[key]} items={catalog} expanded={expanded} onOpen={onOpen}/>
        </div>)}
      </div>
      <button type="button" className="pulse-expand" onClick={()=>setExpanded(value=>!value)}>
        {expanded?'Show top five':'View all top ten'} {expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
      </button>
      <div className="pulse-disclaimer"><Info size={15}/><span>{overview.soldCoverage
        ?'Sale-based rankings use the completed-trade figures the source reports. Remaining lists use current asks or 24-hour movement.'
        :'Completed-sale totals are not reported in this snapshot. Rankings show asking prices, listing counts, and 24-hour moves — not confirmed trades.'} Market data: <a href="https://aion2.exchange/items" target="_blank" rel="noopener noreferrer">Aion2.exchange</a>.</span></div>
    </div>:<div className="pulse-waiting">
      <div className="pulse-waiting-icon"><Activity size={25}/></div>
      <strong>{loading?'Loading your server overview':'Market overview begins with your world'}</strong>
      <span>{loading?'Retrieving current asking prices and listings.':'Select a region and server above; your watchlist and alerts still work without a live feed.'}</span>
    </div>}
  </section>;
}
