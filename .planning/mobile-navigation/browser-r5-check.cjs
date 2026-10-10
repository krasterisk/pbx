const {chromium}=require('playwright');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const report={kind:'local-Chromium-with-mocked-API',checks:[],errors:[]};
const check=(name,data={})=>{report.checks.push({name,result:'pass',...data});console.log(name,JSON.stringify(data));};
(async()=>{const browser=await chromium.launch({headless:true});let page;
try {for(const theme of ['dark','light']){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(theme=>{localStorage.setItem('accessToken','r5-fixture');localStorage.setItem('user',JSON.stringify({uniqueid:1,name:'Navigation test',login:'test',level:1,vpbx_user_uid:7}));localStorage.setItem('i18nextLng','ru');localStorage.setItem('theme',theme);},theme);
 await context.route('**/api/**',route=>{const u=new URL(route.request().url());if(!u.pathname.startsWith('/api/'))return route.continue();const codes=['callcenter','autodial','analytics','speech_analytics','ai-robots'];const data=u.pathname.includes('hub-catalog')?[...codes.map(code=>({code,licenseStatus:'active'})),{code:'ai',licenseStatus:'locked'}]:u.pathname.includes('role-start')?{path:'/modules'}:u.pathname.includes('settings')?{}:/\/me(?:$|\/)|my-agent|self/.test(u.pathname)?null:[];return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 await context.route('**/socket.io/**',route=>route.abort());page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:3017/settings/stt-engines',{waitUntil:'domcontentloaded',timeout:60000});const trigger=page.getByTestId('phone-module-menu-trigger');await trigger.waitFor({timeout:60000});await trigger.click();const menu=page.getByTestId('phone-module-menu');await menu.waitFor();
 assert.equal(await page.getByTestId('phone-module-system').getAttribute('aria-expanded'),'true');assert.equal(await menu.locator('a[aria-current=page]').count(),1);assert.equal(await menu.locator('a[aria-current=page]').getAttribute('href'),'/settings/stt-engines');assert.equal(await menu.getByRole('textbox').count(),0);check(theme+'-current-section-and-nested-page');
 const before=page.url();await page.getByTestId('phone-module-core').click();assert.equal(page.url(),before);assert.equal(await page.getByTestId('phone-module-system').getAttribute('aria-expanded'),'true');assert.equal(await page.getByTestId('phone-module-core').getAttribute('aria-expanded'),'true');await page.getByTestId('phone-module-page-core-trunks').waitFor();check(theme+'-independent-expansion-no-navigation');
 const popupPromise=context.waitForEvent('page');await page.getByTestId('phone-module-page-core-trunks').click({modifiers:['Control']});const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.ok(popup.url().endsWith('/trunks'));await popup.close();assert.equal(page.url(),before);assert.equal(await menu.count(),1);check(theme+'-native-modified-page-link');
 await page.getByTestId('phone-module-page-core-trunks').click();await page.waitForURL('**/trunks');assert.equal(await menu.count(),0);await trigger.click();assert.equal(await page.getByTestId('phone-module-core').getAttribute('aria-expanded'),'true');assert.equal(await page.getByTestId('phone-module-page-core-trunks').getAttribute('aria-current'),'page');check(theme+'-selected-page-closes-and-reopens-current');
 const apps=page.getByTestId('phone-module-apps');await apps.focus();await page.keyboard.press('Enter');assert.equal(await apps.getAttribute('aria-expanded'),'true');await page.keyboard.press('Space');assert.equal(await apps.getAttribute('aria-expanded'),'false');assert.equal(await menu.getByRole('link',{name:'Интеграции',exact:true}).count(),0);check(theme+'-keyboard-hidden-page-semantics');
 await page.keyboard.press('Escape');await page.waitForTimeout(250);assert.ok(await trigger.evaluate(n=>document.activeElement===n));check(theme+'-escape-focus-restoration');
 for(const width of [320,390,767]){
  await page.setViewportSize({width,height:width===320?640:844});await trigger.click();
  for(const toggle of await menu.locator('nav button[aria-controls]').all())if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.waitForTimeout(250);
  const dims=await menu.locator('nav').evaluate(n=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,listWidth:n.clientWidth,listScrollWidth:n.scrollWidth,listHeight:n.clientHeight,listScrollHeight:n.scrollHeight}));
  assert.ok(dims.documentWidth<=width);assert.ok(dims.listScrollWidth<=dims.listWidth+1);assert.ok(dims.listScrollHeight>dims.listHeight);const bounds=await menu.boundingBox();assert.ok(bounds.width<width);
  for(const item of await menu.locator('nav a:visible, nav button:visible').all()){const b=await item.boundingBox();assert.ok(b.height>=43.5);}
  assert.equal(await menu.locator('nav a').last().getAttribute('data-testid'),'phone-module-hub');assert.equal(await page.getByTestId('phone-module-ai').getAttribute('href'),'/modules?module=ai');assert.equal(await menu.locator('a[href="/ai-agents"]').count(),0);
  await page.getByTestId('phone-module-hub').scrollIntoViewIfNeeded();assert.ok(await page.getByTestId('phone-module-hub').isVisible());check(theme+'-full-menu-scroll-'+width,dims);
  if(width===390){await menu.locator('nav').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(__dirname,'r5-expanded-'+theme+'-390.png'),fullPage:true});}
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
 }
 await context.close();
}assert.deepEqual(report.errors,[]);
}catch(e){report.failure=String(e);if(page)await page.screenshot({path:path.join(__dirname,'r5-browser-failure.png'),fullPage:true}).catch(()=>{});throw e;}
finally{await browser.close();await fs.writeFile(path.join(__dirname,'browser-r5-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
