const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createServer}=require('./page-builder-server.cjs'),Items=require('../item-model.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const directory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'scav-items-shell-'));
 const server=createServer({itemMode:true,directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/api/items')).status,403);
  const session=await (await fetch(base+'/api/session')).json(),headers={'X-Scav-Session':session.token};
  assert.equal((await fetch(base+'/api/items',{headers:{...headers,Origin:'https://elsewhere.test'}})).status,403);
  assert.equal((await fetch(base+'/api/items',{method:'POST',headers})).status,403);
  assert.equal((await fetch(base+'/api/vendors',{headers})).status,404);
  assert.equal((await fetch(base+'/data/items.json')).status,404);
  const real=await (await fetch(base+'/api/items',{headers})).json();assert.equal(real.catalogue.data.length,JSON.parse(fs.readFileSync(path.join(root,'data/items.json'))).data.length);
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage(),errors=[],writes=[];
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
  await page.route('**/api/items',r=>r.fulfill({status:503,json:{error:'test'}}));await page.goto(base);await page.locator('#retry').waitFor();assert.equal(await page.locator('#workspace').isVisible(),false);
  await page.unroute('**/api/items');await page.locator('#retry').click();await page.locator('#workspace').waitFor();
  assert.deepEqual((await page.locator('#count').innerText()).split(' · '),['285 total','285 match current filters','showing 40']);
  if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});for(const width of [320,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'items-real-'+width+'.png'),fullPage:true});}}
  assert.equal(await page.locator('.item-choice').count(),40);await page.locator('#more').click();assert.equal(await page.locator('.item-choice').count(),80);
  await page.getByLabel('Search items',{exact:true}).fill(real.catalogue.data[150].id);assert.equal(await page.locator('.item-choice').count(),1);assert.equal(await page.locator('#item-name').innerText(),real.catalogue.data[150].name);
  await page.getByLabel('Search items',{exact:true}).fill('no-such-item-zzzz');assert.equal(await page.locator('#detail').isVisible(),false);
  assert.deepEqual((await page.locator('#count').innerText()).split(' · '),['285 total','0 match current filters','showing 0']);
  const fixture={catalogue:Items.foundation({schemaVersion:1,data:[{id:'one',name:'Same name',category:'Medical',properties:{health:null,quantity:0},source:{status:'screenshot-verified',file:'evidence-inbox/test.png'},image:'images/missing.png',description:'<img src=x onerror=alert(1)>'},{id:'two',name:'Same name',category:'Legacy category',hidden:true},{id:'three',name:'Archived item',archived:true}]}),categories:Items.categories,settings:real.settings};
  await page.route('**/api/items',r=>r.fulfill({json:fixture}));await page.reload();await page.locator('#workspace').waitFor();assert.equal(await page.locator('.item-choice').count(),1);assert.equal(await page.locator('.item-choice').first().getAttribute('data-id'),'one');
  await page.getByLabel('Category',{exact:true}).selectOption('value:Medical');assert.equal(await page.locator('.item-choice').count(),1);await page.getByText('Image unavailable.',{exact:false}).waitFor();assert.equal(await page.locator('#facts img').count(),0);
  await page.getByLabel('Category',{exact:true}).selectOption('value:Legacy category');assert.equal(await page.locator('.item-choice').count(),0);
  await page.getByLabel('Category',{exact:true}).selectOption('all');await page.getByLabel('Item state',{exact:true}).selectOption('archived');assert.equal(await page.locator('#item-name').innerText(),'Archived item');
  await page.getByLabel('Item state',{exact:true}).selectOption('hidden');assert.equal(await page.locator('.item-choice').count(),1);assert.equal(await page.locator('.item-choice').first().getAttribute('data-id'),'two');await page.locator('.item-choice').first().click();assert.equal(await page.locator('#item-name').innerText(),'Same name');assert.equal(await page.locator('#item-state').innerText(),'Hidden item');
  const technical=page.locator('#facts details');assert.equal(await technical.locator('summary').innerText(),'Advanced / Technical details');assert.equal(await technical.evaluate(details=>details.open),false);await technical.locator('summary').click();assert.match(await technical.innerText(),/Permanent reference: two/);
  await page.getByLabel('Item state',{exact:true}).selectOption('active');await page.locator('.item-choice').first().click();
  for(const width of [280,320,390,768,1280]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
   for(const h of await page.locator('#workspace button:visible,#workspace input:visible,#workspace select:visible').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert(h>=44);
    await page.locator('#item-evidence').focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').getByRole('link',{name:'Open full-size screenshot'}).getAttribute('href'),'/evidence-inbox/test.png');
   await page.keyboard.press('Tab');assert(await page.getByRole('dialog').evaluate(d=>d.contains(document.activeElement)));assert(await page.getByRole('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'item-evidence');
   await page.locator('#item-verification').click();assert.match(await page.getByRole('dialog').innerText(),/No dated verification history/);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(await page.locator('#item-edit').isEnabled(),true);
   if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'items-'+width+'.png'),fullPage:true});}
  }
  await page.unroute('**/api/items');let release;const waiting=new Promise(r=>release=r);await page.route('**/api/items',async r=>{await waiting;await r.fulfill({json:{...fixture,catalogue:Items.foundation({schemaVersion:1,data:[]})}});});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('status').getAttribute('aria-busy')==='true');assert.equal(await page.locator('#workspace').isVisible(),false);release();await page.locator('#workspace').waitFor();
  assert.deepEqual((await page.locator('#count').innerText()).split(' · '),['0 total','0 match current filters','showing 0']);
  await page.unroute('**/api/items');await page.route('**/api/items',r=>r.fulfill({json:{bad:'payload'}}));await page.reload();await page.locator('#retry').waitFor();assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  // Exercise the unchanged public page with local assets and all external traffic blocked.
  const publicPage=await context.newPage();await publicPage.route('http://public.test/**',r=>{
   const file=path.resolve(root,'.'+new URL(r.request().url()).pathname);
   return file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});
  });
  const publicErrors=[];publicPage.on('pageerror',e=>publicErrors.push(e.message));await publicPage.goto('http://public.test/items.html');await publicPage.locator('.category-card').first().waitFor();
  assert.equal(await publicPage.locator('.item-card').count(),real.catalogue.data.length);await publicPage.locator('#item-search').fill('Special FMJ Ammo');assert((await publicPage.locator('.item-card').count())>=1);
  await publicPage.locator('#item-search').fill('no-such-item-zzzz');assert.equal(await publicPage.locator('.item-card').count(),0);await publicPage.locator('#item-search').fill('');
  await publicPage.locator('#verified-only').click();assert.equal(await publicPage.locator('#verified-only').getAttribute('aria-pressed'),'true');await publicPage.locator('#needs-review').click();assert.equal(await publicPage.locator('#verified-only').getAttribute('aria-pressed'),'false');assert.deepEqual(publicErrors,[]);
  console.log('PASS Items shell: local session routes, loading/error/retry/empty/malformed states, all records/search/filter/pagination, duplicate names, legacy categories, hidden/archive views, safe text/missing images, shared evidence/verification dialogs, keyboard/focus and 280–1280px layouts. Public Items count/search/verification regression passed.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
