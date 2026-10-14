'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const report={kind:'Chromium real frontend with mocked API; not live backend',checks:[],errors:[]};
const registry=fs.readFileSync(path.join(__dirname,'../../packages/frontend/src/features/modules/lib/moduleRegistry.ts'),'utf8');
const codes=[...new Set([...registry.matchAll(/\bcode: '([^']+)'/g)].map(m=>m[1]))];
const catalog=codes.map(code=>({code,kind:'base',licenseStatus:'active',tenantVisible:true,sort_order:1,pages:(code==='overview'?[['dashboard','/']]:code==='core'?[['endpoints','/endpoints'],['trunks','/trunks']]:code==='analytics'?[['cdr','/reports/cdr']]:code==='system'?[['settings','/settings'],['tenant_modules','/tenant/modules']]:[]).map(([page_code,route])=>({page_code,path:route,sort_order:1}))}));
const source={state:'ok',updatedAt:new Date().toISOString()};
const totals={total:100000,incoming:40000,outgoing:35000,internal:25000,external:0,accepted:38000,missed:1800,unknown:200};
const from=new Date(Date.now()-24*3600000).toISOString(),to=new Date().toISOString();
const longPlanName='КорпоративныйТарифДляБольшойОрганизации'.repeat(4).slice(0,128);
const denseBuckets=Array.from({length:300},(_,index)=>{
 const quiet=index>=100&&index<200,activeIndex=index<100?index:index-100;
 return {at:new Date(Date.parse(from)+index*(Date.parse(to)-Date.parse(from))/300).toISOString(),until:index===299?to:new Date(Date.parse(from)+(index+1)*(Date.parse(to)-Date.parse(from))/300).toISOString(),...Object.fromEntries(Object.entries(totals).map(([key,amount])=>[key,quiet?0:Math.floor(amount*(activeIndex+1)/200)-Math.floor(amount*activeIndex/200)]))};
});
for(const key of Object.keys(totals))assert.equal(denseBuckets.reduce((sum,bucket)=>sum+bucket[key],0),totals[key],'Dense fixture preserves business counts '+key);
const node={id:'asterisk-main',label:'Сервер телефонии',role:'asterisk',source,current:{at:source.updatedAt,cpu:61.2,memory:72.5,load:4.12,uptime:345600,networkRx:12000000,networkTx:24000000,disks:[{mount:'/',usedPercent:81.2,availableBytes:100*1024**3}]}};
const overview=(mode,stress=false)=>({deploymentMode:mode,version:'fixture-1',period:{from,to,timezone:'Asia/Krasnoyarsk'},live:{activeCalls:1000,ringing:120,talking:830,waiting:50,endpoints:{total:10000,online:9860,unknown:40},trunks:{total:100,online:98,unknown:0},source,callsSource:source,inventorySource:source},totals,buckets:denseBuckets,historySource:source,warnings:[{code:'trunksOffline',severity:'critical',count:2,target:'trunks'}],warningCount:1,...mode==='cloud'?{cloud:{source,usageSource:source,planName:stress?longPlanName:'Корпоративный',expiresAt:'2027-01-01T00:00:00Z',balanceKopecks:stress?900000000000000:12500000,creditLimitKopecks:5000000,blocked:false,limits:{extensions:15000,trunks:150,queues:100,concurrentCalls:1200},usage:{extensions:10000,trunks:100,queues:50,concurrentCalls:1000}}}:{system:[node,{...node,id:'application',label:'Сервер приложения',role:'application'}]}});
const pageRows=kind=>({rows:Array.from({length:50},(_,i)=>kind==='calls'?{id:String(i).padStart(64,'0'),linkedid:'L'+i,startedAt:from,endedAt:to,src:'79990000000',dst:'101',direction:'in',origin:'telephony',outcome:'missed',reason:'noAnswer',duration:15}:{id:'e'+(101+i)+'_91',name:'Абонент '+(101+i),status:'offline',enabled:true}),total:kind==='calls'?1800:kind==='endpoints'?10000:2,nextCursor:'fixture-cursor',version:'fixture-1',source});
async function assertMetricBounds(page,label){
 const metrics=await page.getByTestId('dashboard-metric').evaluateAll(nodes=>nodes.map(node=>{
   const box=node.getBoundingClientRect(),style=getComputedStyle(node);
   const left=box.left+parseFloat(style.paddingLeft)+parseFloat(style.borderLeftWidth),right=box.right-parseFloat(style.paddingRight)-parseFloat(style.borderRightWidth);
   const texts=[...node.querySelectorAll('span')].map(text=>{
     const range=document.createRange();range.selectNodeContents(text);
     const rectangles=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
     return {text:text.textContent,inside:rectangles.every(rect=>rect.left>=left-1.5&&rect.right<=right+1.5),scrollWidth:text.scrollWidth,clientWidth:text.clientWidth,ellipsis:getComputedStyle(text).textOverflow==='ellipsis'};
   });
   return {title:node.getAttribute('aria-label'),texts};
 }));
 for(const metric of metrics)for(const text of metric.texts){assert.ok(text.inside,label+' text outside metric '+metric.title+': '+text.text);assert.ok(text.scrollWidth<=text.clientWidth+2,label+' metric text overflow: '+metric.title);assert.equal(text.ellipsis,false,label+' no metric ellipsis');}
}
async function assertDenseChart(page,width){
 const selector=page.getByRole('combobox',{name:'Интервал детализации',exact:true});
 const options=await selector.locator('option').evaluateAll(nodes=>nodes.filter(node=>node.value).map(node=>({at:node.value,label:node.textContent})));
 const count=Math.min(300,width<768?24:96);assert.equal(options.length,count,'Responsive chart interval count');
 for(let index=0;index<count;index++){assert.equal(options[index].at,denseBuckets[Math.floor(index*300/count)].at,'Every source interval covered in order');assert.ok(options[index].label.includes(' → '),'Selector describes both exact interval boundaries');}
 const quietOptions=options.filter((_,index)=>denseBuckets.slice(Math.floor(index*300/count),Math.floor((index+1)*300/count)).every(bucket=>bucket.total===0));
 assert.ok(quietOptions.length>0,'Quiet hours remain visible as selectable temporal intervals');
 const rectangles=await page.getByTestId('dashboard-chart').first().locator('.recharts-bar-rectangle').count();
 assert.ok(rectangles<=(count*3)&&rectangles>=(count-quietOptions.length)*3,'Bounded readable bars preserve zero-height quiet intervals');
}

const check=(name,data={})=>{report.checks.push({name,result:'pass',...data});console.log(name,JSON.stringify(data));};
(async()=>{let browser,page;try{
 browser=await chromium.launch({headless:true});
 for(const mode of ['box','cloud'])for(const theme of ['dark','light'])for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});let details=0,overviewCalls=0,fail=false,stress=false;const requested=[];
  await context.addInitScript(({theme})=>{localStorage.setItem('accessToken','dashboard-browser-fixture');localStorage.setItem('user',JSON.stringify({uniqueid:1,name:'Administrator',login:'fixture',level:1,vpbx_user_uid:91}));localStorage.setItem('i18nextLng','ru');localStorage.setItem('theme',theme);},{theme});
  await context.route('**/api/**',async route=>{const url=new URL(route.request().url());if(!url.pathname.startsWith('/api/'))return route.continue();requested.push(url.pathname+url.search);let data=[];
   if(url.pathname.endsWith('/dashboard/overview')){overviewCalls++;if(fail)return route.fulfill({status:503,contentType:'application/json',body:'{}'});data=overview(mode,stress);}
   else if(/\/dashboard\/(calls|endpoints|trunks)$/.test(url.pathname)){details++;data=pageRows(url.pathname.split('/').at(-1));}
   else if(url.pathname.endsWith('/dashboard/system'))data={nodes:[node],history:Array.from({length:20},(_,i)=>({at:new Date(Date.parse(from)+i*3600000).toISOString(),cpu:45+i,cpuMax:80,memory:70,memoryMax:76}))};
   else if(/\/reports\/cdr\/[^/]+\/timeline$/.test(url.pathname))data={legs:[],events:[]};
   else if(url.pathname.endsWith('/hub-catalog'))data=catalog;else if(url.pathname.includes('role-start'))data={path:'/',callCenterEnabled:false};else if(url.pathname.includes('/settings'))data={};else if(/\/me(?:$|\/)|my-agent|self/.test(url.pathname))data=null;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });await context.route('**/socket.io/**',r=>r.abort());page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:3018/',{waitUntil:'domcontentloaded',timeout:60000});await page.getByTestId('dashboard-responsive').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Пропущенные входящие',exact:true}).waitFor({timeout:60000});assert.equal(details,0,'Overview must not eagerly fetch details');
  await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  const domNodes=await page.locator('*').count();assert.ok(domNodes<4000,'Bounded DOM');assert.ok(!requested.some(p=>/^\/api\/(endpoints|trunks)(?:\?|$)/.test(p)),'No full PBX list API on overview');
  await assertMetricBounds(page,mode+'-'+theme+'-'+width);await assertDenseChart(page,width);
  await page.screenshot({path:path.join(__dirname,`dashboard-${mode}-${theme}-${width}.png`),fullPage:true});
  const metric=page.getByRole('button',{name:'Пропущенные входящие',exact:true});await metric.focus();await page.keyboard.press('Enter');await page.getByTestId('dashboard-detail-rows').waitFor({timeout:30000});await page.waitForFunction(()=>document.querySelector('[data-testid=dashboard-detail-rows]')?.children.length===50);
  assert.equal(await page.getByTestId('dashboard-detail-rows').locator(':scope > *').count(),50);assert.ok(requested.some(p=>p.includes('/dashboard/calls')&&p.includes('outcome=missed')&&p.includes('direction=in')&&p.includes('limit=50')));
  assert.ok(await page.getByRole('dialog').evaluate(n=>n.contains(document.activeElement)),'Focus inside sheet');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No detail overflow');
  if(width===390&&theme==='dark'){
    assert.ok(!requested.some(url=>/\/reports\/cdr\/[^/]+\/timeline(?:\?|$)/.test(url)),'Call record timeline is lazy');
    const records=page.getByRole('dialog').getByRole('button',{name:'Участки и запись звонка',exact:true});await records.first().click();
    const recordDialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Детализация звонка',exact:true})});await recordDialog.waitFor();await page.waitForTimeout(150);
    assert.ok(requested.some(url=>url.includes('/reports/cdr/L0/timeline')),'Opening a record fetches only selected call timeline');
    await page.keyboard.press('Escape');await recordDialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),1,'Closing a record preserves the dashboard panel');
    await page.screenshot({path:path.join(__dirname,`dashboard-detail-${mode}.png`),fullPage:true});
  }
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.ok(await metric.evaluate(n=>n===document.activeElement),'Focus returns to metric');
  if(width===390&&theme==='dark'){
    await page.getByTestId('dashboard-chart').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,`dashboard-dense-quiet-${mode}-390.png`),fullPage:true});
    const graphSelect=page.getByRole('combobox',{name:'Интервал детализации',exact:true});await graphSelect.scrollIntoViewIfNeeded();await graphSelect.selectOption({index:1});await page.getByRole('combobox',{name:'Показатель интервала',exact:true}).selectOption('incoming');
    await page.getByRole('button',{name:'Показать звонки',exact:true}).click();await page.getByTestId('dashboard-detail-rows').waitFor();await page.waitForTimeout(150);assert.ok(requested.some(p=>{const url=new URL(p,'http://fixture');return url.pathname.endsWith('/dashboard/calls')&&url.searchParams.get('direction')==='in'&&url.searchParams.get('from')===denseBuckets[0].at&&url.searchParams.get('to')===denseBuckets[12].at;}),'Graph drill uses complete displayed interval');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
    await graphSelect.selectOption(denseBuckets[112].at);await page.getByRole('button',{name:'Показать звонки',exact:true}).click();await page.getByTestId('dashboard-detail-rows').waitFor();await page.waitForTimeout(150);
    assert.ok(requested.some(p=>{const url=new URL(p,'http://fixture');return url.pathname.endsWith('/dashboard/calls')&&url.searchParams.get('from')===denseBuckets[112].at&&url.searchParams.get('to')===denseBuckets[124].until;}),'Quiet graph group retains its full zero-call interval');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
    if(mode==='box'){
      const button=page.getByRole('button',{name:'Все показатели',exact:true});await button.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'dashboard-box-resources-390.png'),fullPage:true});await button.click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Интервал истории',exact:true}).waitFor();await dialog.getByRole('combobox',{name:'Интервал истории',exact:true}).selectOption('7d');await page.waitForTimeout(300);assert.ok(requested.some(p=>p.includes('/dashboard/system')&&p.includes('range=7d')));await page.screenshot({path:path.join(__dirname,'dashboard-system-detail-390.png'),fullPage:true});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    }else{
      const plan=page.getByRole('button',{name:'Тариф',exact:true});await plan.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'dashboard-cloud-plan-390.png'),fullPage:true});await plan.click();await page.getByRole('dialog').getByText('Корпоративный',{exact:true}).waitFor();await page.screenshot({path:path.join(__dirname,'dashboard-cloud-detail-390.png'),fullPage:true});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      stress=true;await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.waitForFunction(expected=>document.querySelector('[data-testid="dashboard-metric"][aria-label="Тариф"] [data-testid="dashboard-metric-value"]')?.textContent===expected,longPlanName);
      await assertMetricBounds(page,'cloud-390-long-plan-and-large-balance');assert.equal(longPlanName.length,128);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No stress metric page overflow');
      await page.getByRole('button',{name:'Баланс',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'dashboard-cloud-long-plan-390.png'),fullPage:true});
      await plan.click();const stressDialog=page.getByRole('dialog');const stressTitle=stressDialog.getByText(longPlanName,{exact:true});await stressTitle.waitFor();
      assert.ok(await stressTitle.evaluate(text=>{
        const dialog=text.closest('[role=dialog]'),range=document.createRange();range.selectNodeContents(text);
        const box=dialog.getBoundingClientRect(),style=getComputedStyle(dialog),left=box.left+parseFloat(style.paddingLeft),right=box.right-parseFloat(style.paddingRight);
        return [...range.getClientRects()].filter(rect=>rect.width>0).every(rect=>rect.left>=left-1.5&&rect.right<=right+1.5)&&getComputedStyle(text).textOverflow!=='ellipsis';
      }),'Long plan detail glyphs stay inside dialog');
      assert.ok(await stressDialog.evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+2),'Large billing detail has no horizontal overflow');
      await page.screenshot({path:path.join(__dirname,'dashboard-cloud-long-detail-390.png'),fullPage:true});await page.keyboard.press('Escape');await stressDialog.waitFor({state:'hidden'});
      check('cloud 390px 128-character plan and large balance preserve full overview/detail text');
    }
    // The full sections retain filters and stay on bounded dashboard APIs.
    await page.goto('http://127.0.0.1:3018/reports/cdr?dashboard=1&period=custom&from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to)+'&direction=in&outcome=missed',{waitUntil:'domcontentloaded'});await page.getByTestId('dashboard-journal').waitFor();await page.getByTestId('dashboard-detail-rows').waitFor();await page.waitForTimeout(200);assert.ok(requested.at(-1).includes('/dashboard/calls'));
    await page.goto('http://127.0.0.1:3018/endpoints?dashboard=1&status=offline&search=101',{waitUntil:'domcontentloaded'});await page.getByTestId('dashboard-journal').waitFor();await page.getByTestId('dashboard-detail-rows').waitFor();await page.waitForTimeout(200);assert.ok(requested.some(p=>p.includes('/dashboard/endpoints')&&p.includes('status=offline')&&p.includes('search=101')));
    await page.goto('http://127.0.0.1:3018/trunks?dashboard=1&status=offline',{waitUntil:'domcontentloaded'});await page.getByTestId('dashboard-journal').waitFor();await page.getByTestId('dashboard-detail-rows').waitFor();assert.ok(!requested.some(p=>/^\/api\/(endpoints|trunks)(?:\?|$)/.test(p)));check(mode+' graph interval / mode details / exact full-section filters');
  }
  if(width===1280&&theme==='light'){
    fail=true;await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.waitForTimeout(1500);assert.ok(await page.getByRole('button',{name:'Пропущенные входящие',exact:true}).isVisible(),'Latest successful overview remains visible on refresh failure');
  }
  check(`${mode}-${theme}-${width} bounded overview + lazy50 + keyboard sheet + mobile`,{domNodes,details,overviewCalls});await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('ALL_BROWSER_CHECKS_PASSED',report.checks.length);
 }catch(e){report.failure=String(e.stack||e);console.error(report.failure);process.exitCode=1;if(page)await page.screenshot({path:path.join(__dirname,'browser-failure.png'),fullPage:true}).catch(()=>{});}finally{fs.writeFileSync(path.join(__dirname,'browser-report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();}})();
