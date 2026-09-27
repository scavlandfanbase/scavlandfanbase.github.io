const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./page-builder-server.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-vendor-ui-')),server=createServer({directory,vendorMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage(),errors=[];
  const base='http://127.0.0.1:'+server.address().port;await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  const dialog=()=>page.locator('dialog').last(),submit=async()=>{await dialog().locator('button[type=submit]').click();await page.locator('dialog').waitFor({state:'hidden'});};
  const more=async(name)=>{await page.locator('#vendor-more').click();await dialog().getByRole('button',{name,exact:true}).click();await submit();};
  await page.goto(base);await page.locator('#workspace').waitFor();assert((await page.locator('header .notice').innerText()).includes('Private vendor drafts'));assert.equal(await page.locator('select option').count(),22);assert(await page.locator('#vendor-up').isDisabled());
  const id=await page.locator('select').inputValue();
  await page.locator('#vendor-edit').click();await dialog().locator('[name=name]').fill('Private Grigory');await submit();assert.equal(await page.locator('#vendor-name').innerText(),'Private Grigory');
  await page.locator('#vendor-down').click();await page.locator('#status').filter({hasText:'Saved'}).waitFor();assert.equal(await page.locator('select option').nth(1).getAttribute('value'),id);
  await page.locator('#vendor-image').click();await dialog().locator('[name=search]').fill('images/vendors/grigory.png');await dialog().locator('.scav-image-grid button').first().click();await submit();
  assert(await page.locator('#vendor-portrait').evaluate(img=>img.complete&&img.naturalWidth>0));
  await more('Hide');assert.equal(await page.locator('#vendor-state').innerText(),'Hidden draft');await more('Show');
  await more('Duplicate');assert((await page.locator('#vendor-name').innerText()).endsWith('Copy'));const copy=await page.locator('select').inputValue();assert.notEqual(copy,id);
  await more('Archive');assert.equal(await page.locator('select option[value="'+copy+'"]').count(),0);
  await page.locator('#show-archived').check();await page.locator('select').selectOption(copy);assert(await page.locator('#vendor-edit').isDisabled());await more('Restore');assert.equal(await page.locator('#vendor-state').innerText(),'Hidden draft');
  await page.locator('#vendor-add').click();await dialog().locator('[name=name]').fill('New vendor');await submit();await page.reload();await page.locator('#workspace').waitFor();assert.equal(await page.locator('select option').count(),24);
  await page.locator('select').selectOption(id);
  // A failed save keeps the form values for retry.
  await page.route('**/api/vendors',r=>r.request().method()==='POST'?r.fulfill({status:503,json:{error:'Simulated save failure'}}):r.continue());
  await page.locator('#vendor-edit').click();await dialog().locator('[name=location]').fill('Retained location');await dialog().locator('button[type=submit]').click();await dialog().getByText('Simulated save failure').waitFor();assert.equal(await dialog().locator('[name=location]').inputValue(),'Retained location');await page.unroute('**/api/vendors');await submit();
  // Another window cannot silently overwrite a newer revision.
  const second=await context.newPage();await second.goto(base);await second.locator('#workspace').waitFor();await more('Hide');
  await second.locator('#vendor-edit').click();await second.locator('[name=name]').fill('Stale entry');await second.locator('dialog button[type=submit]').click();await second.locator('dialog [role=alert]').filter({hasText:'Vendors changed in another window'}).waitFor();assert.equal(await second.locator('[name=name]').inputValue(),'Stale entry');await second.close();
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const h of await page.locator('main button:visible,main select').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert(h>=44);
   await page.locator('#vendor-edit').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert(await dialog().evaluate(d=>d.contains(document.activeElement)));assert(await dialog().evaluate(d=>d.scrollWidth<=d.clientWidth));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'vendor-edit');
   if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'vendor-7b-'+width+'.png'),fullPage:true});}
  }
  assert.deepEqual(errors,[]);console.log('PASS vendor UI details/images/reorder/add/duplicate/visibility/archive/restore, reload, failed-save retry, conflicts, keyboard and 320–1280px layouts');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
