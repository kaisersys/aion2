import { chromium } from 'playwright-core';
const executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({executablePath, headless: true, args:['--no-sandbox','--disable-dev-shm-usage']});
let failed = false;
for (const [label,url] of [
  ['guarded-home','http://127.0.0.1:4173/'],
  ['guarded-admin','http://127.0.0.1:4173/#admin']
]) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(1500);
    const text = await page.locator('#root').textContent();
    const headline = await page.locator('h1').first().textContent();
    const ok = response?.status()===200 && Boolean(headline) && Boolean(text && text.length>60) && errors.length===0;
    if(!ok) failed=true;
    console.log(JSON.stringify({label,ok,status:response?.status(),headline,rootLength:text?.length,errors:errors.slice(0,4)}));
  } catch (error) {
    failed=true;
    console.log(JSON.stringify({label,ok:false,error:String(error),errors}));
  } finally {await page.close();}
}
await browser.close();
if(failed)process.exitCode=1;
