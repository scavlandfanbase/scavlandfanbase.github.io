const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',armourUser='33333333-3333-4333-8333-333333333333';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select
    (auth.uid() in ('${alice}'::uuid,'${bob}'::uuid) and p='ammunition_edit') or (auth.uid()='${armourUser}'::uuid and p='armour_edit')$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create schema scavland_drafts;create table scavland_drafts.fixture_saved(payload jsonb);
   insert into scavland_drafts.fixture_saved values ('{"name":"untouched existing work"}');`);
  await db.exec('create table scavland_drafts.versions(domain text,entity_id text,version integer,payload jsonb);');
  await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/shared-item-drafts.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/shared-item-api.sql'),'utf8'));
  const invoke=(actor,sql,args=[])=>db.transaction(async tx=>{
   await tx.exec('set local role '+(actor==='service'?'service_role':'authenticated'));
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor==='service'?'':actor]);
   return (await tx.query(sql,args)).rows[0]?.v;
  });
  const access=(actor,action,id='stable',version=null,request=null,category='ammo')=>invoke(actor,'select public.scavland_item_draft($1,$2,$3,$4,$5) as v',[action,id,category,version,request]);
  const prepare=(actor,id,version,request,command,payload=null,category='ammo')=>invoke('service','select public.scavland_prepare_item($1,$2,$3,$4,$5,$6,$7) as v',[actor,id,category,version,request,command,payload]);
  const payload={schemaVersion:1,itemId:'stable',category:'ammo',original:{items:{id:'stable'},ammo:{id:'stable'}},records:{items:{id:'stable'},ammo:{id:'stable'}},changes:{},revision:1};
  const id=crypto.randomUUID(),command={action:'edit',shared:{name:'New name'}};
  assert.equal((await access(alice,'load')).currentVersion,0);
  await assert.rejects(access(alice,'save','stable',0,id),e=>e.code==='42501');
  await assert.rejects(invoke(alice,'select public.scavland_prepare_item($1,$2,$3,$4,$5,$6,$7) as v',[alice,'stable','ammo',0,id,command,payload]),e=>e.code==='42501');
  await assert.rejects(invoke(alice,'select payload as v from scavland_item_drafts.versions'),e=>e.code==='42501');
  await assert.rejects(prepare(alice,'different',0,id,command,payload),e=>e.code==='22023');
  const receipt=await prepare(alice,'stable',0,id,command,payload);
  assert.deepEqual((await prepare(alice,'stable',0,id,command)).payload,receipt.payload);
  await assert.rejects(prepare(bob,'stable',0,id,command),e=>e.code==='PT409');
  await assert.rejects(access(bob,'save','stable',0,id),e=>e.code==='42501');
  const saved=await access(alice,'save','stable',0,id);assert.equal(saved.currentVersion,1);
  assert.equal(saved.draft.saved_by,alice);assert.deepEqual(saved.draft.payload,payload);
  assert.equal((await access(alice,'save','stable',0,id)).draft.version,1,'lost-response retry is idempotent');
  assert.deepEqual((await access(bob,'load')).draft.payload,payload,'second permitted session sees the same draft');
  await assert.rejects(access(armourUser,'load','stable',null,null,'armour'),e=>e.code==='42501');
  const nextId=crypto.randomUUID(),racingId=crypto.randomUUID();
  await prepare(alice,'stable',1,nextId,command,{...payload,revision:2});
  await prepare(bob,'stable',1,racingId,command,{...payload,revision:2});
  await access(alice,'save','stable',1,nextId);
  await assert.rejects(access(bob,'save','stable',1,racingId),e=>e.code==='PT409');
  const otherId=crypto.randomUUID(),otherPayload={...payload,itemId:'other',original:{items:{id:'other'},ammo:{id:'other'}},records:{items:{id:'other'},ammo:{id:'other'}}};
  await prepare(bob,'other',0,otherId,command,otherPayload);await access(bob,'save','other',0,otherId);
  assert.equal((await access(alice,'load','stable')).currentVersion,2);
  assert.equal((await access(bob,'load','other')).currentVersion,1);
  assert.equal((await db.query('select payload from scavland_drafts.fixture_saved')).rows[0].payload.name,'untouched existing work');
  assert.equal((await db.query('select count(*)::int as n from scavland_item_drafts.versions')).rows[0].n,3);
  const {createAmmoItem}=await import('../supabase/functions/admin-drafts/item-draft.mjs');
  const creationId='item-44444444-4444-4444-8444-444444444444',creationRequest=crypto.randomUUID(),creationCommand={action:'create',shared:{name:'Private new Ammo'},specialist:{damage:0}};
  const emptyDocuments=Object.fromEntries(['items','ammo','armour','weapons'].map(n=>['data/'+n+'.json',{data:[]}]));
  const creation=createAmmoItem(emptyDocuments,creationId,creationCommand,{actor:alice,permissions:['ammunition_edit'],settings:{schemaVersion:1,current_patch_id:'fixture-patch'}});
  await prepare(alice,creationId,0,creationRequest,creationCommand,creation);
  await access(alice,'save',creationId,0,creationRequest);
  assert.deepEqual((await access(bob,'load',creationId)).draft.payload,creation,'new identity and creation intent survive a second session');
  assert.equal((await access(alice,'save',creationId,0,creationRequest)).draft.version,1,'new identity save retry stays one version');
  console.log('PASS per-item SQL storage: private tables, trusted-only preparation, caller permissions/category membership, actor/receipt binding, immutable item versions, idempotent retry, second-session reads, stale-save rejection and existing-draft preservation.');
  // Real SQL through the authenticated bridge, with only Auth/GitHub transports mocked.
  const {createItemApi}=await import('../supabase/functions/admin-drafts/item-api.mjs');
  const {seed}=await import('../supabase/functions/admin-drafts/core.mjs');
  let docs={
   'data/items.json':{schemaVersion:1,data:[{id:'api-item',name:'API Ammo',classification:['ammunition'],category:null,description:null,image:null},{id:'api-other',name:'Other Ammo',classification:['ammunition'],category:null,description:null,image:null}]},
   'data/ammo.json':{schemaVersion:1,data:[{id:'api-item',name:'API Ammo',category:'Special',damage:'46',penetrationPercent:-25},{id:'api-other',name:'Other Ammo',category:'Special',damage:'1'}]},
   'data/armour.json':{schemaVersion:1,data:[]},'data/weapons.json':{schemaVersion:1,data:[]},
   'data/vendors.json':{schemaVersion:1,data:[{id:'fixture-shop',name:'Fixture shop'}],vendorListings:{listings:[{id:'stock',vendorId:'fixture-shop',entity:{type:'item',id:'api-item'},price:123,rank:3,quantity:5,archived:false}]}},
   'data/verification-settings.json':{schemaVersion:1,current_patch_id:'fixture-patch'},'data/site-images.json':{categories:{}}
  },head='api-head',gitTree,gitCommit,gitWrites=0;
  const hash=v=>crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
  const env=k=>({SHARED_ITEM_ENABLED:'true',SUPABASE_URL:'https://fixture-sb.invalid',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',GITHUB_TOKEN:'fixture-gh',DRAFT_PUBLISH_ENABLED:'true',ADMIN_CORE_ENABLED:'true'})[k];
  const transport=async(url,opt={})=>{
   const u=new URL(url),b=opt.body&&JSON.parse(opt.body),token=opt.headers.Authorization.slice(7);
   if(u.origin==='https://fixture-sb.invalid'){
    if(u.pathname==='/auth/v1/user')return [alice,bob,armourUser].includes(token)?Response.json({id:token}):Response.json({},{status:401});
    const user=token==='fixture-service'?'service':token;
    try{
     let result;
     if(u.pathname.endsWith('/has_scavland_permission')){assert.deepEqual(Object.keys(b),['required_permission']);result=(b.required_permission==='ammunition_edit'&&[alice,bob].includes(token))||(b.required_permission==='armour_edit'&&token===armourUser);}
     else if(u.pathname.endsWith('/scavland_item_draft'))result=await access(user,b.p_action,b.p_item,b.p_expected_version??null,b.p_request??null,b.p_category);
     else if(u.pathname.endsWith('/scavland_prepare_item')){assert.equal(user,'service');result=await prepare(b.p_actor,b.p_item,b.p_version,b.p_request,b.p_command,b.p_payload??null,b.p_category);}
     else if(u.pathname.endsWith('/scavland_item_preview'))result=await invoke(user,'select public.scavland_item_preview($1,$2,$3,$4,$5,$6) as v',[b.p_actor,b.p_item,b.p_category,b.p_version,b.p_digest??null,b.p_id??null]);
     else if(u.pathname.endsWith('/scavland_item_legacy'))result=await invoke(user,'select public.scavland_item_legacy() as v');
     else throw Error('Unexpected fixture RPC '+url);
     return Response.json(result);
    }catch(e){return Response.json({code:e.code,message:e.message},{status:e.code==='42501'?403:400});}
   }
   assert.equal(u.origin,'https://api.github.com');assert.equal(token,'fixture-gh');
   const p=u.pathname.replace('/repos/scavlandfanbase/scavlandfanbase.github.io','');
   if(!opt.method||opt.method==='GET'){
    if(p==='/git/ref/heads/main')return Response.json({object:{sha:head}});
    if(p==='/git/commits/'+head)return Response.json({tree:{sha:'api-tree'}});
    if(p.startsWith('/contents/')){assert.equal(u.searchParams.get('ref'),head,'all files are pinned to one commit');const d=docs[p.slice(10)];return Response.json({sha:hash(d),encoding:'base64',content:Buffer.from(JSON.stringify(d)).toString('base64')});}
   }
   gitWrites++;
   if(p==='/git/trees'){gitTree=b;return Response.json({sha:'api-new-tree'});}
   if(p==='/git/commits'){gitCommit=b;return Response.json({sha:'api-new-commit'});}
   if(p==='/git/refs/heads/main'){assert.equal(b.force,false);assert.deepEqual(gitCommit.parents,[head]);for(const f of gitTree.tree)docs[f.path]=JSON.parse(f.content);head=b.sha;return Response.json({});}
   throw Error('Unexpected fixture Git call '+url);
  };
  const api=createItemApi({env,fetcher:transport});
  const call=async(actor,extra={})=>{
   const response=await api(new Request('https://fixture-edge.invalid',{method:'POST',headers:{Authorization:'Bearer '+actor},body:JSON.stringify({domain:'shared-item',category:'ammo',itemId:'api-item',...extra})}));
   return {status:response.status,result:await response.json()};
  };
  assert.equal((await call(armourUser,{action:'load'})).status,403);
  assert.equal((await call('bad-token',{action:'load'})).status,401);
  assert.equal((await call(alice,{action:'load',payload:{verification:'forged'}})).status,400);
  assert.equal((await call(alice,{action:'load'})).result.currentVersion,0);
  assert.equal((await call(alice,{action:'list'})).result.records.length,2);
  assert.equal((await call(alice,{action:'load'})).result.usage[0].price,123);
  const request=crypto.randomUUID(),edit={action:'edit',expectedRevision:0,shared:{name:'One connected edit'},specialist:{damage:'6 x 5 = 30'}};
  const prepared=await call(alice,{action:'prepare',expectedVersion:0,requestId:request,command:edit});assert.equal(prepared.status,200);
  assert.deepEqual((await call(alice,{action:'prepare',expectedVersion:0,requestId:request,command:edit})).result,prepared.result);
  assert.equal((await call(bob,{action:'save',expectedVersion:0,requestId:request})).status,403);
  const apiSaved=await call(alice,{action:'save',expectedVersion:0,requestId:request});assert.equal(apiSaved.status,200);assert.equal(apiSaved.result.currentVersion,1);
  assert.equal((await call(bob,{action:'load'})).result.state.records.items.name,'One connected edit');
  assert.equal(docs['data/items.json'].data[0].name,'API Ammo');assert.equal(gitWrites,0);
  assert.equal((await call(alice,{action:'publish',expectedVersion:1,confirm:true})).status,400);
  const preview=await call(alice,{action:'preview',expectedVersion:1});assert.equal(preview.status,200);assert(!JSON.stringify(preview.result.preview).includes(alice));
  assert.equal((await call(bob,{action:'publish',expectedVersion:1,previewId:preview.result.previewId,confirm:true})).status,409);
  docs['data/items.json'].data[1].name='A newer unrelated edit';
  assert.equal((await call(alice,{action:'publish',expectedVersion:1,previewId:preview.result.previewId,confirm:true})).status,409);assert.equal(gitWrites,0);
  const newPreview=await call(alice,{action:'preview',expectedVersion:1});assert.equal(newPreview.status,200);
  const published=await call(alice,{action:'publish',expectedVersion:1,previewId:newPreview.result.previewId,confirm:true});assert.equal(published.status,200);
  assert.equal(docs['data/items.json'].data[0].name,'One connected edit');assert.equal(docs['data/ammo.json'].data[0].name,'One connected edit');
  assert.equal(docs['data/ammo.json'].data[0].damage,'6 x 5 = 30');assert.equal(docs['data/items.json'].data[1].name,'A newer unrelated edit');
  const oldSource=structuredClone(docs['data/items.json']),oldCatalogue=seed('items',oldSource);oldCatalogue.data.find(r=>r.id==='api-item').name='Pending legacy change';
  await db.query('insert into scavland_drafts.versions values ($1,$2,$3,$4)',['items','catalogue',20,{source:oldSource,catalogue:oldCatalogue}]);
  const blocked=await call(alice,{action:'load'});assert.equal(blocked.status,409);assert(!JSON.stringify(blocked.result).includes('Pending legacy change'));
  assert.equal((await db.query("select payload->'catalogue'->'data'->0->>'name' as name from scavland_drafts.versions")).rows[0].name,'Pending legacy change');
  await assert.rejects(invoke(alice,'select public.scavland_item_legacy() as v'),e=>e.code==='42501');
  if(process.env.SCAVLAND_BROWSER==='1'){
   const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'msedge'});
   try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
     const req=route.request(),u=new URL(req.url());
     if(u.origin==='https://demtoqsafufzmnhvaykj.supabase.co'){
      const headers={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
      if(req.method()==='OPTIONS')return route.fulfill({headers,body:'ok'});
      const response=await api(new Request('https://fixture-edge.invalid',{method:'POST',headers:{Authorization:req.headers().authorization},body:req.postData()}));
      return route.fulfill({status:response.status,headers,json:await response.json()});
     }
     assert.equal(u.origin,'https://scavlandfanbase.github.io');
     if(u.pathname==='/test-ammo-host.html')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}iframe{border:0;width:100%;height:100vh}</style><body><script>addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.querySelector('iframe')?.contentWindow&&e.data?.type==='scavland-admin-ready')e.source.postMessage({type:'scavland-admin-token',token:'${alice}'},location.origin)});</script><iframe src="ammo-category.html?embed=1"></iframe>`});
     const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'missing'});
     return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json'});
    });
    await page.goto('https://scavlandfanbase.github.io/test-ammo-host.html');const frame=page.frameLocator('iframe');
    await frame.locator('#blocked').filter({hasText:'pending work'}).waitFor();assert.equal(await frame.locator('#item-form').isVisible(),false);
    assert.equal(await frame.locator('#publish').isDisabled(),true);
    await db.exec('delete from scavland_drafts.versions'); // Local fixture only, never production.
    await page.reload();await frame.locator('#item-form').waitFor();
    assert.equal(await frame.getByLabel('Damage',{exact:true}).inputValue(),'6 x 5 = 30');
    assert.equal(await frame.getByLabel('Penetration (%)',{exact:true}).inputValue(),'-25');
    assert.match(await frame.locator('#usage').innerText(),/Fixture shop.*123.*3.*5/);
    await frame.getByLabel('Name',{exact:true}).fill('Browser connected Ammo');
    await frame.getByLabel('Damage',{exact:true}).fill('8 x 12');
    assert.equal(await frame.locator('#publish').isDisabled(),true);
    await frame.getByRole('button',{name:'Save private draft',exact:true}).click();
    await frame.locator('#status').filter({hasText:'Saved — private item draft'}).waitFor();
    assert.equal(docs['data/items.json'].data[0].name,'One connected edit','browser save remains private');
    await page.reload();await frame.locator('#item-form').waitFor();assert.equal(await frame.getByLabel('Name',{exact:true}).inputValue(),'Browser connected Ammo');
    await frame.getByRole('button',{name:'Preview this item',exact:true}).click();
    const dialog=frame.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.innerText(),/8 x 12/);assert(!(await dialog.innerText()).includes(alice));
    await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.equal(await frame.locator('#publish').isEnabled(),true);
    const vendorBefore=structuredClone(docs['data/vendors.json']);
    await frame.getByRole('button',{name:'Publish this item',exact:true}).click();await dialog.getByRole('button',{name:'Publish this item',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.equal(docs['data/items.json'].data[0].name,'Browser connected Ammo');assert.equal(docs['data/ammo.json'].data[0].name,'Browser connected Ammo');
    assert.equal(docs['data/ammo.json'].data[0].damage,'8 x 12');assert.deepEqual(docs['data/vendors.json'],vendorBefore);
    assert.equal(await frame.locator('#preview').isDisabled(),true);
    // A second edit after publication must use its own confirmed public baseline.
    await page.reload();await frame.locator('#item-form').waitFor();await frame.getByLabel('Name',{exact:true}).fill('Second connected edit');
    await frame.getByRole('button',{name:'Save private draft',exact:true}).click();await frame.locator('#status').filter({hasText:'Saved — private item draft'}).waitFor();
    const publicBeforeReview=structuredClone(docs);
    await frame.getByRole('button',{name:'Review verification',exact:true}).click();
    await dialog.getByLabel('Review decision',{exact:true}).selectOption('verified');
    await dialog.getByRole('button',{name:'Record review',exact:true}).click();await dialog.waitFor({state:'detached'});
    let reviewedState=(await call(alice,{action:'load'})).result;
    assert.equal(reviewedState.state.records.ammo.verification.decision,'verified');
    assert.equal(reviewedState.state.records.ammo.verification.history.at(-1).by,alice);
    assert.deepEqual(docs,publicBeforeReview,'review stays private');
    await page.reload();await frame.locator('#item-form').waitFor();assert.match(await frame.locator('#verification').innerText(),/Verified/);
    await frame.getByRole('button',{name:'Preview this item',exact:true}).click();await dialog.waitFor();assert.match(await dialog.innerText(),/Verified/);assert(!(await dialog.innerText()).includes(alice));
    await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
    await frame.getByRole('button',{name:'Review verification',exact:true}).click();
    assert.equal(await dialog.getByLabel('Review decision',{exact:true}).inputValue(),'unverified');
    await dialog.getByRole('button',{name:'Record review',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.equal(await frame.locator('#publish').isDisabled(),true,'new review invalidates old preview');
    reviewedState=(await call(alice,{action:'load'})).result;
    assert.equal(reviewedState.state.records.ammo.verification.history.length,2);
    assert.equal(reviewedState.state.records.ammo.verification.decision,'unverified');
    assert.deepEqual(docs,publicBeforeReview);
    await frame.getByRole('button',{name:'Preview this item',exact:true}).click();await dialog.waitFor();
    await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
    await frame.getByRole('button',{name:'Publish this item',exact:true}).click();await dialog.getByRole('button',{name:'Publish this item',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.deepEqual(docs['data/ammo.json'].data[0].verification,{schemaVersion:2,decision:'unverified',verified_patch_id:'fixture-patch'});
    assert.deepEqual(docs['data/vendors.json'],vendorBefore);
    assert(!(JSON.stringify(docs).includes(alice)));
    const retained=(await call(alice,{action:'load'})).result.state.records.ammo.verification;
    assert.equal(retained.history.length,2,'publication retains full private review history');
    for(const width of [320,1280]){await page.setViewportSize({width,height:900});assert(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    if(process.env.SCAVLAND_SHOT)await page.screenshot({path:process.env.SCAVLAND_SHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS shared Ammo browser: protected legacy work, signed-in handoff, damage/penetration, vendor usage, private edit/reload, item preview/explicit connected publish, vendor-value preservation, second post-publication edit and 320–1280px layouts.');
   }finally{await browser.close();}
  }
  console.log('PASS authenticated item API: caller Auth, category permission, pinned sources, trusted receipt recovery, shared session drafts, actor/version/digest-bound preview, explicit atomic publish, changed-preview rejection, private old-draft blocker and no production calls.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
