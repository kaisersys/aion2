// Item ID -> PNG filename index from NCSOFT's own AION 2 item dictionary.
// Reference only: images remain hosted on NCSOFT's official CDN, never mirrored here.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const BASE='https://tw.ncsoft.com/aion2_tw/v2.0';
const CDN='https://assets.playnccdn.com/static-aion2-gamedata/resources/';
const OUT=process.env.ICON_OUTPUT_DIR||'market-icons';
const SMOKE=process.argv.includes('--smoke');
const PAGE_SIZE=50; // The catalog clamps requested page sizes to 50.
const MAX_RESULTS=2400; // The backend ends some broad queries after ~2,500 rows.
const GRADES=['Common','Rare','Unique','Legend','Epic'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchJson(path){
  const url=new URL(BASE+path);
  if(url.origin!=='https://tw.ncsoft.com')throw Error('Unexpected host');
  for(let attempt=0;attempt<3;attempt++){
    try{
      const res=await fetch(url,{headers:{
        'Accept':'application/json','User-Agent':'AtreiaStreet/1.0 (noncommercial fansite; +https://atreiastreet.com)'},
        signal:AbortSignal.timeout(20000)});
      if((res.status===429||res.status>=500)&&attempt<2){
        const retry=Number(res.headers.get('retry-after'))||0;
        await sleep(Math.max(2500*(attempt+1),Math.min(60000,retry*1000)));continue;
      }
      if(!res.ok)throw Error('NCSOFT API HTTP '+res.status);
      if(!(res.headers.get('content-type')||'').includes('json'))throw Error('Catalog response not JSON');
      return res.json();
    }catch(e){if(attempt===2)throw e;await sleep(1500*(attempt+1));}
  }
  throw Error('Exhausted retries');
}
function filenameFor(image){
  if(typeof image!=='string')return null;
  try{
    const url=new URL(image);
    if(!url.href.startsWith(CDN)||url.search||url.hash)return null;
    const basename=decodeURIComponent(url.pathname.split('/').at(-1)||'');
    return /^[A-Za-z0-9_\-]+\.png$/.test(basename)?basename:null;
  }catch{return null;}
}
const icons={};
let pages=0,rows=0;
async function getPage(filters,page){
  const q=new URLSearchParams({locale:'en-US',page:String(page),size:String(PAGE_SIZE),...filters});
  const data=await fetchJson('/dict/search/item?'+q.toString());
  if(!Array.isArray(data.contents)||!data.pagination)throw Error('Dictionary response changed');
  pages++;
  return data;
}
function collect(items){
  for(const item of items){
    rows++;
    const filename=filenameFor(item.image),id=Number(item.id);
    if(Number.isSafeInteger(id)&&id>0&&filename)icons[String(id)]=filename;
  }
}
// Rather than ask for all ~11,000 items in one huge query (the server stops
// after 2,500), divide by NC's published categories and, if needed, by grade.
async function scan(filter,children=null){
  await sleep(430);
  const first=await getPage(filter,1);
  const total=Number(first.pagination.total)||0;
  if(total>MAX_RESULTS&&!SMOKE){
    if(children?.length){
      for(const child of children.filter(c=>/^[A-Za-z0-9_]+$/.test(c.id||''))){
        await scan({...filter,category2:child.id});
      }
      return;
    }
    if(!filter.grades){
      for(const grade of GRADES)await scan({...filter,grades:grade});
      return;
    }
    console.log('NC_ICON_PARTIAL',JSON.stringify({filter,total}));
  }
  collect(first.contents);
  if(SMOKE)return;
  const pageSize=Number(first.pagination.size)||PAGE_SIZE;
  const desired=Math.min(50,Math.ceil(total/pageSize));
  for(let page=2;page<=desired;page++){
    await sleep(430);
    const data=await getPage(filter,page);
    if(!data.contents.length)break;
    collect(data.contents);
  }
  console.log('NC_ICON_PARTITION',JSON.stringify({filter,total,unique:Object.keys(icons).length,pages}));
}
const categories=await fetchJson('/game/item/category?locale=en-US');
if(!Array.isArray(categories)||categories.length<5)throw Error('Missing official categories');
const permitted=categories.filter(c=>/^[A-Za-z0-9_]+$/.test(c.id||''));
for(const cat of permitted){
  await scan({category1:cat.id},Array.isArray(cat.child)?cat.child:null);
  if(SMOKE)break;
}
const covered=Object.keys(icons).length;
if(covered<(SMOKE?5:4000))throw Error('Insufficient icon coverage ('+covered+'); old icon index stays deployed');
await mkdir(OUT,{recursive:true});
const snapshot={source:'NCSOFT official AION 2 item dictionary (Taiwan)',
  cdnhost:'assets.playnccdn.com',refreshed_at:new Date().toISOString(),
  coverage:covered,pages,icons};
await writeFile(join(OUT,'icons.json'),JSON.stringify(snapshot));
console.log('NC_ICON_INDEX_OK',JSON.stringify({entries:covered,pages,rows,smoke:SMOKE}));
