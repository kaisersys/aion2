import { chromium } from 'playwright-core';
const mode=process.argv[2]||'app';
const port=mode==='fixture'?4174:4173;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push('Uncaught JavaScript: '+e.message));
const check=(ok,label)=>{console.log((ok?'PASS':'FAIL')+' '+label);if(!ok)failures.push(label);};
try {
  if(mode==='fixture') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await page.locator('h1').first().waitFor({timeout:10000});
    check((await page.locator('h1').innerText()).includes('Rich Article Fixture'),'article fixture title');
    check(await page.locator('.article-sidebar a').count()>=2,'automatic table of contents');
    check(await page.locator('[id="overview"]').count()===1 && await page.locator('[id="overview-2"]').count()===1,'duplicate headings receive unique anchors');
    check(await page.locator('.guide-button-block a[href="#/guides/ranger"]').count()===1,'internal CTA button');
    check(await page.locator('.guide-callout').count()===1 && await page.locator('.guide-skill-card').count()===1,'reusable skill and note blocks');
    check(await page.locator('.guide-gallery-item').count()===2,'gallery has two images with captions');
    await page.locator('.guide-gallery-item button').first().click();
    check(await page.locator('.guide-lightbox[role="dialog"]').isVisible(),'gallery lightbox opens');
    await page.keyboard.press('ArrowRight');
    check((await page.locator('.guide-lightbox figcaption').innerText()).includes('Second screenshot'),'gallery keyboard next');
    await page.keyboard.press('Escape');
    check(await page.locator('.guide-lightbox').count()===0,'gallery closes with Escape');
    await page.locator('.article-sidebar a[href*="section=overview-2"]').click();
    check(new URL(page.url()).hash.includes('section=overview-2'),'table of contents jumps to section');
  } else {
    await page.goto('http://127.0.0.1:'+port+'/#/guides/ranger',{waitUntil:'domcontentloaded'});
    await page.locator('h1').first().waitFor({timeout:10000});
    check((await page.locator('h1').innerText()).includes('Ranger'),'direct guide URL loads on first visit');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('h1').first().waitFor({timeout:10000});
    check((await page.locator('h1').innerText()).includes('Ranger'),'guide URL survives reload');
    await page.goto('http://127.0.0.1:'+port+'/#/library',{waitUntil:'domcontentloaded'});
    check((await page.locator('main h1').innerText()).includes('Guides'),'library deep link');
    await page.goto('http://127.0.0.1:'+port+'/#admin',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2000);
    const text=await page.locator('main').innerText();
    check(text.includes('Admin Sanctum')||text.includes('Guide Studio')||text.includes('Studio Setup'),'admin route renders without crash');
  }
} catch(e) {failures.push(String(e));}
await browser.close();
if(failures.length){console.error('BROWSER SMOKE FAILURE',failures);process.exitCode=1;}
else console.log('BROWSER SMOKE PASSED ('+mode+')');
