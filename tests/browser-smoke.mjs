import { chromium } from 'playwright-core';
const mode=process.argv[2]||'app';
const port=mode==='fixture'?4174:mode==='editor'?4175:mode==='site'?4176:mode==='weekly'?4177:mode==='balance'?4178:4173;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push('Uncaught JavaScript: '+e.message));
const check=(ok,label)=>{console.log((ok?'PASS':'FAIL')+' '+label);if(!ok)failures.push(label);};
try {
  if(mode==='balance') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const daily=page.locator('.player-scenic-daily');
    await daily.waitFor({timeout:10000});
    check(await daily.getByRole('button',{name:'Balance for Nightmare attempts'}).count()===1,
      'rechargeable daily activity has a Balance button');
    check(await daily.getByRole('button',{name:'Balance for Conquest Dungeon'}).count()===1 &&
      await daily.getByRole('button',{name:'Balance for Attendance check-in'}).count()===0,
      'Balance action appears only for configured ticket activities');
    check(await page.locator('.player-ticket-tracker').count()===0 &&
      await page.getByRole('dialog').count()===0,
      'ticket fields no longer occupy space inside daily rows');
    const alignment=await daily.getByRole('button',{name:'Balance for Nightmare attempts'}).evaluate(el=>{
      const row=el.closest('.player-daily-row')?.getBoundingClientRect();
      const b=el.getBoundingClientRect();
      return row?{rightMargin:row.right-b.right,sameRow:b.top>=row.top&&b.bottom<=row.bottom}:null;
    });
    check(Boolean(alignment&&alignment.rightMargin<=6&&alignment.sameRow),
      'Balance button is right-aligned within the daily activity row');
    await daily.getByRole('button',{name:'Balance for Nightmare attempts'}).click();
    const dialog=page.getByRole('dialog');
    await dialog.waitFor({timeout:3000});
    check((await dialog.getByRole('heading').innerText()).includes('Nightmare attempts') &&
      (await dialog.innerText()).includes('Ranger Test'), 'Balance dialog names the activity and character');
    const gutters=await dialog.evaluate(el=>{
      const label=el.querySelector('.player-balance-form>label')?.getBoundingClientRect();
      const help=el.querySelector('.player-balance-field-help')?.getBoundingClientRect();
      const input=el.querySelector('.player-balance-form>input')?.getBoundingClientRect();
      const title=el.querySelector('h2')?.getBoundingClientRect();
      return {titleToForm:label.top-title.bottom,labelToHelp:help.top-label.bottom,
        helpToInput:input.top-help.bottom};
    });
    check(gutters.titleToForm>=35 && gutters.labelToHelp>=9 && gutters.helpToInput>=12,
      'dialogue has visible gutters between title, ticket label, help and input');
    const ticketInput=dialog.getByRole('spinbutton',{name:'Nightmare attempts current tickets'});
    check(await ticketInput.inputValue()==='5','dialog reads saved ticket balance');
    await ticketInput.fill('8');
    await dialog.getByRole('button',{name:'Save balance'}).click();
    check((await dialog.getByRole('status').innerText()).includes('saved') &&
      (await dialog.innerText()).includes('8 / 14'),'saving shows confirmation and updated count');
    await dialog.getByRole('button',{name:'1 ticket used'}).click();
    check(await ticketInput.inputValue()==='7','one-ticket-used control updates count');
    await page.keyboard.press('Escape');
    check(await page.getByRole('dialog').count()===0 &&
      await daily.getByRole('button',{name:'Balance for Nightmare attempts'}).isFocused(),
      'Escape closes dialog and returns focus to Balance button');
    await daily.getByRole('button',{name:'Balance for Nightmare attempts'}).click();
    check(await page.getByRole('spinbutton',{name:'Nightmare attempts current tickets'}).inputValue()==='7',
      'ticket number remains available after reopening');
    await page.getByRole('button',{name:'Close balance dialog'}).click();
    await page.locator('.player-scenic-weekly .player-balance-button').click();
    check((await page.getByRole('dialog').innerText()).includes('Weekly ticket mission'),
      'rechargeable weekly activity can also use the dialog');
    await page.getByRole('button',{name:'Done'}).click();
    const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    await phone.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await phone.getByRole('button',{name:'Balance for Nightmare attempts'}).tap();
    const mobileDialog=phone.getByRole('dialog');
    await mobileDialog.waitFor({timeout:3000});
    const fit=await mobileDialog.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const i=el.querySelector('.player-balance-form>input')?.getBoundingClientRect();
      return {left:r.left,right:r.right,height:r.height,inputLeft:i.left,inputRight:i.right,
        windowWidth:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    check(fit.left>=0&&fit.right<=fit.windowWidth+1&&
      fit.inputLeft>=fit.left&&fit.inputRight<=fit.right&&
      fit.height<=844&&!fit.overflow,'mobile ticket dialog fits without horizontal overflow');
    await mobileDialog.getByRole('button',{name:'Done'}).tap();
    check(await phone.getByRole('dialog').count()===0,'mobile Done button closes dialog');
    await phone.close();
  } else if(mode==='weekly') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const items=page.locator('.player-scenic-weekly .player-task-entry-weekly');
    await items.first().waitFor({timeout:10000});
    check(await items.count()===3,'weekly fixture renders compact activity names');
    check(await page.locator('.player-scenic-weekly .player-task small').count()===0,
      'weekly descriptions are not shown inside checklist rows');
    const rowHeight=await items.first().locator('.player-weekly-row').evaluate(el=>el.getBoundingClientRect().height);
    check(rowHeight<=48,'weekly name-only row is compact');
    await items.first().hover();
    const tooltip=page.getByRole('tooltip');
    await tooltip.waitFor({timeout:3000});
    check((await tooltip.innerText()).includes('Complete your dungeon entry before the weekly reset'),
      'weekly help text floats on hover');
    const placement=await tooltip.evaluate(el=>({
      outsideScenic:el.parentElement===document.body,
      bounds:el.getBoundingClientRect().toJSON()
    }));
    check(placement.outsideScenic && placement.bounds.left>=0 && placement.bounds.right<=1280,
      'tooltip is portaled outside scenic overflow and stays in viewport');
    await page.locator('.player-scenic-weekly .player-weekly-label').first().click();
    check(await items.first().locator('input[type="checkbox"]').isChecked(),
      'compact row still allows normal checklist toggling');
    await page.getByRole('button',{name:'Outside focus'}).click();
    check(await tooltip.count()===0,'tooltip closes after focus moves away');
    // Playwright's default desktop page cannot .tap(). Use a separate
    // touch-enabled context to test the real mobile interaction.
    const touchPage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    await touchPage.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const details=touchPage.getByRole('button',{name:'About Shared Weekly Server Mission'});
    await details.tap();
    const touchTooltip=touchPage.getByRole('tooltip');
    await touchTooltip.waitFor({timeout:3000});
    check((await touchTooltip.innerText()).includes('shared by all alts') &&
      (await touchTooltip.innerText()).includes('Shared across characters'),
      'touch information button opens the external details blurb');
    const mobile=await touchTooltip.evaluate(el=>({
      left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
      body:document.documentElement.scrollWidth,viewport:innerWidth
    }));
    check(mobile.left>=0 && mobile.right<=mobile.viewport+1 && mobile.body<=mobile.viewport+1,
      'touch tooltip remains within the narrow viewport');
    await touchPage.close();
  } else if(mode==='site') {
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    const editor=page.locator('.site-copy-editor');
    await editor.getByRole('heading',{name:'Site Content'}).waitFor({timeout:10000});
    check(await editor.getByRole('button',{name:'Preview changes'}).count()===1,
      'site content editor exposes a preview action');
    const copyNav=await page.locator('.site-copy-nav button').allInnerTexts();
    check(copyNav.includes('Homepage · Hero') &&
      copyNav.includes('Homepage · About me') &&
      copyNav.includes('Homepage · Upcoming news') &&
      copyNav.includes('Homepage · Recently updated') &&
      !copyNav.includes('Homepage · Start here') &&
      !copyNav.includes('Homepage · Featured & banner') &&
      !copyNav.includes('Homepage · About the codex'),
      'site editor only offers content sections that remain on the homepage');
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
    const previewSections=await preview.locator('.site-copy-preview-content > section').count();
    check(previewSections===4 && await preview.locator('.site-copy-preview-section').count()===2 &&
      await preview.locator('.site-copy-preview-content > footer').count()===1,
      'private homepage preview ends after game news and recently updated');
    await page.keyboard.press('Escape');
    check(await preview.count()===0,'Escape closes website text preview');
    await page.getByRole('button',{name:'Homepage · Upcoming news'}).click();
    check(await page.locator('.site-copy-news-editor .site-news-editor-card').count()===3,
      'upcoming news editor shows three sourced starter announcements');
    await page.getByRole('button',{name:'Add announcement'}).click();
    check(await page.locator('.site-copy-news-editor .site-news-editor-card').count()===4,
      'adding an announcement creates an editable calendar entry');
    await page.locator('.site-news-editor-card').last().getByRole('button',{name:'Remove'}).click();
    check(await page.locator('.site-copy-news-editor .site-news-editor-card').count()===3,
      'announcement removal is reversible before publishing');
    await page.getByRole('button',{name:'Homepage · About me'}).click();
    check(await page.getByRole('button',{name:'Upload background'}).count()===1 &&
      await page.getByRole('button',{name:'Upload photo'}).count()===1 &&
      await page.locator('.site-copy-backdrop-preview img').count()===1,
      'About Me editor offers independent background and portrait uploads');
    await page.getByRole('button',{name:'Preview changes'}).click();
    check(await page.getByRole('dialog',{name:'Preview site text'})
      .locator('.site-copy-preview-profile-backdrop img').count()===1,
      'private preview shows separate About Me background image');
    await page.keyboard.press('Escape');
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
    // Public player portal must be reachable without access to staff controls.
    await page.goto('http://127.0.0.1:'+port+'/#/account',{waitUntil:'domcontentloaded'});
    await page.locator('.player-page').waitFor({timeout:10000});
    const playerPage=await page.locator('.player-page').innerText();
    check(playerPage.includes('Player Accounts')||playerPage.includes('Make Atreia'),
      'public player portal opens directly from account route');
    check(await page.locator('.player-page .studio-login').count()===0,
      'player registration does not use restricted admin sign-in');
    const signup=page.getByRole('button',{name:'Create an account'});
    if(await signup.count()){
      await signup.click();
      check(await page.getByRole('heading',{name:'Join the codex'}).count()===1 &&
        await page.getByRole('textbox',{name:'Display name'}).count()===1,
        'registration shows the public display-name and email form');
      await page.getByRole('button',{name:'Back to sign in'}).click();
      check(await page.getByRole('heading',{name:'Sign in',exact:true}).count()===1,
        'public sign-up returns to sign-in without admin access');
    }
    await page.setViewportSize({width:390,height:844});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
      'public account screens fit a phone without horizontal overflow');
    await page.setViewportSize({width:1280,height:900});
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
    const homeLayout=await page.locator('.site > section').evaluateAll(nodes=>nodes.map(node=>node.classList[0]));
    check(JSON.stringify(homeLayout)===JSON.stringify(['hero','creator','upcoming-news','recent']) &&
      await page.locator('.site > footer').count()===1,
      'homepage contains exactly hero, About Me, game news, recently updated, then footer');
    const creatorDesktop=await page.locator('.creator-portrait').evaluate(node=>{
      const rect=node.getBoundingClientRect();
      const section=document.querySelector('.creator.creator-bleed')?.getBoundingClientRect();
      const background=document.querySelector('.creator-backdrop img');
      return {width:rect.width,ratio:rect.width/rect.height,bleed:section?Math.abs(section.width-innerWidth)<2:false,background:Boolean(background?.getAttribute('src'))};
    });
    check(creatorDesktop.width>=180 && creatorDesktop.width<=240 && creatorDesktop.ratio>.76 &&
      creatorDesktop.ratio<.84 && creatorDesktop.bleed && creatorDesktop.background,
      'About Me has full-bleed background and a separate smaller 4:5 portrait');
    const heroAboutBlend=await page.evaluate(()=>{
      const hero=document.querySelector('.hero');
      const about=document.querySelector('.creator.creator-bleed');
      const backdrop=document.querySelector('.creator-backdrop');
      const wash=document.querySelector('.creator-backdrop-wash');
      if(!hero||!about||!backdrop||!wash)return null;
      const overlap=hero.getBoundingClientRect().bottom-about.getBoundingClientRect().top;
      const backdropStyle=getComputedStyle(backdrop);
      const washStyle=getComputedStyle(wash);
      return {overlap, mask:backdropStyle.maskImage, washMask:washStyle.maskImage,
        transparent:getComputedStyle(about).backgroundColor==='rgba(0, 0, 0, 0)'};
    });
    check(Boolean(heroAboutBlend&&heroAboutBlend.overlap>=130 && heroAboutBlend.overlap<=190 &&
      heroAboutBlend.mask.includes('linear-gradient') && heroAboutBlend.washMask.includes('linear-gradient') &&
      heroAboutBlend.transparent),
      'landing hero and About Me artwork overlap with a soft transparent fade');
    check(await page.locator('.upcoming-news').count()===1 &&
      await page.locator('.intro .category-grid').count()===0,
      'upcoming AION 2 news replaces the old destination category tiles');
    const endSpacing=await page.evaluate(()=>{
      const recent=document.querySelector('.recent');
      const footer=document.querySelector('.site > footer');
      return recent&&footer?{gap:footer.getBoundingClientRect().top-recent.getBoundingClientRect().bottom,
        margin:getComputedStyle(footer).marginTop}:null;
    });
    check(Boolean(endSpacing&&Math.abs(endSpacing.gap)<2 && parseFloat(endSpacing.margin)===0),
      'Recently Updated flows directly into footer without an extra empty section');
    const newsLinks=await page.locator('.upcoming-card-source').evaluateAll(links=>
      links.every(link=>link.getAttribute('href')?.startsWith('https://')&&link.getAttribute('rel')?.includes('noopener')));
    const activeCards=await page.locator('.upcoming-card').count();
    check((activeCards>0 && newsLinks) || (activeCards===0 && await page.locator('.upcoming-empty a[href^="https://"]').count()===1),
      'news cards have safe official sources, or a dated-out calendar shows the official empty state');
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
    const creatorMobile=await page.locator('.creator-portrait').evaluate(node=>{
      const rect=node.getBoundingClientRect();
      const section=document.querySelector('.creator.creator-bleed')?.getBoundingClientRect();
      return {width:rect.width,ratio:rect.width/rect.height,overflow:rect.right>innerWidth+1,
        backgroundVisible:Boolean(document.querySelector('.creator-backdrop img')),
        fullBleed:section?Math.abs(section.width-innerWidth)<2:false};
    });
    check(creatorMobile.width>=130 && creatorMobile.width<=200 && creatorMobile.ratio>.76 &&
      creatorMobile.ratio<.84 && !creatorMobile.overflow && creatorMobile.backgroundVisible && creatorMobile.fullBleed,
      'full-bleed background and smaller portrait fit mobile screens without overflow');
    const blendMobile=await page.evaluate(()=>{
      const hero=document.querySelector('.hero')?.getBoundingClientRect();
      const about=document.querySelector('.creator.creator-bleed')?.getBoundingClientRect();
      const mask=getComputedStyle(document.querySelector('.creator-backdrop')).maskImage;
      return {overlap:hero&&about?hero.bottom-about.top:0,mask};
    });
    check(blendMobile.overlap>=125 && blendMobile.overlap<=135 &&
      blendMobile.mask.includes('linear-gradient'),
      'mobile hero-to-About Me transition retains the gradual image dissolve');
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
