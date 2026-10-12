import React from 'react';
import { createRoot } from 'react-dom/client';
import GuideArticle from './components/GuideArticle';
import './style.css';

const content = {type:'doc',content:[
  {type:'heading',attrs:{level:2},content:[{type:'text',text:'Overview'}]},
  {type:'paragraph',content:[{type:'text',text:'Test article with rich blocks and automatic contents.'}]},
  {type:'guideButton',attrs:{label:'View Ranger Guide',href:'#/guides/ranger',variant:'gold'}},
  {type:'guideCallout',attrs:{title:'Field note',body:'Always coordinate with the party.',tone:'tip'}},
  {type:'guideSkillCard',attrs:{title:'Explosive Arrow',description:'A demonstration skill card.',tag:'RANGER · SKILL GUIDE',iconSrc:'/assets/branding/aion-logo.avif',relatedHref:'#/guides/ranger'}},
  {type:'guideGallery',attrs:{images:[
    {src:'/assets/hero/aion-hero-purple.avif',alt:'Fantasy hero scene',caption:'First screenshot'},
    {src:'/assets/branding/aion-logo.avif',alt:'Guild logo',caption:'Second screenshot'}
  ],columns:2}},
  {type:'heading',attrs:{level:2},content:[{type:'text',text:'Overview'}]},
  {type:'paragraph',content:[{type:'text',text:'Second heading, unique anchor.'}]}
]};
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><div className="site"><GuideArticle
    guide={{slug:'test-rich',title:'Rich Article Fixture',category:'Classes',summary:'End-to-end rich blocks.' ,read:'GUILD GUIDE',content}}
    onBack={()=>{}} /></div></React.StrictMode>
);
