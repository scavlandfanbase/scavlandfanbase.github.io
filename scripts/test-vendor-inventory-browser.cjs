const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,createStore}=require('./page-builder-server.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-inventory-ui-')),server=createServer({directory,vendorMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage(),errors=[];
  const base='http://127.0.0.1:'+server.address().port;await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  const dialog=()=>page.locator('dialog').last(),submit=async()=>{await dialog().locator('button[type=submit]').click();await page.locator('dialog').waitFor({state:'hidden'});};
  const cards=()=>page.locator('.inventory-card');
  const open=async p=>{await p.goto(base);await p.locator('#workspace').waitFor();await p.locator('#vendor-inventory').click();await p.locator('#inventory-add').waitFor();await p.locator('#inventory-add:not(:disabled)').waitFor();};
  await page.goto(base);await page.locator('#workspace').waitFor();
  await page.route('**/api/vendor-catalog',r=>r.fulfill({status:503,json:{error:'Catalogue test failure'}}));await page.locator('#vendor-inventory').click();await page.getByText('Could not load catalogue. Catalogue test failure').waitFor();assert(await page.locator('#inventory-add').isDisabled());
  await page.unroute('**/api/vendor-catalog');await page.locator('#inventory-retry').click();await page.locator('#inventory-add:not(:disabled)').waitFor();assert.equal(await cards().count(),0);
  const data=createStore(directory,{vendorMode:true}).catalog(),ammo=data.entities.ammo[0];
  async function add(type,id){await page.locator('#inventory-add').click();await dialog().locator('[name=entityType]').selectOption(type);await dialog().locator('[name=search]').fill(id);await dialog().locator('.inventory-results button').first().click();await submit();}
  await page.locator('#inventory-add').click();await dialog().locator('[name=entityType]').selectOption('attachment');await dialog().getByText('No dedicated attachment catalogue is available. No records have been inferred.').waitFor();assert(await dialog().locator('button[type=submit]').isDisabled());await page.keyboard.press('Escape');if(await page.locator('dialog').count())await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'inventory-add');
  await add('ammo',ammo.id);assert((await cards().first().innerText()).includes('Rank Not recorded · Not recorded₽ · Stock Not recorded'));
  await add('item',ammo.id);assert.equal(await cards().count(),2); // Same name/ID is explicitly distinguished by namespace.
  await page.locator('#inventory-add').click();await dialog().locator('[name=entityType]').selectOption('ammo');await dialog().locator('[name=search]').fill(ammo.id);assert(await dialog().locator('.inventory-results button').first().isDisabled());await page.keyboard.press('Escape');
  let card=page.locator('.inventory-card[data-entity-type=ammo]'),listingId=await card.getAttribute('data-listing-id');
  await card.locator('[data-action=edit]').click();await dialog().locator('[name=rank]').fill('0');await dialog().locator('[name=price]').fill('450');await dialog().locator('[name=quantity]').fill('3');await dialog().getByLabel('Note state',{exact:true}).selectOption('text');await dialog().locator('[name=notes]').fill('<img onerror=alert(1)> Vendor note');
  await page.route('**/api/vendors',r=>r.request().method()==='POST'?r.fulfill({status:503,json:{error:'Simulated inventory failure'}}):r.continue());
  await dialog().locator('button[type=submit]').click();await dialog().getByText('Simulated inventory failure').waitFor();assert.equal(await dialog().locator('[name=price]').inputValue(),'450');await page.unroute('**/api/vendors');await submit();assert((await card.innerText()).includes('Rank 0 · 450₽ · Stock 3'));assert.equal(await card.locator('img').count(),0);
  await card.locator('[data-action=edit]').click();await dialog().locator('[name=quantity]').fill('');await submit();assert((await card.innerText()).includes('Stock Not recorded'));
  const movedId=await cards().first().getAttribute('data-listing-id');await cards().first().locator('[data-action=down]').click();await page.locator('#inventory-status').filter({hasText:'Saved'}).waitFor();assert.equal(await cards().last().getAttribute('data-listing-id'),movedId);
  await card.locator('[data-action=verification]').click();await dialog().getByText('No listing verification history yet.').waitFor();await page.keyboard.press('Escape');
  await card.locator('[data-action=archive]').click();await submit();assert.equal(await cards().count(),1);await page.locator('#inventory-archived').check();await card.locator('[data-action=restore]').click();await page.locator('#inventory-status').filter({hasText:'Saved'}).waitFor();await card.locator('[data-action=edit]').waitFor();
  const second=await context.newPage();await open(second);await card.locator('[data-action=edit]').click();await dialog().locator('[name=price]').fill('451');await submit();
  await second.locator('.inventory-card').first().locator('[data-action=edit]').click();await second.getByLabel('Note state',{exact:true}).selectOption('text');await second.locator('[name=notes]').fill('Preserved stale note');await second.locator('dialog button[type=submit]').click();await second.locator('dialog [role=alert]').filter({hasText:'Vendors changed in another window'}).waitFor();assert.equal(await second.locator('[name=notes]').inputValue(),'Preserved stale note');await second.keyboard.press('Escape');await second.keyboard.press('Escape');await second.locator('#retry').click();await second.locator('#workspace').waitFor();await second.close();
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const h of await page.locator('#inventory-workspace button:visible').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert(h>=44);
   await page.locator('#inventory-add').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert(await dialog().evaluate(d=>d.contains(document.activeElement)));assert(await dialog().evaluate(d=>d.scrollWidth<=d.clientWidth));
   if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'inventory-picker-'+width+'.png'),fullPage:true});}
   await page.keyboard.press('Escape');if(await page.locator('dialog').count())await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'inventory-add');
   if(process.env.SCAVLAND_TEST_OUTPUT)await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'inventory-'+width+'.png'),fullPage:true});
  }
  await page.reload();await page.locator('#workspace').waitFor();await page.locator('#vendor-inventory').click();await cards().first().waitFor();assert.equal(await cards().count(),2);
  card=page.locator('[data-listing-id="'+listingId+'"]');await card.locator('[data-action=remove]').click();await submit();assert.equal(await cards().count(),1);
  assert.equal(createStore(directory,{vendorMode:true}).catalog().entities.ammo[0].id,ammo.id);
  await page.locator('[name=vendor]').selectOption({index:1});assert.equal(await cards().count(),0);
  assert.deepEqual(errors,[]);console.log('PASS inventory browser: search/type/source selection, duplicate guard, missing catalog/retry, unknown/zero edits, save retry, conflict/reload, reorder/archive/restore/remove, verification, vendor isolation, safe text, persistence, keyboard and 320–1280px layouts');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
