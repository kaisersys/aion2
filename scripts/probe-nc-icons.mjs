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
