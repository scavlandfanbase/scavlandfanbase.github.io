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
  await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/shared-item-drafts.sql'),'utf8'));
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
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
