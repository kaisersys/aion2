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
  {title:'Homepage · Start here', keys:['journeyEyebrow','journeyTitle','journeyAccent','journeyDescription','journeyStepOneLabel','journeyStepOneTitle','journeyStepOneDescription','journeyStepTwoLabel','journeyStepTwoTitle','journeyStepTwoDescription','journeyStepThreeLabel','journeyStepThreeTitle','journeyStepThreeDescription','journeyCardButton']},
  {title:'Homepage · Categories', keys:['introEyebrow','introTitle','introAccent','introDescription','categoryClassesTitle','categoryClassesDescription','categoryGearTitle','categoryGearDescription','categoryDungeonsTitle','categoryDungeonsDescription','categoryAbyssTitle','categoryAbyssDescription']},
  {title:'Homepage · Featured & banner', keys:['featuredEyebrow','featuredTitle','featuredAccent','featuredButton','joinEyebrow','joinTitle','joinAccent','joinDescription','joinButton']},
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
  key.toLowerCase().includes('description') ? 400 : 120;

export function normalizeSiteContent(raw: unknown): SiteContent {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const result = {...DEFAULT_SITE_CONTENT} as SiteContent;
  for(const key of keys) {
    const value = source[key];
    if(typeof value === 'string' && value.trim() && value.length <= siteContentLimit(key)) result[key] = value;
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
    if(!values[key].trim())throw new Error('Every site text field must contain some text.');
    if(values[key].length > siteContentLimit(key))throw new Error('Text is too long: '+key);
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
