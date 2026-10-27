import type {MarketQuote} from './marketCatalog';

export type RankKind='expensive'|'volume'|'hot';
export type MarketRanking={title:string;subtitle:string;metric:string;basis:'sale'|'listing'|'change';items:MarketQuote[]};
export type MarketOverview={
  listedItems:number;
  totalListings:number;
  changedItems:number;
  soldCoverage:number;
  expensive:MarketRanking;
  volume:MarketRanking;
  hot:MarketRanking;
};

// Use *reported transactions only* for sales rankings. A listing is not a sale.
function isSalePrice(q:MarketQuote):boolean {
  return typeof q.soldMaxPrice==='number' && Number.isFinite(q.soldMaxPrice) && q.soldMaxPrice>0;
}
function isSaleVolume(q:MarketQuote):boolean {
  return typeof q.unitsSold==='number' && Number.isFinite(q.unitsSold) && q.unitsSold>0;
}
function active(q:MarketQuote):boolean {
  return Number.isFinite(q.price)&&q.price>0&&q.listings!==null&&q.listings>0;
}
function byItem(quotes:MarketQuote[]):MarketQuote[]{
  // Preserve only the newest snapshot per item, never combine different worlds.
  const newest=new Map<string,MarketQuote>();
  for(const q of quotes){
    const old=newest.get(q.id);
    if(!old || Date.parse(q.observedAt)>Date.parse(old.observedAt))newest.set(q.id,q);
  }
  return [...newest.values()];
}
export function buildMarketOverview(raw:MarketQuote[]):MarketOverview{
  const all=byItem(raw);
  const live=all.filter(active);
  const salesPrice=all.filter(isSalePrice);
  const salesVolume=all.filter(isSaleVolume);
  const salesAvailable=salesPrice.length>0;
  const volumeAvailable=salesVolume.length>0;
  const expensePool=salesAvailable?salesPrice:live;
  const volumePool=volumeAvailable?salesVolume:live.filter(q=>q.listings!==null&&q.listings>0);
  const expensive=[...expensePool].sort((a,b)=>(salesAvailable?b.soldMaxPrice!-a.soldMaxPrice!:b.price-a.price)||b.price-a.price).slice(0,10);
  const volume=[...volumePool].sort((a,b)=>(volumeAvailable?b.unitsSold!-a.unitsSold!:(b.listings??0)-(a.listings??0))||b.price-a.price).slice(0,10);
  const movers=live.filter(q=>q.listings!==null&&q.listings>=3 && typeof q.changePct==='number'&&
    Number.isFinite(q.changePct)&&Math.abs(q.changePct)>=0.5 && Math.abs(q.changePct)<=10000);
  const hot=[...movers].sort((a,b)=>
    Math.abs(b.changePct!)*Math.log10(1+(b.listings??0)) -
    Math.abs(a.changePct!)*Math.log10(1+(a.listings??0))
  ).slice(0,10);

  return {
    listedItems:live.length,
    totalListings:live.reduce((sum,q)=>sum+(q.listings??0),0),
    changedItems:movers.length,
    soldCoverage:Math.max(salesPrice.length,salesVolume.length),
    expensive:{
      title:salesAvailable?'Highest sale prices':'Most expensive listings',
      subtitle:salesAvailable?'Highest reported completed sale per item':'Highest current asking price per unit — not completed sales',
      metric:salesAvailable?'Highest sale':'Ask / unit',
      basis:salesAvailable?'sale':'listing',items:expensive
    },
    volume:{
      title:volumeAvailable?'Most sold items':'Most listed items',
      subtitle:volumeAvailable?'Items ranked by reported units sold':'Items with the most active listings — not actual sales',
      metric:volumeAvailable?'Units sold':'Listings',
      basis:volumeAvailable?'sale':'listing',items:volume
    },
    hot:{
      title:'Hot items',
      subtitle:'Largest 24h price movements, weighted by available listings (3+)',
      metric:'24h move',
      basis:'change',items:hot
    }
  };
}
