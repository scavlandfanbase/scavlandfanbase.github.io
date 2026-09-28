// Local fixtures only. No production requests or saves.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('./page-builder-server.cjs'),S=require('../vendor-migration-stage1.cjs');
const vendors=require('../data/vendors.json'),items=require('../data/items.json'),root=path.resolve(__dirname,'..');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scav-vendor02b-')),state=S.apply({version:1,revision:5,data:structuredClone(vendors.data),vendorListings:{schemaVersion:1,listings:[]}},items.data,{actorId:'fixture-owner',now:'2026-09-28T00:00:00Z'}).state;
 fs.writeFileSync(path.join(dir,'vendors.json'),JSON.stringify(state));const bytes=fs.readFileSync(path.join(dir,'vendors.json'),'utf8');
 const server=createServer({directory:dir,vendorMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({bypassCSP:true}),page=await context.newPage(),base='http://127.0.0.1:'+server.address().port,errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  // Embed only this fixture page; production/local server headers are not changed.
  await context.route('**/vendor-builder.html?embed=1',async r=>{const response=await r.fetch();const headers=response.headers();delete headers['content-security-policy'];delete headers['x-frame-options'];await r.fulfill({response,headers});});
  await context.route('**/production-editor.js',r=>r.fulfill({contentType:'text/javascript',body:'window.ScavProductionEditor={enabled:false};'}));
  await context.route('**/vendor-host.css',r=>r.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(root,'vendor-host.css'),'utf8')}));
  const adminStyle=fs.readFileSync(path.join(root,'admin.html'),'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
  await context.route(base+'/host',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101310;color:#eee}'+adminStyle+'</style><link rel="stylesheet" href="/vendor-host.css"><main class="admin-main"><h1>Vendor Editor</h1><section id="vendors"><iframe id="vendors-frame" class="item-frame" title="Vendor editor" src="/vendor-builder.html?embed=1"></iframe></section></main><script src="/vendor-workspace.js"></script>'}));
  await page.goto(base+'/host');const f=page.frameLocator('#vendors-frame');await f.locator('#workspace').waitFor().catch(async e=>{console.log(await f.locator('body').innerText());console.log(errors);throw e;});await f.locator('#vendor-inventory').click();await f.locator('.inventory-card').first().waitFor();
  let totalPending=0,totalLinked=0;
  for(const vendor of state.data){await f.locator('[name=vendor]').selectOption(vendor.id);const rows=require('../vendor-legacy-review.js').review(vendor,items.data,state.vendorListings.listings),pending=rows.filter(r=>r.status!=='already-linked').length;totalPending+=pending;totalLinked+=rows.length-pending;
   assert.equal(await f.locator('#legacy-stock').getAttribute('open')!==null,pending>0);assert((await f.locator('#legacy-stock>summary').innerText()).includes((rows.length-pending)+'/'+rows.length+' linked'));
  }assert.equal(totalPending,31);assert.equal(totalLinked,224);
  await f.locator('[name=vendor]').selectOption('grigory');
  const card=f.locator('.inventory-card').first(),dialog=()=>f.locator('dialog');
  for(const width of [320,390,768,1280,1920,2560]){
   await page.setViewportSize({width,height:960});await page.waitForTimeout(100);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await f.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const sizes=await page.locator('#vendors-frame').evaluate(el=>({height:el.clientHeight,content:el.contentDocument.querySelector('.builder').getBoundingClientRect().height,width:el.clientWidth,viewport:innerWidth}));assert(Math.abs(sizes.height-sizes.content)<3);if(width>=1280)assert(sizes.width>=Math.min(1800,width*.89));
   for(const h of await f.locator('#inventory-workspace button:visible,#inventory-workspace summary:visible').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert(h>=44);
   if(width>=1280)assert((await card.boundingBox()).height<140);
   await card.locator('.inventory-more>summary').click();await card.locator('[data-action=verification]').click();assert.equal(await dialog().getByRole('button',{name:'Cancel',exact:true}).count(),0);assert.equal(await dialog().getByRole('button',{name:'Close',exact:true}).count(),1);
   await dialog().getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Tab');assert(await dialog().evaluate(d=>d.contains(document.activeElement)));await dialog().getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Escape');assert(await card.locator('.inventory-more>summary').evaluate(n=>n===document.activeElement));
   await card.locator('[data-action=status]').click();assert((await dialog().innerText()).includes('cannot be recorded'));assert.equal(await dialog().getByRole('button',{name:'Verify',exact:true}).count(),0);await page.keyboard.press('Escape');
   await card.locator('[data-action=edit]').click();assert(await dialog().evaluate(d=>d.scrollWidth<=d.clientWidth));const box=await dialog().boundingBox();assert(box.y>=-2&&box.y+box.height<=962);await page.keyboard.press('Escape');
   const help=f.getByRole('button',{name:'Help: Vendor inventory',exact:true});await help.focus();assert.equal(await help.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await help.getAttribute('aria-expanded'),'false');
   await page.evaluate(()=>scrollTo(0,0));if(process.env.SCAVLAND_TEST_OUTPUT){fs.mkdirSync(process.env.SCAVLAND_TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'vendor02b-'+width+'.png'),fullPage:false});await page.evaluate(()=>{const frame=document.getElementById('vendors-frame');scrollTo(0,scrollY+frame.getBoundingClientRect().top+frame.contentDocument.getElementById('inventory-heading').getBoundingClientRect().top-12);});await page.screenshot({path:path.join(process.env.SCAVLAND_TEST_OUTPUT,'vendor02b-inventory-'+width+'.png'),fullPage:false});}
  }
  await card.locator('.inventory-more>summary').click();await card.locator('[data-action=remove]').click();await dialog().getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(fs.readFileSync(path.join(dir,'vendors.json'),'utf8'),bytes);
  const linkedVendor=state.data.find(v=>v.inventory?.length&&require('../vendor-legacy-review.js').review(v,items.data,state.vendorListings.listings).every(r=>r.status==='already-linked'));await f.locator('[name=vendor]').selectOption(linkedVendor.id);assert.equal(await f.locator('#legacy-stock').getAttribute('open'),null);await f.locator('#legacy-stock>summary').click();assert(await f.locator('#legacy-stock details').first().isVisible());
  assert.deepEqual(errors,[]);console.log('PASS Vendor 0.2B: 320/390/768/1280/1920/2560, page scrolling/frame sizing, compact rows, menus, status/history, help, dialogs/focus, 224 linked/31 discoverable exclusions, fixture bytes unchanged.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
