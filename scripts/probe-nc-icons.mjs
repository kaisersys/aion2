// One-page read-only compatibility check of NCSOFT's TW public item dictionary.
const url='https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?locale=en-US&page=1&size=5';
try {
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'AtreiaStreet-FanReference/1.0 (+https://atreiastreet.com)'},signal:AbortSignal.timeout(20000)});
  console.log('NC_DICTIONARY_STATUS',response.status,'content-type',response.headers.get('content-type'));
  if(!response.ok)throw new Error('Dictionary returned '+response.status);
  const body=await response.json();
  console.log('NC_DICTIONARY_KEYS',Object.keys(body));
  const items=body.contents??body.items??body.data?.contents??[];
  console.log('NC_DICTIONARY_EXAMPLE',JSON.stringify(items.slice(0,3)).slice(0,4600));
  console.log('NC_DICTIONARY_PAGE',JSON.stringify(body.pagination??body.page??null));
  if(!Array.isArray(items)||!items.length)throw new Error('Missing items');
  console.log('NC_DICTIONARY_OK');
}catch(e){console.error('NC_DICTIONARY_FAILED',e.message);process.exitCode=1;}

// Check category partitions; some official dictionary backends stop at ~2,500 rows.
const base='https://tw.ncsoft.com/aion2_tw/v2.0';
const baseOpts={headers:{Accept:'application/json','User-Agent':'AtreiaStreet-FanReference/1.0'},signal:AbortSignal.timeout(20000)};
try {
  const cats=await (await fetch(base+'/game/item/category?locale=en-US',baseOpts)).json();
  console.log('NC_CATEGORY_RESPONSE',JSON.stringify(cats).slice(0,8000));
  for(const grade of ['Common','Rare','Unique','Epic']){
    const query=new URLSearchParams({page:'1',size:'50',locale:'en-US',grades:grade});
    const res=await fetch(base+'/dict/search/item?'+query,baseOpts);
    const data=await res.json();
    console.log('NC_GRADE_RESPONSE',grade,res.status,JSON.stringify({
      pagination:data.pagination,
      entries:data.contents?.length,
      firstId:data.contents?.[0]?.id,
      lastId:data.contents?.at(-1)?.id
    }));
  }
} catch(e){ console.log('NC_CATEGORY_DIAGNOSTIC',e.message); }
