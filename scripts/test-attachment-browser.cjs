const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let saved=null,version=0,prepared=null,published=0;
 const source={id:'fixture',name:'Fixture candidate'},root=path.join(__dirname,'..');
 await page.route('https://fixture.test/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(!name)return route.fulfill({contentType:'text/html',body:'<iframe src="attachment-category.html" style="width:100%;height:900px"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"fixture"},location.origin)})</script>'});return route.fulfill({path:path.join(root,name)});});
 await page.route('https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',async route=>{
 const body=route.request().postDataJSON();let result;
 if(body.action==='list')result={records:[{id:'fixture',name:source.name,candidate:true}]};
 if(body.action==='load')result={source,currentVersion:version,draft:saved,sourceDigest:'fixture-digest'};
 if(body.action==='prepare'){prepared=body.command;result={request_id:body.requestId};}
 if(body.action==='save'){version++;saved={record:{...(saved?.record||source),contentType:'Attachment',attachmentType:prepared.attachmentType||prepared.fields?.attachmentType,...prepared.fields}};result={version};}
 if(body.action==='preview')result={previewId:'fixture-preview',files:[{content:JSON.stringify(saved.record)}]};
 if(body.action==='publish'){assert.equal(body.confirm,true);published++;result={commit:'fixture-commit'};}
 return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('https://fixture.test/');const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Fixture candidate · Candidate for review'}).click();
 await frame.locator('#type').selectOption('Scope');await frame.locator('#classify').click();
 await frame.locator('#status').filter({hasText:'Saved privately'}).waitFor();assert.equal(saved.record.attachmentType,'Scope');
 await frame.locator('#item-name').fill('Renamed');await frame.locator('#save').click();await frame.locator('#status').filter({hasText:'Saved privately'}).waitFor();assert.equal(saved.record.name,'Renamed');
 await frame.locator('#preview').click();await frame.locator('#preview-dialog').waitFor();await frame.locator('#close-preview').click();await frame.locator('#publish').click();await frame.locator('#status').filter({hasText:'fixture-commit'}).waitFor();assert.equal(published,1);
 for(const width of [390,1280]){await page.setViewportSize({width,height:1000});assert(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS Attachment browser fixtures: parent session handoff, candidate type decision, private edit/reload, preview/explicit publish and mobile widths.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
