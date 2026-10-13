import { supabase } from './supabase';

/**
 * Reuses the existing admin-protected guides JSONB storage, so no manual
 * Supabase migration or extra credential is needed. This reserved published
 * row is never returned by the guide library or opened as an article.
 */
export const SITE_CONTENT_SLUG = 'site-content-settings';
export const SITE_CONTENT_CATEGORY = 'Site Settings';

export const DEFAULT_SITE_CONTENT = {
  brandTitle: 'ATREIA',
  brandAccent: 'STREET',
  brandSubtitle: 'INDEPENDENT GUILD CODEX',
  navigationHome: 'HOME',
  navigationFinder: 'GUIDE FINDER',
  navigationDiscover: 'DISCOVER',
  navigationClasses: 'CLASSES',
  navigationChallenges: 'CHALLENGES',
  navigationAllGuides: 'ALL GUIDES',
  navigationAdmin: 'ADMIN',
  heroEyebrow: 'A SANCTUARY OF KNOWLEDGE',
  heroTitle: 'THE PATH OF',
  heroAccent: 'THE DAEVA',
  heroDescription: 'Knowledge is our greatest weapon. Explore battle-tested guides, discoveries, and wisdom from your fellow guild members.',
  heroButton: 'EXPLORE THE CODEX',
  heroFinderTitle: 'FIND YOUR GUIDE',
  heroSearchPlaceholder: 'Search builds, classes, dungeons...',
  heroSearchButton: 'SEARCH',
  heroTopicTitle: 'BROWSE BY TOPIC',
  heroScrollLeft: 'SCROLL TO DISCOVER',
  heroScrollRight: 'THE GUILD ARCHIVES',
  topicClasses: 'CLASSES',
  topicGear: 'GEAR',
  topicDungeons: 'DUNGEONS',
  topicAbyss: 'ABYSS',
  topicCrafting: 'CRAFTING',
  topicAll: 'ALL GUIDES',
  profileEyebrow: 'FROM THE CREATOR',
  profileTitle: 'A little',
  profileAccent: 'about me',
  profileName: 'The curator',
  profileRole: 'CREATOR OF ATREIA STREET',
  profileBio: "I started Atreia Street as a place for clear AION 2 guides, practical discoveries, and shared knowledge. This space is where I'll tell you a little more about myself and the journey behind the codex.",
  profilePhotoUrl: '',
  profileBackdropUrl: '',
  journeyEyebrow: 'YOUR ADVENTURE STARTS HERE',
  journeyTitle: 'Every path has',
  journeyAccent: 'a beginning',
  journeyDescription: 'A simple route through the essentials, whether you have just arrived in Atreia or are preparing for your next challenge.',
  journeyStepOneLabel: 'GET ORIENTED',
  journeyStepOneTitle: 'Learn the essentials',
  journeyStepOneDescription: 'Get comfortable with your class, the world, and the systems that matter first.',
  journeyStepTwoLabel: 'GROW STRONGER',
  journeyStepTwoTitle: 'Shape your progression',
  journeyStepTwoDescription: 'Find your next equipment goals and make deliberate use of your resources.',
  journeyStepThreeLabel: 'TAKE THE FIELD',
  journeyStepThreeTitle: 'Prepare for challenges',
  journeyStepThreeDescription: 'Step into dungeons with the mechanics, roles, and preparation in mind.',
  journeyCardButton: 'EXPLORE GUIDES',
  newsEyebrow: 'THE NEXT CHAPTER',
  newsTitle: 'Upcoming',
  newsAccent: 'AION 2 News',
  newsDescription: 'Confirmed global events, maintenance milestones, and important dates, with links to official announcements.',
  newsSourceLabel: 'OFFICIAL ANNOUNCEMENT',
  newsEmpty: 'No upcoming announcements are listed right now. Check the official AION 2 news page for the latest updates.',
  newsItemsJson: "[{\"id\":\"ea-transfers\",\"date\":\"2026-10-13\",\"through\":\"2026-10-20\",\"category\":\"SERVER TRANSFERS\",\"title\":\"Early Access server transfers\",\"summary\":\"Eligible Early Access characters can transfer after October 13 maintenance. This window closes before October 20 maintenance.\",\"sourceUrl\":\"https://lounge.plaync.com/feed/83614?country=US&locale=en-US\"},{\"id\":\"launch-transfers\",\"date\":\"2026-10-20\",\"through\":\"2026-10-27\",\"category\":\"SERVER TRANSFERS\",\"title\":\"Launch server transfers\",\"summary\":\"The separate launch-server transfer window begins after October 20 maintenance and ends before October 27 maintenance.\",\"sourceUrl\":\"https://lounge.plaync.com/feed/83614?country=US&locale=en-US\"},{\"id\":\"attendance-end\",\"date\":\"2026-12-15\",\"through\":\"2026-12-15\",\"category\":\"EVENT DEADLINE\",\"title\":\"Launch attendance rewards conclude\",\"summary\":\"The global launch attendance events run through December 15. Claim your available check-in rewards while the event is active.\",\"sourceUrl\":\"https://lounge.plaync.com/feed/83066?country=US&locale=en-US\"}]",
  introEyebrow: 'THE GUILD ARCHIVES',
  introTitle: 'Discover Your',
  introAccent: 'Destiny',
  introDescription: 'From your first steps in Atreia to the fiercest battles, every journey begins with knowledge.',
  categoryClassesTitle: 'CLASS GUIDES',
  categoryClassesDescription: 'Master your calling',
  categoryGearTitle: 'GEAR & PROGRESSION',
  categoryGearDescription: 'Forge your strength',
  categoryDungeonsTitle: 'DUNGEONS & RAIDS',
  categoryDungeonsDescription: 'Face the unknown',
  categoryAbyssTitle: 'THE ABYSS',
  categoryAbyssDescription: 'Conquer the skies',
  featuredEyebrow: 'CURATED BY THE GUILD',
  featuredTitle: 'Featured',
  featuredAccent: 'Guides',
  featuredButton: 'VIEW ALL GUIDES',
  latestEyebrow: 'FRESH FROM THE ARCHIVES',
  latestTitle: 'Recently',
  latestAccent: 'Updated',
  latestDescription: 'New field notes and recently revised guides, straight from the archive.',
  latestButton: 'BROWSE ALL GUIDES',
  latestEmpty: 'New and updated guides will appear here as soon as they are published.',
  missionEyebrow: 'ABOUT ATREIA STREET',
  missionTitle: 'Knowledge for',
  missionAccent: 'the journey',
  missionDescription: 'An independent AION 2 codex for finding practical answers without the noise. Read what you need, return when you need it, and help the archive grow.',
  missionOneTitle: 'Clear, useful guides',
  missionOneDescription: 'Practical pages designed to help you make your next decision.',
  missionTwoTitle: 'A place for every playstyle',
  missionTwoDescription: 'Explore classes, progression, dungeons, the Abyss, and professions.',
  missionThreeTitle: 'A growing archive',
  missionThreeDescription: 'New discoveries and community knowledge can become part of the codex.',
  missionButton: 'EXPLORE THE ARCHIVES',
  joinEyebrow: 'THE JOURNEY IS BETTER TOGETHER',
  joinTitle: 'United by',
  joinAccent: 'Purpose',
  joinDescription: 'Built for our guild. Written by our adventurers. Shared with everyone.',
  joinButton: 'ENTER THE ARCHIVES',
  libraryEyebrow: 'THE KNOWLEDGE ARCHIVE',
  libraryTitle: 'Guild',
  libraryAccent: 'Guides',
  libraryDescription: 'Explore field manuals, class builds, progression paths, and guild strategies.',
  librarySearchPlaceholder: 'Search guides...',
  footerBrand: 'AION II',
  footerTag: 'GUILD CODEX',
  footerDescription: 'An independent fan-made community guide project. Not affiliated with or endorsed by NCSOFT.',
  footerClosing: 'FORGED IN KNOWLEDGE · UNITED IN PURPOSE'
} as const;

