// Small, one-off compatibility check: no credentials, no data downloading or writes.
const origin='https://aion2.exchange';
async function get(path) {
  const response=await fetch(origin+path,{headers:{Accept:'application/json', 'User-Agent':'AtreiaStreet/1.0 (+https://atreiastreet.com)'},
    signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw new Error(path+' responded '+response.status);
  if(!response.headers.get('content-type')?.includes('json'))throw new Error(path+' is not JSON');
  return response.json();
}
try{
  const servers=await get('/api/servers');
  if(!Array.isArray(servers.servers))throw new Error('No servers[]');
  console.log('SERVERS',servers.servers.length, JSON.stringify(servers.servers.slice(0,3)));
  const s=servers.servers.find(x=>x.has_data!==false&&Number(x.server_id)>10000);
  if(!s)throw new Error('No populated server');
  const result=await get('/api/items?server='+s.server_id+'&sort=name&order=asc&window=24h&limit=2&offset=0');
  if(!Array.isArray(result.items))throw new Error('No items[]');
  console.log('ITEMS',result.total,JSON.stringify(result.items.slice(0,2)));
  const item=result.items.find(x=>Number(x.item_key)>0);
  if(item){
    const history=await get('/api/items/'+item.item_key+'/prices?server='+s.server_id+'&from=2026-10-20T00%3A00%3A00Z&bucket=1h');
    console.log('HISTORY',JSON.stringify(history).slice(0,2500));
  }
  console.log('MARKET_PROBE_OK');
}catch(e){console.error('MARKET_PROBE_FAILED',e.message);process.exitCode=1;}
