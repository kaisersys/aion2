import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
let failed = false;
for (const [label,url,expected] of [
  ['live-home','https://atreiastreet.com/?verify=rich-studio2026','THE PATH OF'],
  ['live-library','https://atreiastreet.com/#/library','Guild'],
  ['live-guide','https://atreiastreet.com/#/guides/ranger','Ranger'],
  ['live-admin','https://atreiastreet.com/#admin','Admin Sanctum']
]) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  try {
    const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(3500);
    const text = await page.locator('#root').innerText();
    const headline = await page.locator('h1').first().innerText().catch(()=>null);
    const adminLoaded = label==='live-admin' ? (
      text.includes('Sign in with your approved Supabase staff account.') && text.includes('Sign in')
    ) : true;
    const guideLoaded=label==='live-guide'? headline?.includes('Ranger') && await page.locator('.article-sidebar a[href*="section="]').count()>0:true;
    let guttersOK=true;
    if (label==='live-guide') {
      const getInsets=()=>page.evaluate(()=>{
        const rect=document.querySelector('.article-hero')?.getBoundingClientRect();
        return rect?{left:Math.round(rect.left),right:Math.round(innerWidth-rect.right),overflow:document.documentElement.scrollWidth>innerWidth+1}:null;
      });
      await page.setViewportSize({width:1280,height:900});
      const desktop=await getInsets();
      await page.setViewportSize({width:390,height:844});
      const mobile=await getInsets();
      guttersOK=Boolean(desktop && desktop.left>=50 && desktop.right>=50 && !desktop.overflow && mobile && mobile.left>=18 && mobile.right>=18 && !mobile.overflow);
      console.log(JSON.stringify({label:'live-gutters',ok:guttersOK,desktop,mobile}));
    }
    const typeface = (label==='live-home'||label==='live-guide') ? await page.evaluate(()=>{
      const heading=document.querySelector('.hero h1, .article-hero h1');
      const body=document.querySelector('.hero p, .article-hero p');
      return {
        heading:heading?getComputedStyle(heading).fontFamily:'',
        body:body?getComputedStyle(body).fontFamily:''
      };
    }):null;
    const fontOK=typeface?typeface.heading.includes('Sora')&&typeface.body.includes('Inter'):true;
    if(typeface)console.log(JSON.stringify({label:label+'-typography',ok:fontOK,...typeface}));
    const ok=response?.status()===200 && text.includes(expected) && adminLoaded && guideLoaded && guttersOK && fontOK && pageErrors.length===0;
    if (!ok) failed = true;
    console.log(JSON.stringify({label,ok,status:response?.status(),headline,rootTextLength:text.length,adminLoginVisible:label==='live-admin'?adminLoaded:undefined,pageErrors:pageErrors.slice(0,5)}));
  } catch (e) {
    failed = true;
    console.log(JSON.stringify({label,ok:false,error:String(e).slice(0,400),pageErrors}));
  } finally {await page.close();}
}
await browser.close();
if(failed)process.exitCode=1;
