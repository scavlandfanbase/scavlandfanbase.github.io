const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),id=crypto.randomUUID(),archivedId=crypto.randomUUID();let state=null,version=1,recoveryFailures=1;
 let payload={id,title:'Live fixture',slug:'live-fixture',intro:'Saved intro',sections:[]};const actions=[];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/host'){res.setHeader('Content-Type','text/html');res.end('<iframe id="builder" style="width:100%;height:900px;border:0" src="/page-builder.html?live=1" onload="this.contentWindow.postMessage({type:\'scavland-admin-token\',token:\'fixture-token\'},location.origin)"></iframe>');return;}
  const file=path.join(root,url.pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',async route=>{
   const command=route.request().postDataJSON();actions.push(command);assert.equal(command.domain,'page-builder');assert.equal(route.request().headers().authorization,'Bearer fixture-token');let result;
   if(command.action==='list')result={pages:[{pageId:id,title:payload.title,slug:payload.slug,version,archived:false},{pageId:archivedId,title:'Archived fixture',slug:'archived-fixture',version:3,archived:true}],nextCursor:null};
   else if(command.action==='source')result={imageChoices:[],existingPages:[{id,slug:payload.slug}],capabilities:{publish:true}};
   else if(command.action==='load')result={draft:{page_id:id,payload,version,archived:false},currentVersion:version};
   else if(command.action==='page-state')result={publication:state?{requestId:state.request_id,version,state:state.state,own:true,commit:state.commit_sha}:null};
   else if(command.action==='save'){payload=command.page;version++;result={draft:{payload,version,archived:false}};}
   else if(command.action==='preview')result={previewId:command.requestId,page:payload,preview:{version,html:'<h1>Trusted saved preview</h1>',digest:'f'.repeat(64)}};
   else if(command.action==='publish'){state={request_id:command.requestId,state:'committed',commit_sha:'c'.repeat(40)};result={publication:state};}
   else if(command.action==='recover'){if(recoveryFailures-- >0){await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':base,'Content-Type':'application/json'},body:JSON.stringify({error:'Recovery not confirmed.'})});return;}state.state='refused';result={publication:state};}
   else if(command.action==='status'){state.state='live';result={publication:state};}
   else if(command.action==='history')result={revisions:[{version,savedAt:'2026-10-01T12:00:00Z',archived:command.pageId===archivedId}]};
   else if(command.action==='revision')result={draft:{payload:command.pageId===archivedId?{...payload,id:archivedId,title:'Archived fixture',slug:'archived-fixture',intro:'Retained archived content'}:payload,version,archived:command.pageId===archivedId}};
   else throw Error('unexpected live action '+command.action);
   await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':base,'Content-Type':'application/json'},body:JSON.stringify(result)});
  });
  await page.goto(base+'/host');const frame=page.frameLocator('#builder');
  await frame.getByRole('button',{name:'Live fixture',exact:false}).first().click();
  await frame.getByText('Opened saved draft at revision 1.').waitFor();
  await assert.equal(await frame.getByLabel('Introduction').inputValue(),'Saved intro');
  await frame.getByLabel('Introduction').fill('Saved once');await frame.getByRole('button',{name:'Save Draft',exact:true}).click();
  await frame.getByText(/Saved privately at revision 2/).waitFor();assert.equal(payload.intro,'Saved once');
  assert.equal(await frame.getByRole('button',{name:'Add section',exact:true}).isEnabled(),true);
  assert.equal(await frame.getByRole('button',{name:'Export HTML',exact:true}).isEnabled(),true);
  await frame.getByText('PRIVATE DRAFTS',{exact:true}).waitFor();
  assert.equal(await frame.getByText('Local drafts only.',{exact:true}).count(),0);
  assert.equal(await frame.getByLabel('Outcome scenario').isVisible(),false);
  await frame.getByLabel('Introduction').fill('Unsaved stays private');
  const beforeHistoryWrites=actions.filter(action=>['save','create','archive','publish'].includes(action.action)).length;
  await frame.getByRole('button',{name:'View archived history: Archived fixture',exact:true}).click();
  try{await frame.getByText('1 saved revisions loaded.',{exact:false}).waitFor();}catch(error){console.error(await frame.locator('#history-status').innerText(),actions,errors);throw error;}
  await frame.getByRole('button',{name:/Revision 2 · Archived/}).click();
  await frame.locator('#history-frame').scrollIntoViewIfNeeded();
  await frame.frameLocator('#history-frame').getByText('Retained archived content',{exact:true}).waitFor();
  assert.equal(await frame.getByLabel('Introduction').inputValue(),'Unsaved stays private');
  assert.equal(await frame.locator('#save-revision').innerText(),'Saved revision 2');
  assert.equal(actions.filter(action=>['save','create','archive','publish'].includes(action.action)).length,beforeHistoryWrites);
  await frame.getByRole('button',{name:'Close history',exact:true}).click();
  assert.equal(await frame.getByRole('button',{name:'View archived history: Archived fixture',exact:true}).evaluate(element=>element===document.activeElement),true);
  await frame.getByRole('button',{name:'Publish and status',exact:true}).click();
  await frame.getByRole('button',{name:'Review saved revision',exact:true}).click();
  await frame.frameLocator('#publication-review-frame').getByRole('heading',{name:'Trusted saved preview'}).waitFor();
  await frame.getByRole('button',{name:'Publish reviewed revision'}).click();
  try{await frame.getByText('Repository commit recorded. Waiting for confirmed deployment.').waitFor();}catch(error){console.error(await frame.locator('#publication-status').innerText(),actions,errors);throw error;}
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),true);assert.equal(await frame.getByLabel('Introduction').inputValue(),'Unsaved stays private');
  assert.equal(actions.find(command=>command.action==='publish').previewId,actions.find(command=>command.action==='preview').requestId);
  await frame.getByRole('button',{name:'Check publication status'}).click();
  await frame.getByText('Published: the exact commit and public page content are confirmed.').waitFor();
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),false);assert.equal(payload.intro,'Saved once');assert.equal(await frame.getByLabel('Introduction').inputValue(),'Unsaved stays private');
  await frame.getByRole('button',{name:'Version history',exact:true}).click();
  await frame.getByText(/1 saved revisions loaded/).waitFor();
  assert.equal(await frame.getByLabel('Introduction').inputValue(),'Unsaved stays private');
  assert.equal(await frame.locator('#history-heading').innerText(),'Version history');
  await frame.getByRole('button',{name:'Close history',exact:true}).click();
  page.on('dialog',dialog=>dialog.accept());await page.reload();
  await frame.getByRole('button',{name:'Live fixture',exact:false}).first().click();
  await frame.getByText('Opened saved draft at revision 2.').waitFor();
  assert.equal(await frame.getByLabel('Introduction').inputValue(),'Saved once');
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),false);
  state.state='prepared';await page.reload();
  await frame.getByRole('button',{name:'Live fixture',exact:false}).first().click();
  await frame.getByText('Opened saved draft at revision 2.').waitFor();
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),true,'reload retains unresolved protection');
  await frame.getByRole('button',{name:'Publish and status',exact:true}).click();
  await frame.getByRole('button',{name:'Recover interrupted publication'}).click();
  await frame.getByText('Recovery not confirmed.',{exact:false}).waitFor();
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),true,'failed recovery never unlocks');
  await frame.getByRole('button',{name:'View archived history: Archived fixture',exact:true}).focus();
  await frame.getByRole('button',{name:'View archived history: Archived fixture',exact:true}).press('Enter');
  await frame.getByText('1 saved revisions loaded.',{exact:false}).waitFor();
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),true,'archived history cannot release publication protection');
  await frame.getByRole('button',{name:'Close history',exact:true}).click();
  await frame.getByRole('button',{name:'Recover interrupted publication'}).click();
  await frame.getByText(/Publication stopped/ ).waitFor();
  assert.equal(await frame.getByLabel('Introduction').isDisabled(),false,'confirmed recovery unlocks');
  assert.deepEqual(errors,[]);console.log('PASS connected Page Builder browser fixture: private save, trusted saved preview, exact preview publication, pending lock, confirmed live release and preserved unsaved entries.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
