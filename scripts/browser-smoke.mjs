import { chromium } from 'playwright-core';

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser = await chromium.launch({executablePath: chrome, headless: true, args:['--no-sandbox','--disable-dev-shm-usage']});
for (const [label,url] of [['live','https://atreiastreet.com/'],['faulty-local','http://127.0.0.1:4173/'],['faulty-admin','http://127.0.0.1:4173/#admin']]) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('JS: '+e.message));
  page.on('console', msg => { if(msg.type()==='error') errors.push('CONSOLE: '+msg.text().slice(0,200)); });
  try {
    const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForTimeout(3500);
    const title = await page.locator('h1').first().textContent({timeout:3500}).catch(()=>null);
    const rootLength = await page.locator('#root').evaluate(el => el.textContent?.length||0).catch(()=>0);
    console.log(JSON.stringify({label,status:response?.status(),headline:title,rootTextLength:rootLength,errors:errors.slice(0,7)}));
  } catch (err) {
    console.log(JSON.stringify({label,error:String(err).slice(0,500),errors:errors.slice(0,7)}));
  } finally {await page.close();}
}
await browser.close();