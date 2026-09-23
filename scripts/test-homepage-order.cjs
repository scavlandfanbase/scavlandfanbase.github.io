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
  if(url.pathname==='/data/site-content.json'){
   // Independent editor reads can disagree with the shell during deployment.
   const response=structuredClone(original);
   if(!url.searchParams.has('edit'))await new Promise(resolve=>setTimeout(resolve,150));
   if(url.searchParams.has('edit')){
    response.pages['index.html'].sections.find(s=>s.id==='feature-grid').cards.reverse();
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   return route.fulfill({json:response}); // Intentionally stale after every save.
  }
  const file=path.join(root,url.pathname);
  return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 await page.goto('http://local.test/index.html?edit=1');
 const id=original.pages['index.html'].sections.find(s=>s.id==='feature-grid').cards.at(-1).id,select=page.locator('#box-order-select');
 await select.locator('option').last().waitFor({state:'attached'});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('scav-shell-loading'));
 async function assertBoxOptions(){
  const expected=published.pages['index.html'].sections.flatMap(s=>(s.cards||[]).map(c=>c.id));
  assert.deepEqual(await select.locator('option').evaluateAll(options=>options.map(o=>o.value)),expected);
  assert.equal(await page.locator('option').evaluateAll(options=>options.filter(o=>!o.closest('select')).length),0,'Box labels must stay inside their selectors');
 }
 await assertBoxOptions();
 await select.selectOption(id);
 const ids=()=>published.pages['index.html'].sections.find(s=>s.id==='feature-grid').cards.map(c=>c.id);
 const start=ids().indexOf(id);
 const domIds=()=>page.locator('[data-section-id="feature-grid"] > .card').evaluateAll(cards=>cards.map(c=>c.dataset.contentId));
 async function assertRenderedOrder(){
  const expected=published.pages['index.html'].sections.find(s=>s.id==='feature-grid').cards;
  assert.deepEqual(await page.locator('[data-section-id="feature-grid"] > .card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.contentId,title:c.querySelector('h3').textContent}))),expected.map(c=>({id:c.id,title:c.title})));
 }
 await assertRenderedOrder();
 await assertBoxOptions();
 async function move(direction){await page.locator('#box-'+direction).click();await page.getByText('Box order saved.',{exact:true}).waitFor();assert.deepEqual(await domIds(),ids());await assertRenderedOrder();await assertBoxOptions()}
 await move('left');assert.equal(ids().indexOf(id),start-1);
 await move('left');assert.equal(ids().indexOf(id),start-2);
 await move('right');assert.equal(ids().indexOf(id),start-1);
 await move('right');assert.equal(ids().indexOf(id),start);
 await move('left');assert.equal(ids().indexOf(id),start-1);
 fail=true;await page.locator('#box-left').click();await page.getByText('Could not move box: test failure',{exact:true}).waitFor();assert.equal(ids().indexOf(id),start-1);
 await move('left');assert.equal(ids().indexOf(id),start-2);
 while(ids().indexOf(id)>0)await move('left');
 assert.equal(await page.locator('#box-left').isDisabled(),true);
 await move('right');assert.equal(await page.locator('#box-left').isEnabled(),true);
 // Section refreshes used to move box options into the body instead of sections.
 await page.locator('#section-order-select').selectOption('feature-grid');
 for(const direction of ['down','up','down','up']){
  await page.locator('#section-'+direction).click();
  await page.getByText('Section order saved.',{exact:true}).waitFor();
  await assertBoxOptions();await assertRenderedOrder();
  assert.deepEqual(await page.locator('body > section[data-section-id]').evaluateAll(sections=>sections.map(s=>s.dataset.sectionId)),published.pages['index.html'].sections.map(s=>s.id));
 }
 await page.route('**/data/site-content.json',route=>route.fulfill({json:published}));
 await page.goto('http://local.test/index.html');
 await page.waitForFunction(()=>!document.documentElement.classList.contains('scav-shell-loading'));
 assert.deepEqual(await domIds(),ids());
 assert.equal(await page.locator('#box-order-select, body > option').count(),0);
 console.log('PASS: selector options remain intact through repeated box and section moves; delayed shell rendering, consistent card identities, repeated moves with stale published data, reverse move, failed-save recovery, boundary buttons, public rendering of saved order');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
