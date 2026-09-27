const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const V=require('../verification.js');
const root=path.resolve(__dirname,'..'),settings={schemaVersion:1,current_patch_id:'0.7.2'};
const verified=V.decide({name:'Bandage'},'verified',settings,'test-admin',()=>new Date('2026-09-24T08:00:00Z'));
const old=V.decide({name:'Older weapon'},'verified',{schemaVersion:1,current_patch_id:'0.7.1'},'test-admin',()=>new Date('2026-09-23T08:00:00Z'));
const fixture={settings,datasets:{items:[verified,{name:'Unverified item'},{name:'<img src=x onerror=alert(1)>',source:{status:'screenshot-verified'}}],weapons:[old],armour:[],ammo:[],crafting:[],vendors:[{name:'The Doctor',inventory:[{name:'Bandage'}]}]},owner:true,canStart:false};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],requests=[];
  let state=structuredClone(fixture),fail=false,delay=0,allow=true,role='owner';
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push(d.message());d.dismiss();});
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname!=='local.test'){
    requests.push({path:url.pathname,body:req.postDataJSON?.()});
    if(url.pathname.endsWith('/token'))return route.fulfill({json:{access_token:'test-only'}});
    if(url.pathname.endsWith('/is_scavland_admin'))return route.fulfill({json:allow});
    if(url.pathname.endsWith('/get_scavland_admin_profile'))return route.fulfill({json:[{role}]});
    if(url.pathname.endsWith('/get-site-analytics'))return route.fulfill({json:{activeNow:0,last24Hours:0,totalSessions:0}});
    if(url.pathname.endsWith('/manage-patches')){
     assert.deepEqual(req.postDataJSON(),{action:'read'});assert.equal(req.headers().authorization,'Bearer test-only');
     if(delay)await new Promise(r=>setTimeout(r,delay));
     return fail?route.fulfill({status:503,json:{error:'test outage'}}):route.fulfill({json:state});
    }
    return route.fulfill({json:[]});
   }
   // Stub editor frames while exercising the real hub navigation/session handshake.
   if(url.searchParams.has('embed'))return route.fulfill({contentType:'text/html',body:'<p>Editor test fixture</p><script>parent.postMessage({type:"scavland-admin-ready"},location.origin);addEventListener("message",e=>document.body.dataset.token=e.data.token)</script>'});
   const file=path.join(root,url.pathname);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  async function login(){await page.goto('http://local.test/admin.html');await page.locator('#email').fill('test@example.invalid');await page.locator('#password').fill('fixture');await page.locator('#signin').click();}
  async function loaded(){await page.waitForFunction(()=>document.getElementById('dashboard-status').textContent.startsWith('Updated'));}
  await page.goto('http://local.test/admin.html');assert.equal(requests.some(r=>r.path.endsWith('manage-patches')),false);assert.equal(await page.locator('#hub').isVisible(),false);
  await login();await loaded();
  assert.equal(await page.locator('#dashboard-patch').textContent(),'0.7.2');
  assert.equal(await page.locator('#dashboard-summary').textContent(),'1 / 5 (20%)');
  assert.equal(await page.locator('#dashboard-stale').textContent(),'1 patch checks');
  assert.equal(await page.locator('#dashboard-unverified').textContent(),'3 unverified');
  assert.equal(await page.locator('#dashboard-new-patch').isDisabled(),true);
  assert.equal(await page.locator('#dashboard-admin [data-view="admin-users"]').count(),1);
  assert.equal(await page.locator('#dashboard-content [data-view="items"]').count(),1);
  assert.equal(await page.locator('#dashboard-website #edit-site').count(),1);
  await page.locator('[data-review-category="items"]').click();
  assert.equal(await page.locator('#dashboard-category').inputValue(),'items');assert.match(await page.locator('#dashboard-results').textContent(),/3 match current filters/);
  assert.equal(await page.locator('#dashboard-review-list img').count(),0,'Untrusted names must be text');
  await page.locator('#dashboard-filter').selectOption('verified');assert.match(await page.locator('#dashboard-results').textContent(),/1 match current filters/);
  await page.locator('#dashboard-search').fill('not found');assert.match(await page.locator('#dashboard-results').textContent(),/^No entries/);
  await page.locator('[data-review-category="listings"]').click();assert.match(await page.locator('#dashboard-review-list').textContent(),/The Doctor — Bandage/);
  await page.locator('#dashboard-review-list').getByRole('button',{name:'Open Vendor listings editor',exact:true}).click();assert.equal(await page.locator('#vendors').isVisible(),true);
  await page.frameLocator('#vendors-frame').locator('body[data-token="test-only"]').waitFor();
  await page.locator('#vendors .hub-button').click();await loaded();
  for(const view of ['weapons','armour','crafting','ammunition','settings','content'])assert(await page.locator('#hub [data-view="'+view+'"]').isDisabled());
  for(const view of ['items','patches']){
   await page.locator('#hub [data-view="'+view+'"]').click();assert.equal(await page.locator('#'+view).isVisible(),true);
   await page.locator('#'+view+' .hub-button').click();await loaded();
  }
  fail=true;await page.locator('#dashboard-refresh').click();await page.waitForFunction(()=>document.getElementById('dashboard-status').textContent.includes('test outage'));
  assert.equal(await page.locator('#dashboard-metrics').isVisible(),false);assert.equal(await page.locator('[data-review-category="items"]').isDisabled(),true);
  assert.equal(await page.locator('#hub [data-view="items"]').isEnabled(),true);
  fail=false;await page.locator('#dashboard-refresh').click();await loaded();
  state.datasets.items[0].verification.history=[];await page.locator('#dashboard-refresh').click();await page.waitForFunction(()=>document.getElementById('dashboard-status').textContent.startsWith('Verification unavailable'));
  assert.equal(await page.locator('#dashboard-metrics').isVisible(),false);
  state=structuredClone(fixture);state.canStart=true;await page.locator('#dashboard-refresh').click();await loaded();
  await page.locator('#dashboard-new-patch').click();assert.equal(await page.locator('#patches').isVisible(),true);await page.locator('#patches .hub-button').click();await loaded();
  delay=200;await page.locator('#dashboard-refresh').click();assert.equal(await page.locator('#dashboard-refresh').isDisabled(),true);await loaded();delay=0;
  const output=process.env.SCAVLAND_TEST_OUTPUT;if(output)fs.mkdirSync(output,{recursive:true});
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:1000});await page.locator('#hub').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('.dashboard').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),true,'Dashboard overflow at '+width);
   await page.locator('#dashboard-review').click();assert.equal(await page.locator('#dashboard-review-panel').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'Review overflow at '+width);
   assert.equal(await page.locator('.dashboard button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)),true);
   if(output&&[390,1280].includes(width)){await page.locator('#dashboard-refresh').click();await loaded();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'dashboard-'+width+'.png'),fullPage:true});}
  }
  role='admin';state.owner=false;state.canStart=false;await login();await loaded();
  assert.equal(await page.locator('#dashboard-new-patch').isVisible(),false);assert.equal(await page.locator('[data-view="admin-users"]').count(),0);
  state={...state,datasets:{items:[],weapons:[],armour:[],ammo:[],crafting:[],vendors:[]}};await page.locator('#dashboard-refresh').click();await loaded();assert.equal(await page.locator('#dashboard-summary').textContent(),'0 / 0 (0%)');
  state.settings={schemaVersion:1,current_patch_id:null};await page.locator('#dashboard-refresh').click();await page.waitForFunction(()=>document.getElementById('dashboard-status').textContent.startsWith('Current patch is not set'));assert.equal(await page.locator('#dashboard-patch').textContent(),'Not set');
  allow=false;const before=requests.filter(r=>r.path.endsWith('manage-patches')).length;await login();await page.getByText('This account is not authorized as a SCAVLAND admin.',{exact:true}).waitFor();assert.equal(await page.locator('#hub').isVisible(),false);assert.equal(requests.filter(r=>r.path.endsWith('manage-patches')).length,before);
  assert.equal(requests.some(r=>/recover|invite|publish/.test(r.path)),false,'No emails or publishing calls');assert.deepEqual(errors,[]);
  console.log('PASS: dashboard totals, category/status/search review, escaping, navigation/session handoff, owner/admin/denied access, empty/unset/corrupt data, outage/retry, read-only requests, 320–1280px layouts. No live calls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