export type SiteContent = { -readonly [K in keyof typeof DEFAULT_SITE_CONTENT]: string };
export type SiteContentKey = keyof SiteContent;

export const SITE_CONTENT_GROUPS: { title: string; keys: SiteContentKey[] }[] = [
  {title:'Homepage · Hero', keys:['heroEyebrow','heroTitle','heroAccent','heroDescription','heroButton','heroFinderTitle','heroSearchPlaceholder','heroSearchButton','heroTopicTitle','heroScrollLeft','heroScrollRight']},
  {title:'Homepage · Guide topics', keys:['topicClasses','topicGear','topicDungeons','topicAbyss','topicCrafting','topicAll']},
  {title:'Homepage · About me', keys:['profileEyebrow','profileTitle','profileAccent','profileName','profileRole','profileBio','profileBackdropUrl','profilePhotoUrl']},
  {title:'Homepage · Start here', keys:['journeyEyebrow','journeyTitle','journeyAccent','journeyDescription','journeyStepOneLabel','journeyStepOneTitle','journeyStepOneDescription','journeyStepTwoLabel','journeyStepTwoTitle','journeyStepTwoDescription','journeyStepThreeLabel','journeyStepThreeTitle','journeyStepThreeDescription','journeyCardButton']},
  {title:'Homepage · Upcoming news', keys:['newsEyebrow','newsTitle','newsAccent','newsDescription','newsSourceLabel','newsEmpty','newsItemsJson']},
  {title:'Homepage · Featured & banner', keys:['featuredEyebrow','featuredTitle','featuredAccent','featuredButton','joinEyebrow','joinTitle','joinAccent','joinDescription','joinButton']},
  {title:'Homepage · Recently updated', keys:['latestEyebrow','latestTitle','latestAccent','latestDescription','latestButton','latestEmpty']},
  {title:'Homepage · About the codex', keys:['missionEyebrow','missionTitle','missionAccent','missionDescription','missionOneTitle','missionOneDescription','missionTwoTitle','missionTwoDescription','missionThreeTitle','missionThreeDescription','missionButton']},
  {title:'Navigation & branding', keys:['brandTitle','brandAccent','brandSubtitle','navigationHome','navigationFinder','navigationDiscover','navigationClasses','navigationChallenges','navigationAllGuides','navigationAdmin']},
  {title:'Guide library', keys:['libraryEyebrow','libraryTitle','libraryAccent','libraryDescription','librarySearchPlaceholder']},
  {title:'Footer', keys:['footerBrand','footerTag','footerDescription','footerClosing']}
];

