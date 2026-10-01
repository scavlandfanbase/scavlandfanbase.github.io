const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite(),actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select auth.uid()='${actor}'::uuid and p='items_edit'$$;
 grant usage on schema auth to authenticated;create schema scavland_drafts;
 create table scavland_drafts.versions(domain text,entity_id text,version integer,payload jsonb);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/shared-item-drafts.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/attachment-classification-storage.sql'),'utf8'));
 const run=(who,sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role '+(who==='service'?'service_role':'authenticated'));await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who==='service'?'':who]);return (await tx.query(sql,args)).rows[0]?.v;});
 const request=crypto.randomUUID(),payload={itemId:'stable',category:'attachments',expectedVersion:0,actor,record:{id:'stable',contentType:'Attachment'}},command={action:'classify-attachment'};
 const prep=(id=request,item='stable',legacy=0)=>run('service','select scavland_item_drafts.prepare_attachment($1,$2,$3,$4,$5,$6) as v',[actor,item,id,command,{...payload,itemId:item,record:{...payload.record,id:item}},legacy]);
 const access=(who,action,id='stable',receipt=request)=>run(who,'select scavland_item_drafts.attachment_access($1,$2,$3) as v',[action,id,receipt]);
 assert.equal((await access(actor,'load')).currentVersion,0);
 await assert.rejects(access(actor,'save'),e=>e.code==='42501');
 await prep();await prep();
 await assert.rejects(access(other,'save'),e=>e.code==='42501');
 await assert.rejects(run(actor,'select * from scavland_item_drafts.attachment_prepared'),e=>e.code==='42501');
 assert.equal((await access(actor,'save')).version,1);assert.equal((await access(actor,'save')).version,1);
 assert.deepEqual((await access(actor,'load')).draft.payload,payload);
 await assert.rejects(prep(crypto.randomUUID()),e=>e.code==='PT409');
 const stale=crypto.randomUUID();await prep(stale,'second');
 await db.exec("insert into scavland_drafts.versions values('items','catalogue',1,'{}')");
 await assert.rejects(access(actor,'save','second',stale),e=>e.code==='PT409');
 assert.equal((await access(actor,'load','second')).currentVersion,0);
 // Trusted service insertion still cannot create competing saved authorities.
 const specialistRequest=crypto.randomUUID();
 const specialistPayload={itemId:'stable',category:'ammo'};
 await db.query('insert into scavland_item_drafts.prepared(request_id,actor,item_id,category,expected_version,command,payload) values($1,$2,$3,$4,0,$5,$6)',[specialistRequest,actor,'stable','ammo',{},specialistPayload]);
 await assert.rejects(db.query('insert into scavland_item_drafts.versions(item_id,version,payload,request_id,saved_by) values($1,1,$2,$3,$4)',['stable',specialistPayload,specialistRequest,actor]),e=>e.code==='PT409');
 const prior=crypto.randomUUID(),pending=crypto.randomUUID();await prep(pending,'specialist-first',1);
 await db.query('insert into scavland_item_drafts.prepared(request_id,actor,item_id,category,expected_version,command,payload) values($1,$2,$3,$4,0,$5,$6)',[prior,actor,'specialist-first','ammo',{},{}]);
 await db.query('insert into scavland_item_drafts.versions(item_id,version,payload,request_id,saved_by) values($1,1,$2,$3,$4)',['specialist-first',{},prior,actor]);
 await assert.rejects(access(actor,'save','specialist-first',pending),e=>e.code==='PT409');
 await assert.rejects(db.query('insert into scavland_item_drafts.attachment_versions(item_id,version,payload,request_id,saved_by) values($1,1,$2,$3,$4)',['specialist-first',payload,pending,actor]),e=>e.code==='PT409');
 assert.equal((await access(actor,'load','stable')).currentVersion,1);
 const editRequest=crypto.randomUUID(),editPayload={...payload,expectedVersion:1,record:{...payload.record,name:'Edited'}};
 await run('service','select scavland_item_drafts.prepare_attachment($1,$2,$3,$4,$5,$6) as v',[actor,'stable',editRequest,{action:'edit-attachment'},editPayload,1]);
 assert.equal((await access(actor,'save','stable',editRequest)).version,2);
 assert.equal((await access(actor,'load','stable')).draft.payload.record.name,'Edited');
 assert.equal((await access(actor,'save','stable',request)).version,1,'old receipt retry returns its original version');
 assert.equal((await access(actor,'load','stable')).currentVersion,2,'old retries cannot replace the head');
 assert((await run(actor,'select public.scavland_attachment_list() as v')).some(r=>r.item_id==='stable'&&r.payload.record.name==='Edited'));
 await assert.rejects(run(other,'select public.scavland_attachment_list() as v'),e=>e.code==='42501');
 const competingA=crypto.randomUUID(),competingB=crypto.randomUUID(),next={...editPayload,expectedVersion:2};
 for(const id of [competingA,competingB])await run('service','select scavland_item_drafts.prepare_attachment($1,$2,$3,$4,$5,$6) as v',[actor,'stable',id,{action:'edit-attachment'},next,1]);
 assert.equal((await access(actor,'save','stable',competingA)).version,3);
 await assert.rejects(access(actor,'save','stable',competingB),e=>e.code==='PT409');
 const {createAttachmentTransport}=await import('../supabase/functions/admin-drafts/attachment-transport.mjs');
 const {legacyDigest}=await import('../supabase/functions/admin-drafts/legacy-item-review.mjs');
 // Replace the deliberately malformed legacy SQL fixture with a real catalogue.
 await db.exec('delete from scavland_drafts.versions');
 const source={id:'api-item',name:'Existing',classification:['item']},settings={schemaVersion:1,current_patch_id:'fixture'};
 const latest={documents:{'data/items.json':{data:[source]}},settings,images:[],base:{'data/items.json':'fixture-blob'}};
 const rpcArguments={scavland_attachment_receipt:['p_actor','p_item','p_request','p_command'],scavland_prepare_attachment:['p_actor','p_item','p_request','p_command','p_payload','p_legacy'],scavland_attachment_draft:['p_action','p_item','p_request']};
 const fetcher=async(url,options)=>{
  if(url.startsWith('https://api.github.com/')){
   if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:'fixture-head'}});
   if(url.includes('/git/commits/'))return Response.json({tree:{sha:'fixture-tree'}});
   if(url.includes('/contents/'))return Response.json({sha:'fixture-blob',encoding:'base64',content:Buffer.from(JSON.stringify(latest.documents['data/items.json'])).toString('base64')});
   throw Error('Unexpected Git write');
  }
  if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});
  const name=url.split('/').at(-1),args=JSON.parse(options.body);
  if(name==='has_scavland_permission')return Response.json(true);
  if(name==='scavland_item_legacy')return Response.json(null);
  try{
   const names=rpcArguments[name];assert(names,'Unexpected RPC');
   const values=names.map(n=>args[n]??null),params=names.map((_,i)=>'$'+(i+1)).join(',');
   const result=await run(options.headers.apikey==='service'?'service':actor,`select public.${name}(${params}) as v`,values);
   return Response.json(result);
  }catch(error){return Response.json({code:error.code,message:error.message},{status:400});}
 };
 const env=name=>({SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',SHARED_ATTACHMENT_ENABLED:'true'})[name];
 const api=createAttachmentTransport({env,fetcher,readSource:async()=>latest});
 const call=body=>api(new Request('https://fixture/editor',{method:'POST',headers:{Authorization:'Bearer fixture-session'},body:JSON.stringify(body)}));
 const apiRequest=crypto.randomUUID(),apiCommand={action:'classify-attachment',confirmId:source.id,attachmentType:'Unknown',confirmReclassification:true,expectedVersion:0,sourceDigest:await legacyDigest({source,settings})};
 assert.equal((await call({action:'prepare',itemId:source.id,requestId:apiRequest,command:apiCommand})).status,200);
 assert.equal((await call({action:'prepare',itemId:source.id,requestId:apiRequest,command:apiCommand})).status,200);
 assert.equal((await call({action:'prepare',itemId:source.id,requestId:apiRequest,command:{...apiCommand,attachmentType:'Scope'}})).status,409);
 assert.equal((await call({action:'save',itemId:source.id,requestId:apiRequest})).status,200);
 const loaded=await (await call({action:'load',itemId:source.id})).json();assert.equal(loaded.currentVersion,1);assert.equal(loaded.draft.record.contentType,'Attachment');
 const editId=crypto.randomUUID(),editCommand={action:'edit-attachment',confirmId:source.id,expectedVersion:1,fields:{name:'API renamed'}};
 assert.equal((await call({action:'prepare',itemId:source.id,requestId:editId,command:editCommand})).status,200);
 assert.equal((await call({action:'save',itemId:source.id,requestId:editId})).status,200);
 assert.equal((await (await call({action:'load',itemId:source.id})).json()).draft.record.name,'API renamed');
 assert.equal(source.name,'Existing','no public source publication');
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/attachment-preview.sql'),'utf8'));
 rpcArguments.scavland_attachment_preview=['p_actor','p_item','p_version','p_digest','p_id'];
 const apiPreview=await call({action:'preview',itemId:source.id,expectedVersion:2});
 assert.equal(apiPreview.status,200);assert((await apiPreview.json()).previewId);
 const preview=(who,owner=actor,item='api-item',version=2,digest='a'.repeat(64),id=null)=>run(who,'select public.scavland_attachment_preview($1,$2,$3,$4,$5) as v',[owner,item,version,digest,id]);
 const intent=await preview('service');assert.equal(intent.version,2);
 assert.equal((await preview('service',actor,'api-item',2,null,intent.id)).digest,'a'.repeat(64));
 assert.equal(await preview('service',other,'api-item',2,null,intent.id),null);
 await assert.rejects(preview(actor),e=>e.code==='42501');
 await assert.rejects(preview('service',actor,'api-item',1),e=>e.code==='PT409');
 await assert.rejects(preview('service',actor,'api-item',2,'invalid'),e=>e.code==='22023');
 await db.query("update scavland_item_drafts.attachment_previews set expires_at=clock_timestamp()-interval '1 second' where id=$1",[intent.id]);
 assert.equal(await preview('service',actor,'api-item',2,null,intent.id),null);
 if(process.env.SCAVLAND_BROWSER==='1'){
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'msedge'});
  rpcArguments.scavland_attachment_list=[];
  try{
   async function open(){
    const page=await browser.newPage();
    await page.route('https://scavlandfanbase.github.io/**',async route=>{
     const file=new URL(route.request().url()).pathname.slice(1);
     if(file==='fixture-parent.html')return route.fulfill({contentType:'text/html',body:'<iframe src="attachment-category.html" style="width:100%;height:1000px"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"fixture"},location.origin)})</script>'});
     return route.fulfill({path:path.join(__dirname,'..',file)});
    });
    await page.route('https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts',async route=>{
     const response=await api(new Request(route.request().url(),{method:'POST',headers:route.request().headers(),body:route.request().postData()}));
     return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    });
    await page.goto('https://scavlandfanbase.github.io/fixture-parent.html');return page;
   }
   const page=await open(),frame=page.frameLocator('iframe');
   await frame.getByRole('button',{name:'API renamed',exact:true}).click();await frame.locator('#item-name').fill('Browser durable Attachment');
   await frame.locator('#save').click();await frame.locator('#status').filter({hasText:'Saved privately'}).waitFor();
   const actual=(await run(actor,'select public.scavland_attachment_draft($1,$2) as v',['load','api-item']));assert.equal(actual.draft.payload.record.name,'Browser durable Attachment');assert.equal(actual.currentVersion,3);
   const second=await open(),otherFrame=second.frameLocator('iframe');await otherFrame.getByRole('button',{name:'Browser durable Attachment',exact:true}).click();
   assert.equal(await otherFrame.locator('#item-name').inputValue(),'Browser durable Attachment');
   console.log('PASS combined Attachment browser/transport/real SQL: durable private edit, authoritative version 3 and second page reload. Auth/Git remain fixtures.');
  }finally{await browser.close();}
 }
 console.log('PASS Attachment preview SQL: actor/version/digest binding, browser denial and expiration.');
 console.log('PASS Attachment combined transport/SQL: classify, durable save/reload, exact receipt retry/refusal and subsequent edit. Auth/Git source fixture only.');
 console.log('PASS Attachment SQL: protected receipt creation, permission denial, private reload, retry, competing work and legacy-version revocation.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
