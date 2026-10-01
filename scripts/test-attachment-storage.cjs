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
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/attachment-creation-allocation.sql'),'utf8'));
 const creationRequest=crypto.randomUUID(),creationCommand={action:'create-attachment',confirmCreation:true,fields:{name:'Fixture'}};
 const allocate=(who,owner=actor,request=creationRequest,command=creationCommand)=>run(who,'select public.scavland_allocate_attachment($1,$2,$3) as v',[owner,request,command]);
 const allocation=await allocate('service');assert.match(allocation.item_id,/^attachment-[0-9a-f-]{36}$/);
 assert.deepEqual(await allocate('service'),allocation,'lost response retry retains server identity');
 await assert.rejects(allocate('service',other),e=>e.code==='PT409');
 await assert.rejects(allocate('service',actor,creationRequest,{...creationCommand,fields:{name:'Changed'}}),e=>e.code==='PT409');
 await assert.rejects(allocate(actor),e=>e.code==='42501');
 await assert.rejects(allocate('service',actor,crypto.randomUUID(),{...creationCommand,id:'forged'}),e=>e.code==='22023');
 await assert.rejects(run('service','select count(*) as v from scavland_item_drafts.attachment_allocations'),e=>e.code==='42501');
 assert.notEqual((await allocate('service',actor,crypto.randomUUID())).item_id,allocation.item_id);
 console.log('PASS real SQL creation allocation: server UUID, actor/command binding, lost-response retry, browser/direct-table denial.');
 const request=crypto.randomUUID(),payload={itemId:'stable',category:'attachments',expectedVersion:0,actor,record:{id:'stable',contentType:'Attachment'}},command={action:'classify-attachment'};
 const prep=(id=request,item='stable',legacy=0)=>run('service','select scavland_item_drafts.prepare_attachment($1,$2,$3,$4,$5,$6) as v',[actor,item,id,command,{...payload,itemId:item,record:{...payload.record,id:item}},legacy]);
 await assert.rejects(prep(creationRequest),e=>e.code==='PT409');
 const creationPayload={...payload,itemId:allocation.item_id,record:{id:allocation.item_id,contentType:'Attachment'},creation:true,before:null};
 await run('service','select scavland_item_drafts.prepare_attachment($1,$2,$3,$4,$5,$6) as v',[actor,allocation.item_id,creationRequest,creationCommand,creationPayload,0]);
 const access=(who,action,id='stable',receipt=request)=>run(who,'select scavland_item_drafts.attachment_access($1,$2,$3) as v',[action,id,receipt]);
 assert.equal((await access(actor,'save',allocation.item_id,creationRequest)).version,1);
 assert.equal((await access(actor,'save',allocation.item_id,creationRequest)).version,1);
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
 const latest={documents:{'data/items.json':{data:[source,{id:'browser-candidate',name:'Browser candidate',classification:['item'],source:'evidence-inbox/attachments/fixture.png'}]},'data/armour.json':{data:[]},'data/ammo.json':{data:[]},'data/weapons.json':{data:[{id:'weapon-fixture',name:'Recorded fixture Weapon'},{id:'hidden-weapon',hidden:true}]}},settings,images:[],base:{'data/items.json':'fixture-blob'}};
 const rpcArguments={scavland_allocate_attachment:['p_actor','p_request','p_command'],scavland_attachment_receipt:['p_actor','p_item','p_request','p_command'],scavland_prepare_attachment:['p_actor','p_item','p_request','p_command','p_payload','p_legacy'],scavland_attachment_draft:['p_action','p_item','p_request']};
 const gitWrites=[];
 const fetcher=async(url,options)=>{
  if(url.startsWith('https://api.github.com/')){
   if(options.method==='POST'||options.method==='PATCH'){gitWrites.push({url,body:JSON.parse(options.body)});return Response.json({sha:url.endsWith('/git/trees')?'published-tree':'published-commit'});}
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
 const env=name=>({SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',SHARED_ATTACHMENT_ENABLED:'true',ADMIN_CORE_ENABLED:'true',DRAFT_PUBLISH_ENABLED:'true',GITHUB_TOKEN:'fixture'})[name];
 const api=createAttachmentTransport({env,fetcher,readSource:async()=>latest});
 const call=body=>api(new Request('https://fixture/editor',{method:'POST',headers:{Authorization:'Bearer fixture-session'},body:JSON.stringify(body)}));
 const createBody={action:'create',requestId:crypto.randomUUID(),command:{action:'create-attachment',confirmCreation:true,fields:{name:'API new Attachment',attachmentType:'Scope'}}};
 const createdResponse=await call(createBody);assert.equal(createdResponse.status,200);const created=await createdResponse.json();assert.equal(created.version,1);assert.match(created.itemId,/^attachment-/);
 const retryCreate=await (await call(createBody)).json();assert.equal(retryCreate.itemId,created.itemId);assert.equal(retryCreate.version,1);
 assert.equal((await call({...createBody,command:{...createBody.command,fields:{name:'Changed'}}})).status,409);
 const newLoaded=await (await call({action:'load',itemId:created.itemId})).json();assert.equal(newLoaded.draft.record.name,'API new Attachment');assert.equal(newLoaded.currentVersion,1);
 assert(!latest.documents['data/items.json'].data.some(r=>r.id===created.itemId),'creation remains private');
 console.log('PASS combined creation handler/SQL: allocation, durable save/load and exact retry without duplicate identity.');
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
 const newPreviewResponse=await call({action:'preview',itemId:created.itemId,expectedVersion:1});assert.equal(newPreviewResponse.status,200);const newPreview=await newPreviewResponse.json();
 const newPublish=await call({action:'publish',itemId:created.itemId,expectedVersion:1,previewId:newPreview.previewId,confirm:true});assert.equal(newPublish.status,200);assert.equal(gitWrites.length,3);const createdPublic=JSON.parse(gitWrites[0].body.tree[0].content).data.find(r=>r.id===created.itemId);assert.equal(createdPublic.name,'API new Attachment');assert(!JSON.stringify(createdPublic).includes(actor));assert.equal(gitWrites[2].body.force,false);gitWrites.length=0;
 console.log('PASS combined new-record preview/publication: SQL-bound intent, one master append, private history omitted and non-force Git fixture.');
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
  let loseCreateReply=false;
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
     if(route.request().postDataJSON().action==='create'&&loseCreateReply){loseCreateReply=false;return route.abort('failed');}
     return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    });
    await page.goto('https://scavlandfanbase.github.io/fixture-parent.html');return page;
   }
   const page=await open(),frame=page.frameLocator('iframe');
   await frame.getByRole('button',{name:'API renamed',exact:true}).click();await frame.locator('#item-name').fill('Browser durable Attachment');await frame.locator('#compatibility-mode').selectOption('recorded');await frame.locator('#compatible-weapons').selectOption(['weapon-fixture']);assert.equal(await frame.locator('#compatible-weapons option[value="hidden-weapon"]').count(),0);
   await frame.locator('#save').click();await frame.locator('#status').filter({hasText:'Saved privately'}).waitFor();
   const actual=(await run(actor,'select public.scavland_attachment_draft($1,$2) as v',['load','api-item']));assert.equal(actual.draft.payload.record.name,'Browser durable Attachment');assert.equal(actual.currentVersion,3);assert.deepEqual(actual.draft.payload.record.compatibleWeaponIds,['weapon-fixture']);
   const second=await open(),otherFrame=second.frameLocator('iframe');await otherFrame.getByRole('button',{name:'Browser durable Attachment',exact:true}).click();
   assert.equal(await otherFrame.locator('#item-name').inputValue(),'Browser durable Attachment');assert.equal(await otherFrame.locator('#compatibility-mode').inputValue(),'recorded');assert.equal(await otherFrame.locator('#compatible-weapons option:checked').getAttribute('value'),'weapon-fixture');
   page.on('dialog',d=>d.accept());second.on('dialog',d=>d.accept());
   await frame.locator('#preview').click();await frame.locator('#preview-dialog[open]').waitFor();await frame.locator('#close-preview').click();
   await otherFrame.locator('#item-name').fill('Concurrent saved Attachment');await otherFrame.locator('#save').click();await otherFrame.locator('#status').filter({hasText:'Saved privately'}).waitFor();
   await frame.locator('#publish').click();await frame.locator('#status').filter({hasText:'saved version changed'}).waitFor();assert.equal(gitWrites.length,0,'stale preview cannot write Git');
   await otherFrame.locator('#preview').click();await otherFrame.locator('#preview-dialog[open]').waitFor();await otherFrame.locator('#close-preview').click();await otherFrame.locator('#publish').click();await otherFrame.locator('#status').filter({hasText:'Published commit'}).waitFor();
   assert.equal(gitWrites.length,3);assert.equal(gitWrites[0].body.tree.length,1);assert.equal(gitWrites[0].body.tree[0].path,'data/items.json');assert.equal(gitWrites[2].body.force,false);
   const output=JSON.parse(gitWrites[0].body.tree[0].content);assert.equal(output.data[0].name,'Concurrent saved Attachment');assert.equal(output.data[0].contentType,'Attachment');assert.deepEqual(output.data[0].compatibleWeaponIds,['weapon-fixture']);assert(!JSON.stringify(output).includes(actor),'private actor omitted');assert.equal(source.name,'Existing','Git fixture does not mutate real or source data');
   const third=await open();third.on('dialog',d=>d.accept());const candidateFrame=third.frameLocator('iframe');await candidateFrame.getByRole('button',{name:'Browser candidate · Candidate for review',exact:true}).click();await candidateFrame.locator('#type').selectOption('Scope');await candidateFrame.locator('#classify').click();await candidateFrame.locator('#status').filter({hasText:'Saved privately'}).waitFor();
   const classified=await run(actor,'select public.scavland_attachment_draft($1,$2) as v',['load','browser-candidate']);assert.equal(classified.currentVersion,1);assert.equal(classified.draft.payload.record.contentType,'Attachment');assert.equal(classified.draft.payload.record.attachmentType,'Scope');assert.equal(latest.documents['data/items.json'].data[1].contentType,undefined);assert.equal(gitWrites.length,3,'classification saves privately');
   const fourth=await open();fourth.on('dialog',d=>d.accept());const addFrame=fourth.frameLocator('iframe');
   await addFrame.locator('#add').click();await addFrame.locator('#create-name').fill('Cancelled fixture');await addFrame.locator('#cancel-create').click();assert.equal(await addFrame.locator('#create-dialog').getAttribute('open'),null);
   await addFrame.locator('#add').click();await addFrame.locator('#create-name').fill('Browser new Attachment');await addFrame.locator('#create-type').selectOption('Scope');loseCreateReply=true;await addFrame.getByRole('button',{name:'Create privately',exact:true}).click();await addFrame.locator('#retry').waitFor();
   const countBeforeRetry=(await db.query("select count(*)::int as n from scavland_item_drafts.attachment_versions where payload->'record'->>'name'='Browser new Attachment'")).rows[0].n;assert.equal(countBeforeRetry,1);
   await addFrame.locator('#retry').click();await addFrame.locator('#status').filter({hasText:'Saved privately'}).waitFor();assert.equal(await addFrame.locator('#item-name').inputValue(),'Browser new Attachment');
   const rows=(await db.query("select item_id,version from scavland_item_drafts.attachment_versions where payload->'record'->>'name'='Browser new Attachment'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].version,1);
   const newPage=await open(),newFrame=newPage.frameLocator('iframe');await newFrame.getByRole('button',{name:'Browser new Attachment',exact:true}).click();assert.equal(await newFrame.locator('#item-name').inputValue(),'Browser new Attachment');
   await addFrame.locator('#preview').click();await addFrame.locator('#preview-dialog[open]').waitFor();await addFrame.locator('#close-preview').click();await addFrame.locator('#publish').click();await addFrame.locator('#status').filter({hasText:'Published commit'}).waitFor();assert.equal(gitWrites.length,6);
   const newPublic=JSON.parse(gitWrites[3].body.tree[0].content).data.find(r=>r.id===rows[0].item_id);assert.equal(newPublic.name,'Browser new Attachment');assert.equal(newPublic.verification.decision,'unverified');latest.documents['data/items.json'].data.push(newPublic);
   await newFrame.locator('#item-name').fill('Browser new Attachment edited');await newFrame.locator('#save').click();await newFrame.locator('#status').filter({hasText:'Saved privately'}).waitFor();const newSaved=await run(actor,'select public.scavland_attachment_draft($1,$2) as v',['load',rows[0].item_id]);assert.equal(newSaved.currentVersion,2);assert.equal(newSaved.draft.payload.creation,false);
   console.log('PASS browser new Attachment: cancel, lost-response retry without duplicates, second-page reopen, preview/publication and subsequent edit baseline.');
   console.log('PASS browser explicit classification through handler/SQL, stable identity and no publication.');
   console.log('PASS combined browser/SQL publication: stale second-session preview refused without writes; fresh intent publishes only master data through non-force Git fixture.');
   console.log('PASS combined Attachment browser/transport/real SQL: durable private edit, authoritative version 3 and second page reload. Auth/Git remain fixtures.');
  }finally{await browser.close();}
 }
 const inventory=(await db.query(fs.readFileSync(path.join(__dirname,'../supabase/proposals/attachment-readiness.sql'),'utf8'))).rows[0].attachment_release_inventory;
 assert.equal(inventory.prerequisites.legacy_rpc,false,'fixture mocks the legacy RPC; inventory must report its absence');
 assert.ok(Object.entries(inventory.prerequisites).filter(([name])=>name!=='legacy_rpc').every(([,present])=>present));
 assert.equal(inventory.tables.length,4);assert.ok(inventory.tables.every(t=>t.present&&t.rls&&!t.anon_direct&&!t.authenticated_direct&&!t.service_direct));
 assert.equal(inventory.triggers.length,4);assert.ok(inventory.triggers.every(t=>t.present&&t.enabled==='O'));
 assert.equal(inventory.functions.length,6);assert.ok(inventory.functions.every(f=>f.present&&!f.anon_execute));
 for(const f of inventory.functions){const browser=f.signature.includes('scavland_attachment_draft(')||f.signature.includes('scavland_attachment_list(');assert.equal(f.authenticated_execute,browser);if(!browser)assert.equal(f.service_execute,true);}
 console.log('PASS read-only release inventory: complete local installation, RLS, denied direct access, RPC roles and enabled guards.');
 console.log('PASS Attachment preview SQL: actor/version/digest binding, browser denial and expiration.');
 console.log('PASS Attachment combined transport/SQL: classify, durable save/reload, exact receipt retry/refusal and subsequent edit. Auth/Git source fixture only.');
 console.log('PASS Attachment SQL: protected receipt creation, permission denial, private reload, retry, competing work and legacy-version revocation.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
