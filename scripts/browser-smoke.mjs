import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
let failed = false;
for (const [label,url,expected] of [
  ['live-home','https://atreiastreet.com/?verify=studio2026','THE PATH OF'],
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
    const ok = response?.status()===200 && text.includes(expected) && adminLoaded && pageErrors.length===0;
    if (!ok) failed = true;
    console.log(JSON.stringify({label,ok,status:response?.status(),headline,rootTextLength:text.length,adminLoginVisible:label==='live-admin'?adminLoaded:undefined,pageErrors:pageErrors.slice(0,5)}));
  } catch (e) {
    failed = true;
    console.log(JSON.stringify({label,ok:false,error:String(e).slice(0,400),pageErrors}));
  } finally {await page.close();}
}
await browser.close();
if(failed)process.exitCode=1;
