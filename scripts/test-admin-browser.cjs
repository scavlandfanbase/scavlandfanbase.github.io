// Run with NODE_PATH pointing to an installed Playwright package directory.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
 const {prepare,paths}=await import('../supabase/functions/_shared/records.js');
 const root=path.resolve(__dirname,'..'),docs=Object.fromEntries([...Object.values(paths),'data/factions.json'].map(p=>[p,JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))]));
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);if(name==='/harness'){res.setHeader('Content-Type','text/html');res.end('<iframe style="width:100%;height:1500px;border:0" id="editor" src="'+(new URL(req.url,'http://local').searchParams.get('page')||'items-admin.html')+'"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"test-session"},location.origin)})</script>');return;}const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream'));res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});const page=await browser.newPage({viewport:{width:1365,height:1000}});const errors=[],saved=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/data/*.json',async route=>{const p=new URL(route.request().url()).pathname.slice(1);if(docs[p])return route.fulfill({json:docs[p]});return route.continue();});
  await page.route('https://demtoqsafufzmnhvaykj.supabase.co/**',async route=>{
    const url=route.request().url();if(url.includes('/rpc/'))return route.fulfill({json:true});if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-session'}});
    const body=route.request().postDataJSON();saved.push(structuredClone(body));
    try{const result=prepare(body,docs);await route.fulfill({json:{record:result.record,sha:'test-only'}});}catch(e){await route.fulfill({status:e.status||400,json:{error:e.message}});}
  });
  async function editor(url){await page.goto(base+'/harness?page='+encodeURIComponent(url));const frame=page.frameLocator('#editor');await frame.locator('#new-record').waitFor();return frame;}
  async function savedMessage(frame){await frame.locator('#message').filter({hasText:'Saved and published'}).waitFor();}
  let f=await editor('items-admin.html?embed=1');await f.locator('#new-record').click();await f.locator('#f-name').fill('Browser resource');await f.locator('[value="crafting-resource"]').check();await f.locator('#preview').click();await f.locator('#f-name').fill('Browser resource final');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).changes.name,'Browser resource final');
  await f.locator('#f-notes').fill('Second save');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).create,false);assert.equal(saved.at(-1).id,'browser-resource-final');
  await f.locator('#new-record').click();await f.locator('#f-name').fill('Browser resource final');await f.locator('[value="junk-item"]').check();await f.locator('#save').click();await f.locator('#message').filter({hasText:'already exists'}).waitFor();
  console.log('PASS items: latest values, repeated save, duplicate prevention');
  for(const kind of ['weapons','armour','ammunition']){
    f=await editor('specialist-admin.html?type='+kind+'&embed=1');await f.locator('#new-record').click();await f.locator('#f-name').fill('Browser '+kind);await f.locator('#f-category').selectOption({index:1});if(kind==='weapons')await f.locator('#f-tier').selectOption({index:1});if(kind==='ammunition')await f.locator('#f-penetrationPercent').fill('-25');
    await f.locator('#save').click();await savedMessage(f);assert.ok(docs['data/items.json'].data.some(r=>r.name==='Browser '+kind));
    await f.locator('#f-name').fill('Browser '+kind+' edited');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).create,false);
  }
  console.log('PASS specialists: new weapons, armour, ammunition and shared entries');
  f=await editor('specialist-admin.html?type=crafting&embed=1');await f.locator('#new-record').click();await f.locator('#f-name').fill('Browser recipe');await f.locator('#f-workbench').selectOption('medical');await f.locator('#add-ingredient').click();await f.locator('#ingredients select').selectOption('metal-scrap');await f.locator('#ingredients input').fill('2');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).changes.ingredients[0].quantity,2);
  console.log('PASS recipe: ingredient picker and quantity');
  f=await editor('vendors-admin.html?embed=1');await f.locator('#new-record').click();await f.locator('#f-name').fill('Browser vendor');await f.locator('#f-factionId').selectOption('gunners');await f.locator('#f-inventoryDocumented').selectOption('true');await f.locator('#add-stock').click();await f.locator('#stock select').selectOption('metal-scrap');await f.locator('#stock .rank').fill('1');await f.locator('#stock .price').fill('25');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).changes.inventory[0].price,25);assert.equal(saved.at(-1).changes.portrait,null);
  await f.locator('#f-location').fill('The Mire');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).create,false);
  await f.locator('#search').fill('Grigory');await f.locator('.choice').click();await f.locator('#f-location').fill('Test location');await f.locator('#save').click();await savedMessage(f);assert.deepEqual(Object.keys(saved.at(-1).changes),['location']);
  console.log('PASS vendors: optional portrait, numeric prices, second save, provenance retained');
  f=await editor('items-admin.html?embed=1');await f.locator('#new-record').click();await f.locator('#f-name').fill('Picture item');await f.locator('[value="junk-item"]').check();
  await f.locator('#main-picture input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOQAAAABJRU5ErkJggg==','base64')});
  await f.locator('#main-picture img').waitFor({state:'visible'});await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).uploads.length,1);await f.locator('#f-notes').fill('Still editable');await f.locator('#save').click();await savedMessage(f);assert.equal(saved.at(-1).uploads.length,0);
  await page.setViewportSize({width:390,height:844});await f.locator('#preview').click();assert.equal(await f.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:path.join(root,'../admin-mobile-check.png'),fullPage:true});
  console.log('PASS pictures: upload then edit; mobile has no horizontal overflow');
  // The live ammunition page must render an added record, not just the old hard-coded list.
  await page.goto(base+'/weapons.html');await page.locator('.ammo-card').filter({hasText:'Browser ammunition edited'}).waitFor({state:'attached'});
  await page.goto(base+'/admin.html');await page.locator('#email').fill('local-test@example.invalid');await page.locator('#password').fill('test-only');await page.locator('#signin').click();await page.locator('[data-view=items]').click();await page.frameLocator('#items-frame').locator('#new-record').waitFor();console.log('PASS actual Admin Hub: sign-in and editor handshake');
  assert.deepEqual(errors,[]);console.log('PASS public ammunition: newly added record rendered; no browser errors');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

