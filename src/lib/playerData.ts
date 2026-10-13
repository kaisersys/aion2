export type PlayerProfile = {
  user_id: string;
  display_name: string;
  class_name: string;
  faction: string;
};
export type PlayerTask = {key:string;label:string;hint:string;type:'daily'|'weekly'};
export type SuggestedGuide = {slug:string;title:string;category:string;summary:string};

export const PLAYER_CLASSES = ['','Gladiator','Templar','Assassin','Ranger','Sorcerer','Spiritmaster','Cleric','Chanter'] as const;

// Deliberately editable personal prompts, not assertions about game reset or reward systems.
export const DAILY_TASKS:PlayerTask[] = [
  {key:'daily-check-in',label:'Check in and claim available rewards',hint:'Start with anything expiring today',type:'daily'},
  {key:'daily-missions',label:'Review daily missions and objectives',hint:'Choose the activities you want to focus on',type:'daily'},
  {key:'daily-instances',label:'Run your planned daily content',hint:'Track your own dungeon or activity goals',type:'daily'},
  {key:'daily-progression',label:'Work on your character progression',hint:'Gear, skills, crafting, or another goal',type:'daily'},
  {key:'daily-prep',label:'Prepare for the next session',hint:'Review inventory, materials, and plans',type:'daily'}
];
export const WEEKLY_TASKS:PlayerTask[] = [
  {key:'weekly-plan',label:'Plan your weekly priorities',hint:'Set your most important objectives',type:'weekly'},
  {key:'weekly-content',label:'Complete your chosen weekly content',hint:'Dungeons, group activities, or other goals',type:'weekly'},
  {key:'weekly-rewards',label:'Review any weekly rewards',hint:'Check for anything still available to claim',type:'weekly'},
  {key:'weekly-gear',label:'Review your gear and upgrade plan',hint:'Pick the next upgrade worth pursuing',type:'weekly'}
];
export const ALL_TASKS = [...DAILY_TASKS,...WEEKLY_TASKS];
export function pacificPeriod(now:Date=new Date()){
  const day=new Intl.DateTimeFormat('sv-SE',{
    timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(now);
  const asUtc=new Date(day+'T12:00:00Z');
  const mondayOffset=(asUtc.getUTCDay()+6)%7;
  asUtc.setUTCDate(asUtc.getUTCDate()-mondayOffset);
  return {day,week:asUtc.toISOString().slice(0,10)};
}
export function taskPeriod(task:PlayerTask,period:{day:string;week:string}){
  return task.type==='daily'?period.day:period.week;
}
export function recommendedGuides(guides:SuggestedGuide[],profile:PlayerProfile|null,savedSlugs:string[]){
  const selected=profile?.class_name?.toLowerCase()||'';
  const saved=new Set(savedSlugs);
  return [...guides].sort((a,b)=>{
    const score=(g:SuggestedGuide)=>{
      const name=g.title.toLowerCase();
      let rank=0;
      if(selected && name.includes(selected))rank+=10;
      if(g.category==='Progression')rank+=4;
      if(g.category==='Getting Started')rank+=2;
      if(saved.has(g.slug))rank-=4;
      return rank;
    };
    return score(b)-score(a);
  }).slice(0,3);
}
