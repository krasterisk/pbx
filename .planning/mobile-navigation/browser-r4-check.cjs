const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const evidence=__dirname;
const report={kind:'local-Chromium-with-mocked-API',checks:[],errors:[]};
const check=(name,data={})=>{report.checks.push({name,result:'pass',...data});console.log(name,JSON.stringify(data));};
async function fixture(context){
 await context.addInitScript(()=>{localStorage.setItem('accessToken','navigation-r4-fixture');localStorage.setItem('user',JSON.stringify({uniqueid:1,name:'Navigation test',login:'nav-test',level:1,vpbx_user_uid:7}));localStorage.setItem('i18nextLng','ru');localStorage.setItem('theme','dark');});
 await context.route('**/api/**',route=>{const u=new URL(route.request().url());if(!u.pathname.startsWith('/api/'))return route.continue();const data=u.pathname.includes('role-start')?{path:'/modules'}:u.pathname==='/api/settings'?{}:[];return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 await context.route('**/socket.io/**',route=>route.abort());
}
async function dimensions(page){return page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyPointer:getComputedStyle(document.body).pointerEvents}));}
(async()=>{
 const browser=await chromium.launch({headless:true});let page;
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});await fixture(context);page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:3017/settings/stt-engines',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByTestId('crumb-page').waitFor({timeout:60000});
  const selected=page.getByTestId('module-shell-sidebar').locator('a[aria-current=page]');assert.equal(await selected.count(),1);assert.equal(await selected.first().getAttribute('href'),'/settings/stt-engines');
  assert.match(await page.getByTestId('crumb-page').innerText(),/STT/);assert.ok(await page.locator('#shell-theme-toggle').getAttribute('aria-label'));check('desktop-nested-orientation-and-names');
  await page.getByTestId('crumb-module').click();const lastSection=page.getByTestId('crumb-module-menu').getByRole('menuitem').last();assert.equal(await lastSection.getAttribute('href'),'/modules');await page.keyboard.press('Escape');check('desktop-modules-last');
  await page.locator('#shell-cmdk-trigger').click();await page.getByRole('combobox').waitFor();const closeBounds=await page.getByTestId('command-palette').getByRole('button',{name:'Закрыть',exact:true}).boundingBox();assert.ok(closeBounds.width>=44&&closeBounds.height>=44);
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]')));
  await page.keyboard.press('Escape');await page.waitForTimeout(250);assert.ok(await page.locator('#shell-cmdk-trigger').evaluate(n=>document.activeElement===n));check('palette-real-dialog-focus-escape');
  await page.keyboard.press('Control+k');const input=page.getByRole('combobox');await input.waitFor();const n=await page.getByRole('option').count();assert.ok(n>20);
  await input.press('ArrowUp');
  const active=page.locator('[role=option][aria-selected=true]');
  await page.waitForFunction(()=>{const list=document.querySelector('[role=listbox]');const selected=list.querySelector('[aria-selected=true]');const a=list.getBoundingClientRect(),b=selected.getBoundingClientRect();return b.top>=a.top-1&&b.bottom<=a.bottom+1;});
  assert.equal(await input.getAttribute('aria-activedescendant'),await active.getAttribute('id'));check('palette-long-list-keyboard',{count:n});
  await input.fill('Абоненты');assert.equal(await page.getByRole('option').count(),1);assert.match(await page.getByRole('option').innerText(),/Абоненты/);check('first-page-alias');
  await input.fill('Транки');assert.equal(await page.getByRole('option').count(),1);await input.press('Enter');await page.waitForURL('**/trunks');check('global-search-cross-section');
  await page.getByTestId('crumb-module').click();await page.getByTestId('crumb-module-menu').getByRole('menuitem',{name:'Приложения',exact:true}).click();await page.waitForURL('**/ivrs');
  await page.getByTestId('crumb-module').click();const core=page.getByTestId('crumb-module-menu').getByRole('menuitem',{name:'PBX',exact:true});assert.equal(await core.getAttribute('href'),'/trunks');await core.click();await page.waitForURL('**/trunks');check('restore-last-canonical-page');
  for(const width of [320,360,390,640,767,768,820,1024,1280]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(100);const dims=await dimensions(page);assert.ok(dims.scrollWidth<=width,'document overflow at '+width);
   if(width<768){await page.getByTestId('mobile-bottom-bar').waitFor();assert.equal(await page.getByTestId('module-shell-sidebar').count(),0);assert.equal(await page.locator('#shell-cmdk-trigger').count(),1);}
   else {await page.getByTestId('module-shell-sidebar').waitFor();assert.equal(await page.getByTestId('mobile-bottom-bar').count(),0);assert.equal(await page.getByTestId('module-shell-sidebar').getAttribute('data-collapsed'),width<1024?'true':'false');}
   check('layout-'+width,dims);
  }
  await page.setViewportSize({width:820,height:900});await page.getByTestId('sidebar-collapse').click();assert.equal(await page.getByTestId('module-shell-sidebar').getAttribute('data-collapsed'),'false');
  await page.setViewportSize({width:1280,height:900});await page.setViewportSize({width:820,height:900});assert.equal(await page.getByTestId('module-shell-sidebar').getAttribute('data-collapsed'),'false');check('tablet-explicit-preference-survives-resize');
  await page.screenshot({path:path.join(evidence,'r4-tablet-820.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByTestId('bottom-bar-section-trigger').click();const pageMenu=page.getByTestId('bottom-bar-page-menu');await pageMenu.waitFor();assert.equal(await pageMenu.getByRole('link').count(),8);
  await page.screenshot({path:path.join(evidence,'r4-all-pages-390.png'),fullPage:true});
  await pageMenu.getByRole('link',{name:'Абоненты',exact:true}).click();await page.waitForURL('**/endpoints');assert.equal(await page.getByTestId('bottom-bar-page-menu').count(),0);check('all-pages-click-without-drag');
  await page.getByTestId('phone-module-menu-trigger').click();const menu=page.getByTestId('phone-module-menu');await menu.waitFor();assert.equal(await menu.getByRole('textbox').count(),0);assert.equal(await menu.locator('nav a').last().getAttribute('data-testid'),'phone-module-hub');
  assert.equal(await page.getByTestId('phone-module-ai').getAttribute('href'),'/modules?module=ai');assert.match(await page.getByTestId('phone-module-ai').innerText(),/Не подключён/);
  await page.screenshot({path:path.join(evidence,'r4-sections-390.png'),fullPage:true});
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]')));await page.keyboard.press('Escape');await page.waitForTimeout(250);assert.ok(await page.getByTestId('phone-module-menu-trigger').evaluate(n=>document.activeElement===n));check('section-sheet-focus-trap-escape');
  await page.getByTestId('phone-module-menu-trigger').click();await page.getByTestId('phone-module-ai').click();await page.waitForURL('**/modules?module=ai');const card=page.locator('[data-module-code=ai]');await card.waitFor();assert.equal(await card.getAttribute('data-selected'),'true');await page.waitForTimeout(250);assert.ok(await card.evaluate(n=>document.activeElement===n),'selected Hub card retains focus after section Sheet closes');assert.equal(await page.locator('a button').count(),0);check('targeted-unavailable-hub-no-nested-actions');
  await page.getByTestId('phone-module-menu-trigger').click();await page.getByTestId('phone-module-apps').click();await page.waitForURL('**/ivrs');
  await page.getByTestId('phone-module-menu-trigger').click();await page.getByTestId('phone-module-ai').click();await page.waitForURL('**/modules?module=ai');await page.waitForTimeout(300);assert.ok(await page.locator('[data-module-code=ai]').evaluate(n=>document.activeElement===n));check('warm-hub-target-focus-after-sheet');
  await page.goto('http://127.0.0.1:3017/moh',{waitUntil:'domcontentloaded'});await page.getByTestId('bottom-bar-page-moh').waitFor();const strip=page.getByTestId('bottom-bar-pages');await strip.evaluate(n=>n.scrollLeft=0);const bounds=await strip.boundingBox();
  for(let i=0;i<4;i++){await page.mouse.move(bounds.x+bounds.width-12,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+12,bounds.y+bounds.height/2,{steps:12});await page.mouse.up();assert.ok(page.url().endsWith('/moh'));}
  const last=page.getByTestId('bottom-bar-page-integrations');const lastBounds=await last.boundingBox();assert.ok(lastBounds.x>=bounds.x-1&&lastBounds.x+lastBounds.width<=bounds.x+bounds.width+1);check('mouse-drag-final-page-without-release-navigation');
  const popupPromise=context.waitForEvent('page');await last.click({modifiers:['Control']});const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.ok(popup.url().endsWith('/integrations'));await popup.close();assert.ok(page.url().endsWith('/moh'));check('modified-click-native-new-tab');
  await last.click();await page.waitForURL('**/integrations');check('ordinary-click-after-drag');
  await page.getByTestId('phone-module-menu-trigger').click();await page.setViewportSize({width:820,height:900});await page.waitForTimeout(300);assert.equal(await page.getByTestId('phone-module-menu').count(),0);assert.notEqual((await dimensions(page)).bodyPointer,'none');check('resize-open-sheet-cleans-modal-lock');
  await page.setViewportSize({width:390,height:844});await page.locator('#user-block-trigger').click();assert.equal(await page.locator('#user-block-profile').getAttribute('href'),'/profile');await page.locator('#shell-theme-toggle').click();check('mobile-profile-theme-action');await page.waitForTimeout(300);
  await page.screenshot({path:path.join(evidence,'r4-mobile-light-390.png'),fullPage:true});
  report.contrast=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d');
   const rgb=(color,bg)=>{ctx.clearRect(0,0,1,1);if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,1,1);}ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);};
   const lum=c=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
   const link=document.querySelector('[data-testid=bottom-bar-pages] a[aria-current=page]');const label=link.querySelector('span');const base=getComputedStyle(document.querySelector('[data-testid=mobile-bottom-bar]')).backgroundColor;const card=getComputedStyle(document.documentElement).getPropertyValue('--color-card');
   const bg=rgb(getComputedStyle(link).backgroundColor,card);const fg=rgb(getComputedStyle(label).color);const a=lum(fg),b=lum(bg);return{theme:document.documentElement.className,foreground:fg,background:bg,base,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};
  });
  assert.ok(report.contrast.ratio >= 4.5, 'active label contrast below 4.5:1');
  check('light-active-label-contrast-passed',report.contrast);
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await fixture(touch);const touchPage=await touch.newPage();await touchPage.goto('http://127.0.0.1:3017/moh',{waitUntil:'domcontentloaded'});const touchStrip=touchPage.getByTestId('bottom-bar-pages');await touchStrip.waitFor();await touchStrip.evaluate(n=>n.scrollLeft=0);const b=await touchStrip.boundingBox();const cdp=await touch.newCDPSession(touchPage);const x=b.x+b.width-20,y=b.y+b.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*18,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touchPage.waitForFunction(()=>document.querySelector('[data-testid=bottom-bar-pages]').scrollLeft>20);check('native-touch-swipe');await touch.close();
 }catch(error){report.failure=String(error);if(page)await page.screenshot({path:path.join(evidence,'r4-browser-failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{await fs.writeFile(path.join(evidence,'browser-r4-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
