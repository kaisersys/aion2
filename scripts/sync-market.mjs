/**
 * Atreia Street — conservatively paced, unauthenticated public market read.
 * Low frequency, serial requests, attribution preserved. Provider terms and
 * authorization must be reviewed before enabling automated production sync.
 *
 * Output: market-data/servers.json and market-data/{server_id}.json
 * Dry-run (--smoke) only checks one board and writes to a temporary folder.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const SITE='https://aion2.exchange';
const OUT=process.env.MARKET_OUTPUT_DIR||'market-data';
const SMOKE=process.argv.includes('--smoke');
const LIMIT=SMOKE?1:200;
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const regionNames={NAE:'NA East',NAW:'NA West',EU:'Europe',LA:'South America',AS:'Asia'};
const dateOk=iso=>typeof iso==='string' && Number.isFinite(Date.parse(iso));
const positive=p=>Number.isFinite(p)&&p>0&&p<1e13;
const labelFor=s=>s.name+' ('+s.faction+')';
async function get(path){
  const url=new URL(path,SITE);
  if(url.origin!==SITE)throw new Error('Unexpected host');
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{
        headers:{'Accept':'application/json','User-Agent':'AtreiaStreet-MarketWatch/1.0 (+https://atreiastreet.com)'},
        signal:AbortSignal.timeout(25000)
      });
      if(response.status===429||response.status>=500){
        const retry=Number(response.headers.get('retry-after'));
        const wait=Number.isFinite(retry)&&retry>0?Math.min(retry*1000,60000):5000*(attempt+1);
        if(attempt===2)throw new Error('Market provider unavailable: HTTP '+response.status);
        await sleep(wait);continue;
      }
      if(!response.ok)throw new Error('HTTP '+response.status+' for '+url.pathname);
      if(!(response.headers.get('content-type')||'').includes('json'))throw new Error('Not a JSON response');
      return await response.json();
    }catch(err){
      if(attempt===2)throw err;
      await sleep(2500*(attempt+1));
    }
  }
  throw new Error('Network attempts exhausted');
}

const serverData=await get('/api/servers');
if(!Array.isArray(serverData.servers))throw new Error('Server catalog response missing servers');
const servers=serverData.servers.filter(s=>s.has_data!==false&&Number.isInteger(s.server_id)&&
  s.server_id>10000&&typeof s.name==='string'&&typeof s.faction==='string'&&regionNames[s.region])
 .map(s=>({id:s.server_id,name:s.name.slice(0,60),region:regionNames[s.region],
   faction:s.faction.slice(0,40),label:labelFor(s).slice(0,100)})).sort((a,b)=>a.region.localeCompare(b.region)||a.name.localeCompare(b.name)||a.faction.localeCompare(b.faction));
if(servers.length<1)throw new Error('No populated world was returned');
await mkdir(OUT,{recursive:true});
const when=new Date().toISOString();
let counts=0;
const chosen=SMOKE?servers.slice(0,1):servers.slice(0,LIMIT);
const successful=[],failed=[];
let consecutiveFailures=0;
for(let n=0;n<chosen.length;n++){
  // Leave time for FTPS uploads before the 18-minute Actions job deadline.
  if(!SMOKE && Date.now()-Date.parse(when)>=11*60*1000){
    for(const remaining of chosen.slice(n))failed.push(remaining.id);
    console.warn('::warning title=Market refresh time budget::Stopping fetches after 11 minutes; publishing completed server snapshots.');
    break;
  }
  const s=chosen[n],items=[];
  try{
    // Never write a partial board: a failed page must preserve the last published snapshot.
    for(let offset=0;offset<5000;offset+=1000){
      const u='/api/items?server='+s.id+'&sort=name&order=asc&window=24h&limit=1000&offset='+offset;
      const response=await get(u);
      if(!Array.isArray(response.items))throw new Error('Missing items[] for '+s.id);
      for(const r of response.items){
        if(!Number.isInteger(r.item_key)||r.item_key<=0)continue;
        if(typeof r.name!=='string'||r.name.length>120)continue;
        const price=Number(r.price);
        const active=positive(price)&&Number(r.listings)>0;
        const observedAt=dateOk(r.captured_at)?r.captured_at:when;
        const change=Number(r.change_pct);
        items.push({
          item_id:String(r.item_key),name:r.name,category:String(r.category?.section_name||'Other').slice(0,48),
          region:s.region,server:s.label,price:active?price:null,
          listings:Number.isInteger(r.listings)&&r.listings>=0?r.listings:0,
          observed_at:observedAt,listed:active,
          change_pct:Number.isFinite(change)&&r.change_pct!==null?Number(change.toFixed(2)):null,
          last_price:positive(Number(r.last_price))?Number(r.last_price):null,
          // Null means unavailable. Never infer completed sales from listing counts.
          units_sold:Number.isSafeInteger(r.units_sold)&&r.units_sold>0?r.units_sold:null,
          sold_max_price:positive(r.sold_max_price)?r.sold_max_price:null
        });
      }
      if(items.length>10000)throw new Error('Unexpectedly large board');
      if(offset+1000>=Number(response.total||0)||response.items.length===0)break;
      await sleep(220);
    }
    if(items.length<5)throw new Error('Unexpectedly empty board for '+s.id);
    // Only complete, validated snapshots are eligible for upload.
    await writeFile(join(OUT,s.id+'.json'),JSON.stringify({server_id:s.id,server:s.label,region:s.region,source:SITE,
      refreshed_at:when,items}));
    successful.push(s.id);
    counts+=items.length;
    consecutiveFailures=0;
  }catch(err){
    failed.push(s.id);
    consecutiveFailures++;
    const reason=String(err?.message||err).replace(/[\r\n]/g,' ').slice(0,220);
    console.warn('::warning title=Market snapshot skipped::Server '+s.id+' ('+s.name+') kept its last published data: '+reason);
    // Repeated failures suggest an upstream outage; avoid hammering the provider.
    if(consecutiveFailures>=5){
      for(const remaining of chosen.slice(n+1))failed.push(remaining.id);
      console.warn('::warning title=Market provider outage::Stopping early after five consecutive server errors; existing snapshots remain untouched.');
      break;
    }
  }
  if((n+1)%12===1||n===chosen.length-1)console.log('Processed '+(n+1)+'/'+chosen.length+' worlds; updated '+successful.length+', unavailable '+failed.length);
  if(!SMOKE)await sleep(400);
}
if(!successful.length)throw new Error('Market provider unavailable: no complete world snapshots to publish');
await writeFile(join(OUT,'servers.json'),JSON.stringify({source:SITE,refreshed_at:when,
  servers:chosen,successful_server_ids:successful,failed_server_ids:failed,partial:failed.length>0,
  description:'Aion2.exchange lowest recorded asking price per unit; not a completed sale. Missing/unlisted prices are null.'}));
const result={worlds:chosen.length,updated:successful.length,skipped:failed.length,items:counts,at:when,smoke:SMOKE};
console.log(failed.length?'MARKET_SYNC_PARTIAL':'MARKET_SYNC_OK',JSON.stringify(result));
if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFile}=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    '### Market refresh\nUpdated: '+successful.length+'/'+chosen.length+
    ' servers; skipped: '+failed.length+'. Existing snapshots were preserved for skipped servers.\n\n');
}
