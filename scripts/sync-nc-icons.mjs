// Reference index of *official* NCSOFT item icon filenames.
// It does not download or mirror PNGs. Each image is served by NCSOFT's CDN.
// Intended for a noncommercial fansite; respect any applicable NC fan-content terms.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const BASE='https://tw.ncsoft.com/aion2_tw/v2.0';
const CDN='https://assets.playnccdn.com/static-aion2-gamedata/resources/';
const OUT=process.env.ICON_OUTPUT_DIR || 'market-icons';
const SMOKE=process.argv.includes('--smoke');
const PAGE_SIZE=200;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchJson(path){
  const url=new URL(BASE+path);
  if(url.origin!=='https://tw.ncsoft.com')throw new Error('Invalid catalog host');
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{
        headers:{'Accept':'application/json','User-Agent':'AtreiaStreet/1.0 (noncommercial AION2 fansite; +https://atreiastreet.com)'},
        signal:AbortSignal.timeout(22000)});
      if(response.status===429||response.status>=500){
        if(attempt<2){await pause(3500*(attempt+1));continue;}
      }
      if(!response.ok)throw new Error('NCSOFT dictionary HTTP '+response.status);
      if(!(response.headers.get('content-type')||'').includes('json'))throw new Error('Non-JSON dictionary response');
      return await response.json();
    }catch(error){
      if(attempt===2)throw error;
      await pause(2500*(attempt+1));
    }
  }
  throw new Error('NCSOFT requests exhausted');
}
function validFilename(value){
  if(typeof value!=='string')return null;
  try{
    const url=new URL(value);
    if(!url.href.startsWith(CDN)||url.search||url.hash)return null;
    const name=decodeURIComponent(url.pathname.split('/').at(-1)||'');
    return /^[a-zA-Z0-9_\-]+\.png$/i.test(name)?name:null;
  }catch{return null;}
}
const icons={};
const limit=SMOKE?1:240;
let pages=0,received=0;
for(let page=1;page<=limit;page++){
  const q=new URLSearchParams({locale:'en-US',page:String(page),size:String(PAGE_SIZE)});
  const body=await fetchJson('/dict/search/item?'+q.toString());
  if(!Array.isArray(body.contents)||!body.pagination)throw new Error('Dictionary shape changed');
  pages++;
  for(const item of body.contents){
    const id=Number(item.id),filename=validFilename(item.image);
    if(Number.isSafeInteger(id)&&id>0&&filename){icons[String(id)]=filename;received++;}
  }
  if(page===1)console.log('NC_DICTIONARY_INFO',JSON.stringify({total:body.pagination.total,
    lastPage:body.pagination.lastPage,limit:body.pagination.limit,size:body.pagination.size}));
  if(page%12===0)console.log('NC_ICON_PROGRESS',page,Object.keys(icons).length);
  if(body.contents.length===0||page>=Number(body.pagination.lastPage))break;
  if(!SMOKE)await pause(650);
}
if(Object.keys(icons).length<(SMOKE?3:500))throw new Error('Too few icon mappings; refusing to replace existing index');
await mkdir(OUT,{recursive:true});
const metadata={source:'NCSOFT official AION 2 Taiwan item dictionary',cdnhost:'assets.playnccdn.com',
  refreshed_at:new Date().toISOString(),coverage:Object.keys(icons).length,pages,icons};
await writeFile(join(OUT,'icons.json'),JSON.stringify(metadata));
console.log('NC_ICON_INDEX_OK',JSON.stringify({pages,entries:Object.keys(icons).length,validEntries:received,smoke:SMOKE}));
