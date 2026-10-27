// Small static mapping of NC's official public item IDs to their official PNG filenames.
// The browser references NCSOFT CDN directly; no PNGs are copied into this website.
const CDN='https://assets.playnccdn.com/static-aion2-gamedata/resources/';
type IconIndex={icons?:Record<string,unknown>;refreshed_at?:string};
export async function loadOfficialIcons(signal?:AbortSignal):Promise<Record<string,string>>{
  const response=await fetch('/market-icons/icons.json',{signal,cache:'no-cache',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Icon index unavailable');
  const result=await response.json() as IconIndex;
  if(!result.icons||typeof result.icons!=='object')throw new Error('Invalid icon index');
  const mapped:Record<string,string>={};
  for(const [id,filename] of Object.entries(result.icons)){
    if(!/^\d{5,15}$/.test(id)||typeof filename!=='string'||!/^[-\w]+\.png$/i.test(filename))continue;
    mapped[id]=CDN+filename;
  }
  return mapped;
}
