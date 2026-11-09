import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import './privateMarketActivity.css';

type MarketRow={
 kind:string;item_name:string;quantity:number;unit_price:number|null;
 gross:number|null;listing_fee:number|null;proceeds:number|null;occurred_at:string;
};
const LABELS:Record<string,string>={
 listing_preview:'Listing details seen',
 listing_confirmed_screen:'Listing confirmation seen',
 settlement_visible:'Settlement details seen',
 settlement_claimed_screen:'Claim confirmation seen',
 purchase_preview:'Purchase details seen'
};
const number=(n:number|null)=>n==null?'—':new Intl.NumberFormat('en-US').format(n);
export default function PrivateMarketActivity({userId,characterId}:{
 userId:string;characterId:string;
}){
 const [rows,setRows]=useState<MarketRow[]>([]);
 const [status,setStatus]=useState('Loading your private Market observations…');
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   if(!supabase)return;
   const {data,error}=await supabase.from('player_market_observations')
    .select('kind,item_name,quantity,unit_price,gross,listing_fee,proceeds,occurred_at')
    .eq('user_id',userId).eq('character_id',characterId)
    .order('occurred_at',{ascending:false}).limit(40);
   if(!active)return;
   if(error){
    setStatus(/PGRST205|42P01|does not exist|schema cache/i.test(error.message||'')
     ?'Private Market tracking requires its Supabase database migration.'
     :'Market observations could not be loaded.');
    return;
   }
   setRows((data||[]) as MarketRow[]);
   setStatus(data?.length?'':'No Market records synced for this character yet. Sign in to the Windows companion to enable automatic tracking.');
  };
  void load();
  const interval=window.setInterval(()=>{void load();},60000);
  return ()=>{active=false;window.clearInterval(interval);};
 },[userId,characterId]);
 return <section className="player-panel player-market-activity">
  <div className="section-kicker left">PRIVATE · MARKET INTELLIGENCE</div>
  <h2>Market observations</h2>
  <p className="player-panel-description">Automatically synced from the Windows companion when signed in. Screen-observed details are not verified completed sales, wallet debits or gross earnings. Only you can see these records.</p>
  {status&&<p className="player-note" role="status">{status}</p>}
  {rows.length>0&&<div className="private-market-rows">
   {rows.map((r,i)=><article key={r.kind+r.item_name+r.occurred_at+i} className="private-market-row">
    <div>
     <strong>{r.item_name} ×{number(r.quantity)}</strong>
     <small>{LABELS[r.kind]||'Market detail seen'} · {new Date(r.occurred_at).toLocaleString()}</small>
    </div>
    <div className="private-market-figures">
     {r.listing_fee!=null&&<span>Listing fee shown: {number(r.listing_fee)} Kina</span>}
     {r.unit_price!=null&&<span>Unit price: {number(r.unit_price)} Kina</span>}
     {r.gross!=null&&<span>Listed total: {number(r.gross)} Kina</span>}
     {r.proceeds!=null&&<span>Settlement amount shown: {number(r.proceeds)} Kina</span>}
     <small>OCR screen observation · not wallet verified</small>
    </div>
   </article>)}
  </div>}
 </section>;
}
