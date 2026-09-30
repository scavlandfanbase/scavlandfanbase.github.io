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
  console.log('PASS per-item SQL storage: private tables, trusted-only preparation, caller permissions/category membership, actor/receipt binding, immutable item versions, idempotent retry, second-session reads, stale-save rejection and existing-draft preservation.');
  // Real SQL through the authenticated bridge, with only Auth/GitHub transports mocked.
  const {createItemApi}=await import('../supabase/functions/admin-drafts/item-api.mjs');
  const {seed}=await import('../supabase/functions/admin-drafts/core.mjs');
  let docs={
   'data/items.json':{schemaVersion:1,data:[{id:'api-item',name:'API Ammo',classification:['ammunition'],category:null,description:null,image:null},{id:'api-other',name:'Other Ammo',classification:['ammunition'],category:null,description:null,image:null}]},
   'data/ammo.json':{schemaVersion:1,data:[{id:'api-item',name:'API Ammo',category:'Special',damage:'46',penetrationPercent:-25},{id:'api-other',name:'Other Ammo',category:'Special',damage:'1'}]},
   'data/armour.json':{schemaVersion:1,data:[]},'data/weapons.json':{schemaVersion:1,data:[]},
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
  console.log('PASS authenticated item API: caller Auth, category permission, pinned sources, trusted receipt recovery, shared session drafts, actor/version/digest-bound preview, explicit atomic publish, changed-preview rejection, private old-draft blocker and no production calls.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
