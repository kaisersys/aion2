// Starter item IDs are reference metadata, not a live market snapshot.
// Prices and icon URLs must come from an authorized feed or a player's own notes.
export type MarketItem = { id: string; name: string; category: string; imageUrl?: string };
export type PricePoint = { at: string; price: number };
export type MarketQuote = {
  id: string; region: string; server: string; price: number; listings: number | null;
  observedAt: string; history: PricePoint[]; imageUrl?: string; name?: string; category?: string
};
export const REGIONS = ['NA East', 'NA West', 'Europe', 'South America', 'Asia'] as const;
export const MARKET_SOURCE = 'https://aion2.exchange/items';
export const STARTER_ITEMS: MarketItem[] = [
  {id:'610610014',name:'Fine Odyle',category:'Materials'},
  {id:'610610015',name:'Pure Odyle',category:'Materials'},
  {id:'610660030',name:'Fine Ruby Gemstone',category:'Materials'},
  {id:'610530001',name:'Refining Stone',category:'Materials'},
  {id:'610530005',name:"Expert's Refining Stone",category:'Materials'},
  {id:'610530008',name:"Artisan's Refining Stone",category:'Materials'},
  {id:'610530010',name:"Artisan's Ultimate Refining Stone",category:'Materials'},
  {id:'610670041',name:'Aria',category:'Gathering'},
  {id:'610740011',name:'Yggdrasil Paper',category:'Materials'},
  {id:'610680047',name:'Inina',category:'Gathering'},
  {id:'610680045',name:'Mela',category:'Gathering'},
  {id:'610531002',name:'Fresh Fruit',category:'Materials'},
  {id:'511360004',name:'Superior Manastone',category:'Consumables'},
  {id:'516530001',name:'Amplify Stone (Unique)',category:'Consumables'},
  {id:'510716010',name:"Artisan's Inina Pasta",category:'Food'},
  {id:'510716008',name:"Artisan's Fruit Salad",category:'Food'},
  {id:'510716012',name:"Artisan's Grilled Cypri",category:'Food'},
  {id:'110460025',name:'Earth Bow',category:'Weapons'},
  {id:'110450013',name:'Vagabond Bow',category:'Weapons'},
  {id:'110150014',name:'Splendent Orichalcum Greatsword',category:'Weapons'},
  {id:'110130013',name:"Artisan's Splendent Orichalcum Greatsword",category:'Weapons'},
  {id:'310230013',name:"Artisan's Splendent Diamond Earrings",category:'Accessories'},
  {id:'310140013',name:"Artisan's Ruby Necklace",category:'Accessories'},
  {id:'310340013',name:"Artisan's Sapphire Ring",category:'Accessories'},
  {id:'210630013',name:"Artisan's Splendent Orichalcum Boots",category:'Armor'},
  {id:'210730013',name:"Artisan's Splendent Orichalcum Cloak",category:'Armor'},
  {id:'210140013',name:"Artisan's Orichalcum Breastplate",category:'Armor'},
  {id:'210540013',name:"Artisan's Orichalcum Gloves",category:'Armor'}
];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function shortText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0,max) : '';
}
function validIcon(value: unknown): string | undefined {
  if(typeof value !== 'string') return;
  try { const url = new URL(value); if(url.protocol === 'https:') return url.toString(); }
  catch { /* no icon */ }
  return;
}
export function parseMarketFeed(input: unknown): MarketQuote[] {
  const root=record(input);
  const rows=Array.isArray(input)?input:root?.items;
  if(!Array.isArray(rows))throw new Error('The market feed must return an array or an object with an items array.');
  const quotes: MarketQuote[]=[];
  for(const row of rows.slice(0,20000)) {
    const r=record(row);if(!r)continue;
    const id=String(r.item_id ?? r.id ?? '');
    const region=shortText(r.region,48),server=shortText(r.server,48);
    const price=Number(r.price);
    const observedAt=shortText(r.observed_at ?? r.observedAt,40);
    if(!/^\d{5,15}$/.test(id)||!region||!server||!Number.isFinite(price)||price<=0||!Number.isFinite(Date.parse(observedAt)))continue;
    const listingsRaw=r.listings;
    const listings=listingsRaw===null || listingsRaw===undefined ? null : Number(listingsRaw);
    const history=(Array.isArray(r.history)?r.history:[]).slice(-720).flatMap((value): PricePoint[]=>{
      const point=record(value);if(!point)return [];
      const at=shortText(point.at ?? point.observed_at,40),price=Number(point.price);
      return Number.isFinite(price)&&price>0&&Number.isFinite(Date.parse(at))?[{at,price}]:[];
    }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    quotes.push({id,region,server,price,listings:Number.isFinite(listings)&&listings!==null&&listings>=0?listings:null,
      observedAt,history,imageUrl:validIcon(r.icon_url ?? r.image_url),name:shortText(r.name,120)||undefined,category:shortText(r.category,60)||undefined});
  }
  return quotes;
}
export function quoteFor(quotes: MarketQuote[], id: string, region: string, server: string):MarketQuote|undefined {
  const key=(v:string)=>v.toLocaleLowerCase().trim();
  return quotes.filter(q=>q.id===id && key(q.region)===key(region) && key(q.server)===key(server))
    .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
}
export function latestPrice(history:PricePoint[]):PricePoint|undefined {
  return [...history].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
}
export function itemSourceLink(_id: string):string { return MARKET_SOURCE; }
// No third-party market scraping is performed client-side. Feed use requires the provider's permission.