export type SiteRevision = { at: string; values: SiteContent };
export type SiteSnapshot = {
  values: SiteContent;
  revisions: SiteRevision[];
  rowId: string | null;
  updatedAt: string | null;
};

const keys = Object.keys(DEFAULT_SITE_CONTENT) as SiteContentKey[];
export const siteContentLimit = (key: SiteContentKey): number =>
  key === 'newsItemsJson' ? 10000 : (key === 'profilePhotoUrl' || key === 'profileBackdropUrl') ? 1024 : key === 'profileBio' ? 1600 :
  key.toLowerCase().includes('description') || key === 'latestEmpty' ? 400 : 120;

/** The portrait is optional and must come from our admin-managed public image bucket. */
export const validProfilePhotoUrl = (value:string):boolean => {
  if(!value)return true;
  try{
    const url=new URL(value);
    return url.protocol==='https:' && url.pathname.includes('/storage/v1/object/public/guide-images/') && !url.username && !url.password;
  }catch{return false;}
};

/** Editor-curated announcement calendar, stored with website text under existing admin RLS. */
export type UpcomingNewsItem = {id:string;date:string;through:string;category:string;title:string;summary:string;sourceUrl:string};
export const NEWS_LIMIT=8;
const isCalendarDate=(value:string):boolean=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===value;
};
const safeNewsUrl=(value:string):boolean=>{
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
};
export const validNewsItems=(value:string):boolean=>{
  try{
    const rows:unknown=JSON.parse(value);
    return Array.isArray(rows)&&rows.length<=NEWS_LIMIT&&rows.every((entry:unknown)=>{
      if(!entry||typeof entry!=='object'||Array.isArray(entry))return false;
      const item=entry as Record<string,unknown>;
      return typeof item.id==='string'&&item.id.length>0&&item.id.length<=90&&
        typeof item.date==='string'&&isCalendarDate(item.date)&&
        typeof item.through==='string'&&isCalendarDate(item.through)&&item.through>=item.date&&
        typeof item.category==='string'&&item.category.trim().length>0&&item.category.length<=55&&
        typeof item.title==='string'&&item.title.trim().length>0&&item.title.length<=130&&
        typeof item.summary==='string'&&item.summary.trim().length>0&&item.summary.length<=380&&
        typeof item.sourceUrl==='string'&&item.sourceUrl.length<=600&&safeNewsUrl(item.sourceUrl);
    })&&new Set(rows.map((row:UpcomingNewsItem)=>row.id)).size===rows.length;
  }catch{return false;}
};
/** Parse incomplete editor drafts too. Only fully validated entries reach published site settings. */
export const parseNewsItems=(value:string):UpcomingNewsItem[]=>{
  try{
    const rows:unknown=JSON.parse(value);
    if(!Array.isArray(rows))return [];
    return rows.slice(0,NEWS_LIMIT).filter((item:unknown)=>{
      if(!item||typeof item!=='object'||Array.isArray(item))return false;
      const row=item as Record<string,unknown>;
      return ['id','date','through','category','title','summary','sourceUrl'].every(key=>typeof row[key]==='string');
    }) as UpcomingNewsItem[];
  }catch{return [];}
};
/** Compare event dates using the region of official Pacific-time announcements. */
export const activeNewsItems=(items:UpcomingNewsItem[],now:Date=new Date()):UpcomingNewsItem[]=>{
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return items.filter(item=>item.through>=today).sort((a,b)=>a.date.localeCompare(b.date));
};

