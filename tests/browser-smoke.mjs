import { chromium } from 'playwright-core';
const mode=process.argv[2]||'app';
const port=mode==='fixture'?4174:mode==='editor'?4175:mode==='site'?4176:4173;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push('Uncaught JavaScript: '+e.message));
const check=(ok,label)=>{console.log((ok?'PASS':'FAIL')+' '+label);if(!ok)failures.push(label);};
try {
  if(mode==='site') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const editor=page.locator('.site-copy-editor');
    await editor.getByRole('heading',{name:'Site Content'}).waitFor({timeout:10000});
    check(await editor.getByRole('button',{name:'Preview changes'}).count()===1,
      'site content editor exposes a preview action');
    check(await page.getByRole('textbox',{name:'Title',exact:true}).inputValue()==='THE PATH OF',
      'site content fields initialize with published text');
    await page.getByRole('textbox',{name:'Title',exact:true}).fill('A NEW PATH');
    check((await editor.innerText()).includes('Unsaved changes'),
      'edited site text is tracked as unpublished');
    await page.getByRole('button',{name:'Preview changes'}).click();
    const preview=page.getByRole('dialog',{name:'Preview site text'});
    await preview.waitFor({timeout:5000});
    check((await preview.locator('h1').first().innerText()).includes('A NEW PATH'),
      'private preview renders unsaved homepage headline');
    await page.keyboard.press('Escape');
    check(await preview.count()===0,'Escape closes website text preview');
    await page.getByRole('button',{name:'Footer'}).click();
    await page.getByRole('textbox',{name:'Description',exact:true}).fill('Independent community guide project. Test footer.');
    await page.getByRole('button',{name:'Preview changes'}).click();
    check((await page.getByRole('dialog',{name:'Preview site text'}).locator('footer').innerText())
      .includes('Test footer.'),'preview shows unsaved footer copy');
    await page.getByRole('button',{name:'Back to editor'}).click();
    await page.getByRole('button',{name:'Publish changes'}).first().click();
    await page.getByRole('status').filter({hasText:'Published!'}).waitFor({timeout:5000});
    check(await page.getByTestId('site-publish-count').innerText()==='1',
      'publishing sends edited values to the storage adapter');
    check((await editor.innerText()).includes('All changes saved'),
      'published changes clear dirty state');
    await page.getByRole('button',{name:'Restore version'}).click();
    await page.getByRole('button',{name:'Homepage · Hero'}).click();
    check(await page.getByRole('textbox',{name:'Title',exact:true}).inputValue()==='THE PATH OF',
      'version history restores prior homepage text into the editor');
    check((await editor.innerText()).includes('Unsaved changes'),
      'restoring a version does not publish without confirmation');
    await page.getByRole('button',{name:'Publish changes'}).first().click();
    await page.getByTestId('site-publish-count').filter({hasText:'2'}).waitFor({timeout:5000});
    check(await page.getByTestId('site-publish-count').innerText()==='2',
      'restored site copy can be republished');
  } else if(mode==='editor') {
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
    check(await page.locator('.studio-editor-canvas .tiptap h2').allTextContents().then(headings=>headings.some(text=>text.includes('Combat Rotation'))),
      'adding rich blocks preserves existing headings');
    await page.getByRole('button',{name:'Full-page preview'}).click();
    await page.locator('.studio-page-preview').waitFor({timeout:10000});
    check((await page.locator('.studio-page-preview h1').first().innerText()).includes('Ranger Combat Rotation'),'private preview displays unsaved title');
    await page.locator('.studio-page-preview .guide-callout').waitFor({timeout:3500});
    check(await page.locator('.studio-page-preview .guide-callout').count()===1,'private preview displays unsaved rich blocks');
    check((await page.locator('.studio-page-preview .article-sidebar').innerText()).includes('Combat Rotation'),'private preview displays auto table of contents');
    const previewInset=await page.evaluate(()=>{const b=document.querySelector('.studio-page-preview .article-hero')?.getBoundingClientRect();return b?{left:b.left,right:innerWidth-b.right}:null;});
    check(Boolean(previewInset && previewInset.left>=50 && previewInset.right>=50),'private full-page preview has desktop reading gutters');
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
    const articleTypeface=await page.locator('main h1').first().evaluate(node=>getComputedStyle(node).fontFamily);
    check(articleTypeface.includes('Manrope'),'guide display headings use Manrope');
    const getArticleGutters=()=>page.evaluate(()=>{
      const bounds=document.querySelector('.article-hero')?.getBoundingClientRect();
      return bounds?{left:bounds.left,right:innerWidth-bounds.right,overflow:document.documentElement.scrollWidth>innerWidth+1}:null;
    });
    const desktop=await getArticleGutters();
    check(Boolean(desktop && desktop.left>=50 && desktop.right>=50 && !desktop.overflow),'published guide has balanced desktop reading gutters');
    await page.setViewportSize({width:390,height:844});
    const mobile=await getArticleGutters();
    check(Boolean(mobile && mobile.left>=18 && mobile.right>=18 && !mobile.overflow),'published guide has mobile reading gutters without horizontal overflow');
    await page.setViewportSize({width:1280,height:900});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('h1').first().waitFor({timeout:10000});
    check((await page.locator('h1').innerText()).includes('Ranger'),'guide URL survives reload');
    await page.goto('http://127.0.0.1:'+port+'/#/library',{waitUntil:'domcontentloaded'});
    check((await page.locator('main h1').innerText()).includes('Guides'),'library deep link');
    await page.goto('http://127.0.0.1:'+port+'/#admin',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2000);
    const text=await page.locator('main').innerText();
    check(text.includes('Admin Sanctum')||text.includes('Guide Studio')||text.includes('Studio Setup'),'admin route renders without crash');
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const fontCheck=await page.evaluate(()=>{
      const hero=document.querySelector('.hero h1');
      const body=document.querySelector('.hero p');
      return {
        heroFont:hero?getComputedStyle(hero).fontFamily:'',
        bodyFont:body?getComputedStyle(body).fontFamily:'',
        overflows:document.documentElement.scrollWidth>window.innerWidth+1
      };
    });
    check(fontCheck.heroFont.includes('Manrope') && fontCheck.bodyFont.includes('Inter'),'hero uses Manrope while reading copy stays Inter');
    check(!fontCheck.overflows,'updated headings do not overflow desktop');
    const depth=()=>page.evaluate(()=>{
      const transform=(selector)=>getComputedStyle(document.querySelector(selector)).transform;
      return {art:transform('.hero-art'),sky:transform('.hero-sky'),foreground:transform('.hero-foreground')};
    });
    check(await page.locator('.hero-foreground[aria-hidden="true"]').count()===1,
      'decorative foreground depth layer is present');
    check(await page.locator('.hero-motes[aria-hidden="true"] span').count()===18
      && await page.locator('.hero-aura[aria-hidden="true"]').count()===1,
      'gold-violet motes and aurora added as decorative layers');
    const ambient=await page.evaluate(()=>{
      const motes=[...document.querySelectorAll('.hero-motes span')];
      return {
        active:motes.filter(mote=>getComputedStyle(mote).animationName!=='none').length,
        visible:motes.filter(mote=>Number(getComputedStyle(mote).opacity)>.08).length,
        aura:getComputedStyle(document.querySelector('.hero-aura'),'::before').animationName,
        light:getComputedStyle(document.querySelector('.hero-aura'),'::after').animationName,
        blocksPointer:[...document.querySelectorAll('.hero-aura,.hero-motes')].some(el=>getComputedStyle(el).pointerEvents!=='none')
      };
    });
    check(ambient.active===18 && ambient.visible>=2 &&
      ambient.aura!=='none' && ambient.light!=='none' && !ambient.blocksPointer,
      'ambient motes and soft light are animated without intercepting clicks');
    const stars=await page.evaluate(()=>{
      const sky=document.querySelector('.hero-sky');
      const base=getComputedStyle(sky);
      const near=getComputedStyle(sky,'::before');
      const bright=getComputedStyle(sky,'::after');
      return {
        density:(near.backgroundImage.match(/radial-gradient/g)||[]).length,
        highlights:(bright.backgroundImage.match(/radial-gradient/g)||[]).length,
        opacity:Number(base.opacity),
        brightened:base.filter!=='none',
        layer:base.zIndex,
        twinkle:near.animationName,
        glow:bright.animationName,
        blocksClicks:base.pointerEvents!=='none'
      };
    });
    check(stars.density>=24 && stars.highlights>=6 && stars.opacity>=.5 &&
      stars.brightened && stars.layer==='2' && stars.twinkle!=='none' &&
      stars.glow!=='none' && !stars.blocksClicks,
      'denser visible star field has six bright highlights and twinkles behind content');
    const artSource=await page.evaluate(()=>getComputedStyle(document.querySelector('.hero-art'),'::before').backgroundImage);
    check(artSource.includes('aion-hero-purple.avif'),'hero backdrop retains the original artwork');
    await page.mouse.move(140,450);
    await page.waitForTimeout(120);
    const nearLeft=await depth();
    await page.mouse.move(1110,480);
    await page.waitForTimeout(120);
    const nearRight=await depth();
    check(nearLeft.art!==nearRight.art && nearLeft.sky!==nearRight.sky &&
      nearLeft.foreground!==nearRight.foreground,'all three planes respond to desktop pointer movement');
    check(nearRight.art!==nearRight.sky && nearRight.sky!==nearRight.foreground,
      'background, midground and foreground move at different speeds');
    await page.evaluate(()=>window.scrollTo({top:300,behavior:'instant'}));
    await page.waitForTimeout(120);
    const afterScroll=await depth();
    check(afterScroll.art!==nearRight.art && afterScroll.sky!==nearRight.sky &&
      afterScroll.foreground!==nearRight.foreground,'scrolling creates multi-plane parallax depth');
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(120);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
      'mobile hero does not cause horizontal overflow');
    const mobileAtmosphere=await page.evaluate(()=>({
      fewerParticles:getComputedStyle(document.querySelector('.hero-motes span:nth-child(12)')).display==='none',
      softerAura:Number(getComputedStyle(document.querySelector('.hero-aura')).opacity)<.5,
      staticFinder:getComputedStyle(document.querySelector('.hero-finder')).pointerEvents!=='none'
    }));
    check(mobileAtmosphere.fewerParticles && mobileAtmosphere.softerAura && mobileAtmosphere.staticFinder,
      'mobile magic is restrained and guide finder remains interactive');
    const mobileStars=await page.evaluate(()=>({
      opacity:Number(getComputedStyle(document.querySelector('.hero-sky')).opacity),
      brightOpacity:Number(getComputedStyle(document.querySelector('.hero-sky'),'::after').opacity)
    }));
    check(mobileStars.opacity<stars.opacity && mobileStars.brightOpacity<.6,
      'mobile stars are gentler than desktop');
    const reduce=await browser.newContext({reducedMotion:'reduce'});
    const reducePage=await reduce.newPage();
    await reducePage.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await reducePage.locator('.hero-art').waitFor();
    const staticMotion=await reducePage.evaluate(()=>{
      const art=document.querySelector('.hero-art');
      return {
        art:getComputedStyle(art).transform,
        sky:getComputedStyle(document.querySelector('.hero-sky')).transform,
        foreground:getComputedStyle(document.querySelector('.hero-foreground')).transform,
        breathing:getComputedStyle(art,'::before').animationName
      };
    });
    check(staticMotion.art==='none' && staticMotion.sky==='none' &&
      staticMotion.foreground==='none' && staticMotion.breathing==='none',
      'reduced-motion mode disables parallax and breathing animation');
    const reducedAmbient=await reducePage.evaluate(()=>({
      mote:getComputedStyle(document.querySelector('.hero-motes span')).animationName,
      moteOpacity:getComputedStyle(document.querySelector('.hero-motes span')).opacity,
      aura:getComputedStyle(document.querySelector('.hero-aura'),'::before').animationName,
      sweep:getComputedStyle(document.querySelector('.hero-aura'),'::after').animationName
    }));
    check(reducedAmbient.mote==='none' && reducedAmbient.moteOpacity==='0' &&
      reducedAmbient.aura==='none' && reducedAmbient.sweep==='none',
      'reduced-motion mode disables floating motes and glow animations');
    const reducedStars=await reducePage.evaluate(()=>({
      near:getComputedStyle(document.querySelector('.hero-sky'),'::before').animationName,
      bright:getComputedStyle(document.querySelector('.hero-sky'),'::after').animationName
    }));
    check(reducedStars.near==='none' && reducedStars.bright==='none',
      'reduced-motion mode also disables star twinkling');
    await reduce.close();
  }
} catch(e) {failures.push(String(e));}
await browser.close();
if(failures.length){console.error('BROWSER SMOKE FAILURE',failures);process.exitCode=1;}
else console.log('BROWSER SMOKE PASSED ('+mode+')');
