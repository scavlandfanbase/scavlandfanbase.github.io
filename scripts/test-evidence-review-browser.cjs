const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const id=crypto.randomUUID(),actor=crypto.randomUUID(),root=path.join(__dirname,'..'),receipts=new Map();let version=0,history=[],lose=false,stale=false;
 const submission={id,item_name:'<script>unsafe()</script>',category:'Items',status:'pending',notes:'Original submission',screenshot_path:'fixture.png',created_at:'2026-01-01T00:00:00Z',review_notes:null};
 await page.route('https://fixture.test/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);if(!file)return route.fulfill({contentType:'text/html',body:'<iframe src="evidence-review.html" style="width:100%;height:1000px;border:0"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"fixture"},location.origin)})</script>'});return route.fulfill({path:path.join(root,file)});});
 await page.route('https://demtoqsafufzmnhvaykj.supabase.co/**',async route=>{
  if(route.request().url().includes('/storage/')&&route.request().method()==='GET')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'});
  if(route.request().url().includes('/storage/')){assert.ok(route.request().headers().apikey);return route.fulfill({json:{signedURL:'/object/sign/evidence-submissions/fixture.png?token=fixture'}});}
  const body=route.request().postDataJSON();let result;
  if(body.action==='list')result=submission.status===body.status?[{...submission}]:[];
  if(body.action==='load')result={submission:{...submission},version,history:[...history]};
  if(body.action==='decide'){
   if(stale){stale=false;return route.fulfill({status:409,json:{error:'Evidence review changed. Reload before deciding.'}});}
   if(!receipts.has(body.requestId)){assert.equal(body.expectedVersion,version);assert.equal(body.expectedStatus,submission.status);version++;history.push({actor,version,previous_status:submission.status,decision:body.decision,reviewed_at:'2026-01-01T00:00:00Z',notes:body.notes});submission.status=body.decision;submission.review_notes=body.notes;receipts.set(body.requestId,{version});}
   if(lose){lose=false;return route.abort('failed');}result=receipts.get(body.requestId);
  }
  return route.fulfill({json:result});
 });
 await page.goto('https://fixture.test/');const f=page.frameLocator('iframe');await f.getByRole('button',{name:'<script>unsafe()</script> · pending',exact:true}).click();
 await f.locator('#status').filter({hasText:'Loaded saved evidence'}).waitFor();assert.equal(await f.locator('#name').textContent(),submission.item_name);assert.equal(await f.locator('#detail script').count(),0);
 await f.locator('#notes').fill('Review notes');lose=true;await f.locator('#approve').click();await f.locator('#retry:not(:disabled)').waitFor();assert.equal(version,1);assert.equal(await f.locator('#notes').inputValue(),'Review notes');assert(await f.locator('#approve').isDisabled());
 await f.locator('#retry').click();await f.locator('#status').filter({hasText:'Review recorded privately'}).waitFor();assert.equal(version,1);assert.equal(await f.locator('#history li').count(),1);assert.equal(submission.notes,'Original submission');
 await f.locator('#restore').click();await f.locator('#status').filter({hasText:'Review recorded privately'}).waitFor();await f.locator('#approve:not(:disabled)').waitFor();assert.equal(version,2);
 stale=true;await f.locator('#notes').fill('Keep stale notes');await f.locator('#reject').click();await f.locator('#status').filter({hasText:'Evidence review changed'}).waitFor();assert.equal(await f.locator('#notes').inputValue(),'Keep stale notes');assert(await f.locator('#approve').isDisabled());assert(await f.locator('#reject').isDisabled());
 await f.locator('#reload').click();await f.locator('#status').filter({hasText:'Loaded saved evidence'}).waitFor();assert.equal(await f.locator('#notes').inputValue(),'Review notes');
 for(const width of [320,1280]){await page.setViewportSize({width,height:1100});assert(await f.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS Evidence browser: safe text, same-request lost-reply retry, retained notes/history, restore, stale recovery and mobile layout. No live calls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