export function normalizeSiteContent(raw: unknown): SiteContent {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const result = {...DEFAULT_SITE_CONTENT} as SiteContent;
  for(const key of keys) {
    const value = source[key];
    if(key==='newsItemsJson'){
      if(typeof value==='string'&&value.length<=siteContentLimit(key)&&validNewsItems(value))result[key]=value;
      continue;
    }
    if(typeof value === 'string' && (value.trim() || key==='profilePhotoUrl' || key==='profileBackdropUrl') && value.length <= siteContentLimit(key) && ((key!=='profilePhotoUrl' && key!=='profileBackdropUrl')||validProfilePhotoUrl(value))) result[key] = value;
  }
  return result;
}

const parseRevisions=(raw:unknown):SiteRevision[] => {
  if(!Array.isArray(raw))return [];
  return raw.slice(0,12).flatMap(item=>{
    if(!item || typeof item !== 'object') return [];
    const candidate=item as {at?:unknown;values?:unknown};
    return typeof candidate.at === 'string' && typeof candidate.values === 'object'
      ? [{at:candidate.at,values:normalizeSiteContent(candidate.values)}] : [];
  });
};

export async function getSiteSnapshot(): Promise<SiteSnapshot> {
  const fallback:SiteSnapshot = {values:normalizeSiteContent({}),revisions:[],rowId:null,updatedAt:null};
  if(!supabase)return fallback;
  const {data,error}=await supabase.from('guides')
    .select('id,updated_at,content')
    .eq('slug',SITE_CONTENT_SLUG).eq('status','published').maybeSingle();
  if(error)throw error;
  if(!data)return fallback;
  const content=(data.content && typeof data.content==='object')?data.content as Record<string,unknown>:{};
  return {
    values:normalizeSiteContent(content.siteSettings),
    revisions:parseRevisions(content.siteRevisions),
    rowId:data.id as string,
    updatedAt:data.updated_at as string
  };
}

export async function getSiteContent(): Promise<SiteContent> {
  return (await getSiteSnapshot()).values;
}

/** Admin-only write: existing RLS enforces admin membership and auth.uid(). */
export async function saveSiteContent(values:SiteContent,old:SiteSnapshot,userId:string):Promise<SiteSnapshot>{
  if(!supabase)throw new Error('Supabase is not configured.');
  if(!userId)throw new Error('Sign in as a staff member before saving.');
  for(const key of keys){
    if(key==='newsItemsJson'&&!validNewsItems(values[key]))throw new Error('Review the upcoming news dates and official source links before publishing.');
    if(!values[key].trim() && key!=='profilePhotoUrl' && key!=='profileBackdropUrl')throw new Error('Every site text field must contain some text.');
    if(values[key].length > siteContentLimit(key))throw new Error('Text is too long: '+key);
    if((key==='profilePhotoUrl'||key==='profileBackdropUrl') && !validProfilePhotoUrl(values[key]))throw new Error('Profile images must be uploaded through Site Content.');
  }
  const cleaned=normalizeSiteContent(values);
  const history=[{at:new Date().toISOString(),values:old.values},...old.revisions].slice(0,12);
  const content={
    type:'doc', content:[{type:'paragraph'}],
    siteSettings:cleaned, siteRevisions:history, siteVersion:1
  };
  if(old.rowId && old.updatedAt){
    const {data,error}=await supabase.from('guides').update({content})
      .eq('id',old.rowId).eq('slug',SITE_CONTENT_SLUG)
      .eq('updated_at',old.updatedAt).select('id').maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Site text changed in another session. Reload before saving so you do not overwrite it.');
  } else {
    const {error}=await supabase.from('guides').insert({
      slug:SITE_CONTENT_SLUG,title:'Atreia Street Site Settings',
      summary:'Reserved record for website copy, not a public guide.',
      category:SITE_CONTENT_CATEGORY,featured:false,
      status:'published',published_at:new Date().toISOString(),
      author_id:userId,content
    });
    if(error)throw error;
  }
  return getSiteSnapshot();
}
