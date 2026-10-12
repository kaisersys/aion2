import { chromium } from 'playwright-core';
const mode=process.argv[2]||'app';
const port=mode==='fixture'?4174:mode==='editor'?4175:4173;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push('Uncaught JavaScript: '+e.message));
const check=(ok,label)=>{console.log((ok?'PASS':'FAIL')+' '+label);if(!ok)failures.push(label);};
try {
  if(mode==='editor') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await page.getByRole('textbox',{name:'Guide title'}).fill('Ranger Combat Rotation');
    await page.getByRole('textbox',{name:'Short summary'}).fill('Test summary for private preview');
    const edit=page.locator('.studio-editor-canvas .tiptap');
    await edit.waitFor({timeout:10000});
    await edit.click();
    await page.getByRole('button',{name:'Heading 2'}).click();
    const heading=page.locator('.studio-editor-canvas .tiptap h2').first();
    await heading.waitFor({timeout:5000});
    await heading.click();
    await page.keyboard.insertText('Combat Rotation');
    check((await heading.innerText()).includes('Combat Rotation'),'editor creates persistent section heading');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Skill priority and timing.');
    await page.getByRole('button',{name:'Info / tip box'}).click();
    await page.getByRole('textbox',{name:'Heading'}).fill('Rotation Tip');
    await page.getByRole('textbox',{name:'Message'}).fill('Practice on training dummies.');
    await page.getByRole('button',{name:'Insert block'}).click();
    check(await page.locator('.studio-editor-canvas .guide-callout').count()===1,'editor inserts reusable tip block');
    await page.getByRole('button',{name:'Link button'}).click();
    await page.getByRole('textbox',{name:'Button text'}).fill('More Ranger Guides');
    await page.getByRole('textbox',{name:'Destination URL'}).fill('#/guides/ranger');
    await page.getByRole('button',{name:'Insert block'}).click();
    check(await page.locator('.studio-editor-canvas .guide-button-block').count()===1,'editor inserts internal-link CTA');
    await page.getByRole('button',{name:'Skill / gear card'}).click();
    await page.getByRole('textbox',{name:'Name'}).fill('Explosive Arrow');
    await page.getByRole('button',{name:'Insert block'}).click();
    check(await page.locator('.studio-editor-canvas .guide-skill-card').count()===1,'editor inserts skill card');
    check(await page.locator('.studio-editor-canvas .guide-callout').count()===1
      && await page.locator('.studio-editor-canvas .guide-button-block').count()===1,
      'new blocks do not overwrite earlier blocks');
    check(await page.locator('.studio-editor-canvas .tiptap h2').count()===1,
      'adding rich blocks preserves existing headings');
    await page.getByRole('button',{name:'Full-page preview'}).click();
    await page.locator('.studio-page-preview').waitFor({timeout:10000});
    check((await page.locator('.studio-page-preview h1').first().innerText()).includes('Ranger Combat Rotation'),'private preview displays unsaved title');
    await page.locator('.studio-page-preview .guide-callout').waitFor({timeout:3500});
    check(await page.locator('.studio-page-preview .guide-callout').count()===1,'private preview displays unsaved rich blocks');
    check((await page.locator('.studio-page-preview .article-sidebar').innerText()).includes('Combat Rotation'),'private preview displays auto table of contents');
    await page.getByRole('button',{name:'Close preview'}).click();
    check(await page.locator('.studio-page-preview').count()===0,'closing preview restores editor');
  } else if(mode==='fixture') {
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
