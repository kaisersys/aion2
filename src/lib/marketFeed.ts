import {parseMarketFeed,type MarketItem,type MarketQuote} from './marketCatalog';
export type MarketServer={id:number;name:string;region:string;faction:string;label:string};
export type MarketSnapshot={quotes:MarketQuote[];items:MarketItem[];refreshedAt:string};
const ROOT='/market-data/';
function approvedServer(value:unknown):value is MarketServer {
  if(!value||typeof value!=='object')return false;
  const r=value as Partial<MarketServer>;
  return typeof r.id==='number'&&Number.isInteger(r.id)&&r.id>10000&&r.id<30000&&
    typeof r.name==='string'&&typeof r.region==='string'&&typeof r.faction==='string'&&typeof r.label==='string';
}
async function readJson(url:string,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch(url,{signal,cache:'no-cache',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Market snapshot HTTP '+response.status);
  return response.json();
}
export async function loadMarketServers(signal?:AbortSignal):Promise<MarketServer[]>{
  const response=await readJson(ROOT+'servers.json',signal) as {servers?:unknown[]};
  if(!Array.isArray(response?.servers))throw new Error('Market server list is invalid');
  return response.servers.filter(approvedServer).slice(0,200);
}
export async function loadMarketSnapshot(serverId:number,signal?:AbortSignal):Promise<MarketSnapshot>{
  if(!Number.isInteger(serverId)||serverId<10000||serverId>30000)throw new Error('Invalid market server ID');
  const response=await readJson(ROOT+serverId+'.json',signal) as Record<string,unknown>;
  if(response?.server_id!==serverId||!Array.isArray(response.items))throw new Error('Market snapshot does not match your selected server');
  const parsedItems=response.items as Record<string,unknown>[];
  const catalog:MarketItem[]=parsedItems.slice(0,12000).flatMap((row):MarketItem[]=>{
    const id=String(row.item_id ?? '');
    if(!/^\d{5,15}$/.test(id)||typeof row.name!=='string'||!row.name.trim())return [];
    return [{id,name:row.name.slice(0,120),category:typeof row.category==='string'?row.category:'Other'}];
  });
  const quotes=parseMarketFeed(response);
  const refreshedAt=String(response.refreshed_at||'');
  if(!Number.isFinite(Date.parse(refreshedAt)))throw new Error('Market snapshot is missing a refresh time');
  return {quotes,items:catalog,refreshedAt};
}
