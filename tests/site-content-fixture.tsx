import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import SiteContentEditor from '../src/admin/SiteContentEditor';
import {DEFAULT_SITE_CONTENT,normalizeSiteContent,type SiteContent,type SiteSnapshot} from '../src/lib/siteContent';
import '../src/style.css';

let snapshot:SiteSnapshot={
  values:normalizeSiteContent(DEFAULT_SITE_CONTENT),
  rowId:'fake-editor-row',updatedAt:'2026-10-12T00:00:00Z',
  revisions:[{at:'2026-10-11T00:00:00Z',values:{...normalizeSiteContent(DEFAULT_SITE_CONTENT),heroTitle:'THE OLD PATH'}}]
};
const loadSnapshot=async()=>snapshot;
const publishContent=async(values:SiteContent,old:SiteSnapshot,_userId:string):Promise<SiteSnapshot>=>{
  snapshot={
    values:{...values},rowId:'fake-editor-row',updatedAt:new Date().toISOString(),
    revisions:[{at:new Date().toISOString(),values:old.values},...old.revisions].slice(0,12)
  };
  return snapshot;
};
function Fixture(){
  const [published,setPublished]=useState(0);
  return <main className="inner-page section-wrap studio-page">
    <SiteContentEditor userId="test-user" onBack={()=>{}} onPublished={()=>setPublished(n=>n+1)}
      loadSnapshot={loadSnapshot} publishContent={publishContent}/>
    <output data-testid="site-publish-count">{published}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
