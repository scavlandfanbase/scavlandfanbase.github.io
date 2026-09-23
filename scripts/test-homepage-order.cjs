const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const original=JSON.parse(fs.readFileSync(path.join(root,'data/site-content.json')));
 let published=structuredClone(original),fail=false;
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage();
 await page.addInitScript(()=>sessionStorage.setItem('scavland-edit-token','test-only'));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/publish-site-content')){
   if(fail){fail=false;return route.fulfill({status:500,json:{error:'test failure'}})}
   published.pages['index.html']=route.request().postDataJSON().content;
   return route.fulfill({json:{ok:true}});
  }
  if(url.hostname!=='local.test')return route.fulfill({json:url.pathname.endsWith('/is_scavland_admin')?true:[]});
  if(url.pathname==='/data/site-content.json')return route.fulfill({json:original}); // Intentionally stale after every save.
  const file=path.join(root,url.pathname);
  return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 await page.goto('http://local.test/index.html?edit=1');
 const id='custom-1790194173114',select=page.locator('#box-order-select');
 await select.locator('option').last().waitFor({state:'attached'});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('scav-shell-loading'));
 await select.selectOption(id);
 const ids=()=>published.pages['index.html'].sections.find(s=>s.id==='feature-grid').cards.map(c=>c.id);
 const start=ids().indexOf(id);
 const domIds=()=>page.locator('[data-section-id="feature-grid"] > .card').evaluateAll(cards=>cards.map(c=>c.dataset.contentId));
 async function move(direction){await page.locator('#box-'+direction).click();await page.getByText('Box order saved.',{exact:true}).waitFor();assert.deepEqual(await domIds(),ids())}
 await move('left');assert.equal(ids().indexOf(id),start-1);
 await move('left');assert.equal(ids().indexOf(id),start-2);
 await move('right');assert.equal(ids().indexOf(id),start-1);
 fail=true;await page.locator('#box-left').click();await page.getByText('Could not move box: test failure',{exact:true}).waitFor();assert.equal(ids().indexOf(id),start-1);
 await move('left');assert.equal(ids().indexOf(id),start-2);
 while(ids().indexOf(id)>0)await move('left');
 assert.equal(await page.locator('#box-left').isDisabled(),true);
 await move('right');assert.equal(await page.locator('#box-left').isEnabled(),true);
 await page.route('**/data/site-content.json',route=>route.fulfill({json:published}));
 await page.goto('http://local.test/index.html');
 await page.waitForFunction(()=>!document.documentElement.classList.contains('scav-shell-loading'));
 assert.deepEqual(await domIds(),ids());
 console.log('PASS: repeated moves with stale published data, reverse move, failed-save recovery, boundary buttons, public rendering of saved order');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
