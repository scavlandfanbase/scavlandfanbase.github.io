const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer,createStore}=require('./page-builder-server.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-items-editor-')),root=path.resolve(__dirname,'..');
(async()=>{
 const server=createServer({itemMode:true,directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const base='http://127.0.0.1:'+server.address().port,store=createStore(directory,{itemMode:true}),publicBefore=fs.readFileSync(path.join(root,'data/items.json'));
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage(),errors=[];
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());page.setDefaultTimeout(10000);
  const dialog=()=>page.getByRole('dialog');
  async function save(){await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().waitFor({state:'detached'});assert.match(await page.locator('#status').innerText(),/Saved/);}
  async function action(id){if(['item-duplicate','item-visibility','item-archive'].includes(id)&&!await page.locator('#item-more').evaluate(n=>n.open))await page.locator('#item-more>summary').click();await page.locator('#'+id).click();await save();}
  async function cancel(){await page.keyboard.press('Escape');if(await dialog().count())await page.keyboard.press('Escape');}
  await page.goto(base);await page.locator('#workspace').waitFor();
  assert.equal(await page.locator('#workspace input').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 19, 16)','Items fields retain dark editor styling');
  assert.equal(await page.locator('.builder').evaluate(n=>getComputedStyle(n).color),'rgb(232, 229, 220)','Items retains readable light text');
  assert(await page.locator('#item-edit').evaluate(n=>n.getBoundingClientRect().height>=44),'Items actions retain shared touch sizing');
  if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});for(const width of [320,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'9b-catalogue-'+width+'.png'),fullPage:true});}}
  await page.locator('#item-edit').click();await dialog().getByLabel('Estimated Price',{exact:true}).fill('0');await save();assert.equal(store.read().data[0].estimatedPrice,0);
  // Keyboard opening, unsaved discard, and focus return.
  await page.locator('#item-add').focus();await page.keyboard.press('Enter');await dialog().waitFor();await dialog().getByLabel('Item name',{exact:true}).fill('Discard me');await page.keyboard.press('Escape');assert.match(await dialog().innerText(),/Discard unsaved/);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'item-add');assert.equal(store.read().data.length,285);
  await page.locator('#item-add').click();await dialog().getByLabel('Item name',{exact:true}).fill('Private test item');
  await dialog().getByLabel('Item category',{exact:true}).selectOption('custom');await dialog().getByLabel('New category name',{exact:true}).fill('Legacy / custom');
  await dialog().getByLabel('Description state',{exact:true}).selectOption('text');await dialog().getByLabel('Description',{exact:true}).fill('Only documented facts.');await dialog().getByText('Advanced / Technical details',{exact:true}).click();
  await dialog().getByLabel('Value type',{exact:true}).selectOption('group');await dialog().getByRole('button',{name:'Add property',exact:true}).click();
  await dialog().getByLabel('Property name',{exact:true}).fill('Amount');await dialog().getByLabel('Value type',{exact:true}).nth(1).selectOption('number');await dialog().getByLabel('Value',{exact:true}).fill('0');
  for(const width of [280,320,390,768,1280]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);assert(await dialog().evaluate(d=>d.scrollWidth<=d.clientWidth),'dialog overflow '+width);
   for(const h of await dialog().locator('button:visible,input:visible,select:visible,textarea:visible').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert(h>=44,'touch size '+width);
   const last=dialog().getByRole('button',{name:'Save private draft',exact:true});await last.focus();await page.keyboard.press('Tab');assert(await dialog().evaluate(d=>d.contains(document.activeElement)));await page.keyboard.press('Shift+Tab');assert(await last.evaluate(n=>n===document.activeElement));
   if(process.env.SCAVLAND_TEST_OUTPUT&&[320,1280].includes(width)){await dialog().evaluate(d=>d.scrollTop=0);await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'9b-edit-'+width+'.png')});}
  }
  await save();const added=store.read().data.at(-1);assert.equal(added.properties.Amount,0);assert.equal(added.category,'Legacy / custom');assert.equal(added.image,null);assert.equal(added.verification,null);assert.equal(await page.locator('#item-name').innerText(),'Private test item');
  await page.locator('#item-edit').click();assert.equal(await dialog().getByLabel('Item category',{exact:true}).inputValue(),'value:Legacy / custom');await dialog().getByLabel('Item name',{exact:true}).fill('Renamed private item');await save();assert.equal(store.read().data.at(-1).id,added.id);assert.equal(store.read().data.at(-1).properties.Amount,0);
  const complex={zero:0,no:false,unknown:null,nested:[{text:'<safe text>',empty:''},null]},saved=store.read(),record=saved.data.at(-1);
  store.mutate({action:'edit',id:added.id,revision:saved.revision,requestId:crypto.randomUUID(),details:{name:record.name,category:record.category,description:record.description,properties:complex}});
  await page.reload();await page.locator('#workspace').waitFor();await page.getByLabel('Search items',{exact:true}).fill(added.id);await page.locator('#item-edit').click();
  await dialog().getByText('Advanced / Technical details',{exact:true}).click();await dialog().getByRole('button',{name:'Remove property',exact:true}).first().click();await dialog().getByRole('button',{name:'Undo removal',exact:true}).click();await save();assert.deepEqual(store.read().data.at(-1).properties,complex);
  // Set, replace, remove through the shared library picker.
  const inventory=JSON.parse(fs.readFileSync(path.join(root,'data/site-images.json'))),paths=Object.values(inventory.categories).flatMap(c=>c.images||[]);
  for(const image of [paths[0],paths[1],null]){
   await page.locator('#item-image-action').click();
   if(image){await dialog().getByLabel('Search images',{exact:true}).fill(image);await dialog().locator('button[data-image-path]').filter({has:page.locator('img[src='+JSON.stringify(image)+']')}).click();}else await dialog().getByRole('button',{name:'Remove Image',exact:true}).click();
   await dialog().getByRole('button',{name:'Use Image',exact:true}).click();await dialog().waitFor({state:'detached'});assert.equal(store.read().data.at(-1).image,image);
  }
  await page.locator('#item-review').click();await dialog().getByLabel('Review decision',{exact:true}).selectOption('verified');await dialog().getByRole('button',{name:'Record review',exact:true}).click();await dialog().waitFor({state:'detached'});assert.equal(store.read().data.at(-1).verification.decision,'verified');
  await page.locator('#item-verification').click();assert.match(await dialog().innerText(),/local-operator/);await cancel();
  await action('item-duplicate');const duplicate=store.read().data.at(-1);assert.notEqual(duplicate.id,added.id);assert.equal(duplicate.hidden,true);assert.equal(duplicate.verification.history.length,0);
  await action('item-visibility');assert.equal(store.read().data.at(-1).hidden,false);await action('item-visibility');assert.equal(store.read().data.at(-1).hidden,true);
  await action('item-archive');assert.equal(store.read().data.at(-1).archived,true);assert.equal(await page.locator('#item-edit').isEnabled(),false);await action('item-archive');assert.equal(store.read().data.at(-1).archived,false);
  // Evidence links use recorded references; never link arbitrary URLs.
  await page.getByLabel('Search items',{exact:true}).fill(store.read().data[0].id);await page.locator('#item-evidence').click();assert((await dialog().locator('a[href^="/evidence-inbox/"]').count())>0);await cancel();
  await page.getByLabel('Search items',{exact:true}).fill(duplicate.id);
  // A recoverable failed save keeps the typed entries and retries the same operation.
  let reject=true;await page.route('**/api/items',r=>{if(r.request().method()==='POST'&&reject){reject=false;return r.fulfill({status:503,json:{error:'Test storage unavailable. Keep entries and retry.'}});}return r.continue();});
  await page.locator('#item-edit').click();await dialog().getByLabel('Description',{exact:true}).fill('Retained after failure');await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await dialog().getByLabel('Description',{exact:true}).inputValue(),'Retained after failure');assert.match(await page.locator('#status').innerText(),/Couldn’t save/);
  await dialog().getByRole('button',{name:'Retry',exact:true}).click();await dialog().waitFor({state:'detached'});assert.equal(store.read().data.at(-1).description,'Retained after failure');await page.unroute('**/api/items');
  // Commit reached disk but response was lost: duplicate retry must not duplicate twice.
  const count=store.read().data.length;let lost=true;
  await page.route('**/api/items',async r=>{if(r.request().method()==='POST'&&lost){lost=false;await r.fetch();return r.abort();}return r.continue();});
  if(!await page.locator('#item-more').evaluate(n=>n.open))await page.locator('#item-more>summary').click();await page.locator('#item-duplicate').click();await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(store.read().data.length,count+1);
  await dialog().getByRole('button',{name:'Retry',exact:true}).click();await dialog().waitFor({state:'detached'});assert.equal(store.read().data.length,count+1);await page.unroute('**/api/items');
  // Concurrent editor changes reject stale revision; local dialog values survive.
  await page.locator('#item-edit').click();await dialog().getByLabel('Item name',{exact:true}).fill('Unsaved conflict text');
  const current=store.read();store.mutate({action:'visibility',id:current.data.at(-1).id,revision:current.revision,requestId:crypto.randomUUID()});
  await dialog().getByRole('button',{name:'Save private draft',exact:true}).click();await dialog().getByRole('button',{name:'Retry',exact:true}).waitFor();assert.match(await dialog().innerText(),/another window/);assert.equal(await dialog().getByLabel('Item name',{exact:true}).inputValue(),'Unsaved conflict text');
  await cancel();assert.equal(await page.locator('#item-add').isEnabled(),false);await page.locator('#retry').click();await dialog().getByRole('button',{name:'Reload saved items',exact:true}).click();await dialog().waitFor({state:'detached'});assert.equal(await page.locator('#item-add').isEnabled(),true);assert.equal(await page.locator('#retry-save').isVisible(),false);
  await page.reload();await page.locator('#workspace').waitFor();assert.equal(store.read().data.length,count+1);
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(path.join(root,'data/items.json')),publicBefore);
  console.log('PASS full Items editor: keyboard/discard/focus, add/edit/category/typed properties, image set/replace/remove, verification/evidence, duplicate/visibility/archive/restore, retained failed edits, retry after lost response, stale conflict/reload, persistence and 280–1280px dialogs.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
