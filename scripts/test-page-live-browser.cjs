const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),id=crypto.randomUUID();let state=null,version=1;
 let payload={id,title:'Live fixture',slug:'live-fixture',intro:'Saved intro',sections:[]};const actions=[];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/host'){res.setHeader('Content-Type','text/html');res.end('<iframe id="builder" src="/page-builder.html?live=1" onload="this.contentWindow.postMessage({type:\'scavland-admin-token\',token:\'fixture-token\'},location.origin)"></iframe>');return;}
  const file=path.join(root,url.pathname.slice(1));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',async route=>{
   const command=route.request().postDataJSON();actions.push(command);assert.equal(command.domain,'page-builder');assert.equal(route.request().headers().authorization,'Bearer fixture-token');let result;
   if(command.action==='list')result={pages:[{pageId:id,title:payload.title,slug:payload.slug,version,archived:false}],nextCursor:null};
   else if(command.action==='source')result={imageChoices:[],existingPages:[{id,slug:payload.slug}],capabilities:{publish:true}};
   else if(command.action==='load')result={draft:{page_id:id,payload,version,archived:false},currentVersion:version};
   else if(command.action==='page-state')result={publication:state?{requestId:state.request_id,version,state:state.state,own:true,commit:state.commit_sha}:null};
   else if(command.action==='save'){payload=command.page;version++;result={draft:{payload,version,archived:false}};}
   else if(command.action==='preview')result={previewId:command.requestId,page:payload,preview:{version,html:'<h1>Trusted saved preview</h1>',digest:'f'.repeat(64)}};
   else if(command.action==='publish'){state={request_id:command.requestId,state:'committed',commit_sha:'c'.repeat(40)};result={publication:state};}
   else if(command.action==='status'){state.state='live';result={publication:state};}
   else if(command.action==='history')result={revisions:[{version,savedAt:'2026-10-01T12:00:00Z',archived:false}]};
   else if(command.action==='revision')result={draft:{payload,version,archived:false}};
   else throw Error('unexpected live action '+command.action);
   await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':base,'Content-Type':'application/json'},body:JSON.stringify(result)});
  });
  await page.goto(base+'/host');const frame=page.frameLocator('#builder');
  await frame.getByRole('button',{name:'Live fixture',exact:false}).first().click();
  await frame.getByText('Opened saved draft at revision 1.').waitFor();
  await assert.equal(await frame.getByLabel('Introduction').inputValue(),'Saved intro');
  await frame.getByLabel('Introduction').fill('Saved once');await frame.getByRole('button',{name:'Save Draft',exact:true}).click();
  await frame.getByText(/Saved privately at revision 2/).waitFor();assert.equal(payload.intro,'Saved once');
  await frame.getByLabel('Introduction').fill('Unsaved stays private');
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
  assert.deepEqual(errors,[]);console.log('PASS connected Page Builder browser fixture: private save, trusted saved preview, exact preview publication, pending lock, confirmed live release and preserved unsaved entries.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
