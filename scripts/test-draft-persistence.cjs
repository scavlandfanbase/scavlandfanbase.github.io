// PGlite 0.3.14 provides a real local PostgreSQL engine; no production calls.
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[pathRoot()]}));
function pathRoot(){return require('node:path').join(__dirname,'r1-test-runtime');}
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const Client=require('../draft-persistence.js');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-r1-'));
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
(async()=>{let db;try{
 const {createHandler}=await import('../supabase/functions/admin-drafts/handler.mjs');
 db=new PGlite(directory);
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.admin_users(user_id uuid,role text,is_active boolean,permissions text[]);
 insert into public.admin_users values
 ('${alice}','owner',true,'{}'),('${bob}','admin',true,'{items_edit,ammunition_edit,vendors_edit,content_edit}'),
 ('33333333-3333-4333-8333-333333333333','reviewer',true,'{evidence_review}'),
 ('44444444-4444-4444-8444-444444444444','admin',false,'{items_edit}');
 create function public.has_scavland_permission(required_permission text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid() and is_active=true and (role='owner' or required_permission=any(permissions))) $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/r1-private-drafts.sql'),'utf8'));
 const perms='items_edit,ammunition_edit,vendors_edit,content_edit';
 async function rpc(body,actor=alice,permissions=perms){
  return db.transaction(async tx=>{
   await tx.exec('set local role authenticated');
   await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('test.permissions',$2,true)",[actor,permissions]);
   const result=await tx.query('select public.scavland_draft($1,$2,$3,$4,$5,$6,$7) as value',[body.p_action,body.p_domain,body.p_entity_id,body.p_expected_version??null,body.p_payload??null,body.p_base??null,body.p_request_id??null]);return result.rows[0].value;
  });
 }
 let transportFail=false,loseResponse=false,publishFail=false,publicWrites=0;
 const fetcher=async(url,opt)=>{
  assert.equal(url,'https://supabase.test/rest/v1/rpc/scavland_draft');
  const token=opt.headers.Authorization.split(' ')[1];if(!['alice','bob','reviewer','inactive'].includes(token))return Response.json({message:'Invalid session'},{status:401});
  if(transportFail){transportFail=false;throw Error('offline');}
  try{const value=await rpc(JSON.parse(opt.body),({alice,bob,reviewer:'33333333-3333-4333-8333-333333333333',inactive:'44444444-4444-4444-8444-444444444444'})[token]);return Response.json(value);}catch(e){return Response.json({message:e.message,code:e.code},{status:e.code==='42501'?403:e.code==='PT409'?409:400});}
 };
 const env=k=>({SUPABASE_URL:'https://supabase.test',SUPABASE_ANON_KEY:'public',DRAFT_PUBLISH_ENABLED:'true'})[k];
 const adapter={validate:d=>{assert.equal(d.domain,'items');if(!d.payload.name)throw Object.assign(Error('Name required to publish'),{status:400});},preview:d=>({name:d.payload.name}),publish:d=>{if(publishFail)throw Error('publisher unavailable');publicWrites++;return {commit:'test-commit',name:d.payload.name};}};
 const handler=createHandler({env,fetcher,publishers:{items:adapter}});
 const states=[];
 const device=(token='alice')=>Client.create({endpoint:'https://edge.test',apiKey:'public',getToken:()=>token,domain:'items',entityId:'stable-id',onState:s=>states.push(s),fetcher:async(url,opt)=>{assert.equal(url,'https://edge.test');const result=await handler(new Request(url,opt));if(loseResponse&&JSON.parse(opt.body).action==='save'){loseResponse=false;throw Error('response lost');}return result;}});
 let pc=device(),phone=device('bob');assert.equal(await pc.load(),null);
 const payload={id:'stable-id',name:'Original',unknown:null,zero:0,damage:'6 x 5 = 30',modifiers:{handling:6},source:{file:'evidence-inbox/test.png'}};
 const first=await pc.save(payload,{});assert.equal(first.version,1);assert.equal(first.saved_by,alice);assert.deepEqual(first.payload,payload);assert.equal(publicWrites,0);
 assert.equal(states.at(-1).state,'saved');assert.equal(states.at(-2).state,'saving');
 assert.deepEqual((await phone.load()).payload,payload);assert.equal(await db.query("select has_table_privilege('authenticated','scavland_drafts.versions','UPDATE') as allowed").then(r=>r.rows[0].allowed),false);
 // Close the actual engine; a fresh process/session can recover the same durable data.
 await db.close();db=new PGlite(directory);pc=device();assert.deepEqual((await pc.load()).payload,payload);
 const newer=await phone.save({...payload,name:'Phone'},{});assert.equal(newer.version,2);assert.equal(newer.saved_by,bob);
 await assert.rejects(pc.save({...payload,name:'Stale PC'},{}),e=>e.status===409);assert.equal(states.at(-1).state,'conflict');assert.equal(pc.getPending().payload.name,'Stale PC');
 await assert.rejects(pc.load(),/explicitly discard/);await pc.load({discardPending:true});
 transportFail=true;await assert.rejects(pc.save({...payload,name:'Retry me'},{}));assert.equal(pc.getPending().payload.name,'Retry me');assert.equal(states.at(-1).state,'error');const request=pc.getPending().requestId;await pc.retry();assert.equal(states.at(-1).state,'saved');
 const saved=await phone.load();assert.equal(saved.version,3);assert.equal(saved.request_id,request);
 loseResponse=true;await assert.rejects(pc.save({...payload,name:'Saved but lost reply'},{}));await pc.retry();assert.equal((await phone.load()).version,4);
 // Receipt remains valid after another device advances the head; no duplicate write.
 loseResponse=true;await assert.rejects(pc.save({...payload,name:'Earlier receipt'},{}));await phone.load();await phone.save({...payload,name:'Later device'},{});await assert.rejects(pc.retry(),e=>e.status===409);assert.equal((await phone.load()).version,6);
 await assert.rejects(device('reviewer').load(),e=>e.status===403);await assert.rejects(device('inactive').load(),e=>e.status===403);await assert.rejects(device('invalid').load(),e=>e.status===401);
 await db.transaction(async tx=>{await tx.exec('set local role anon');await assert.rejects(tx.query("select public.scavland_draft('load','items','stable-id')"),/permission denied/);});
 for(const bad of [{p_payload:[]},{p_expected_version:-1},{p_base:{'../bad':'oops'}}])await assert.rejects(rpc({p_action:'save',p_domain:'items',p_entity_id:'stable-id',p_expected_version:6,p_payload:payload,p_base:{},p_request_id:crypto.randomUUID(),...bad}));
 await assert.rejects(rpc({p_action:'load',p_domain:'attachments',p_entity_id:'stable-id'}),/permission/);
 await assert.rejects(rpc({p_action:'delete',p_domain:'items',p_entity_id:'stable-id'}),/Invalid/);
 await pc.load({discardPending:true});await pc.preview();assert.equal(publicWrites,0);
 await assert.rejects(pc.publish(),e=>e.status===400);assert.equal(publicWrites,0);
 publishFail=true;await assert.rejects(pc.publish({confirm:true}));assert.equal((await phone.load()).version,6);publishFail=false;
 const published=await pc.publish({confirm:true});assert.equal(published.publishedVersion,6);assert.equal(publicWrites,1);assert.equal((await phone.load()).version,6);
 const staleVersion=6;await phone.save({...payload,name:'Version 7'},{});await assert.rejects(pc.publish({confirm:true}),e=>e.status===409);assert.equal(publicWrites,1);
 const locked=createHandler({env:k=>k==='DRAFT_PUBLISH_ENABLED'?'false':env(k),fetcher,publishers:{items:adapter}});
 const req=()=>new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer alice'},body:JSON.stringify({action:'publish',domain:'items',entityId:'stable-id',expectedVersion:7,confirm:true})});
 assert.equal((await locked(req())).status,503);assert.equal((await createHandler({env,fetcher})(req())).status,503);assert.equal(publicWrites,1);
 await pc.load();await assert.rejects(pc.save({name:'bad',value:NaN},{}),/valid JSON/);assert.equal(pc.getPending(),null);
 const competing={p_action:'save',p_domain:'ammo',p_entity_id:'concurrent',p_expected_version:0,p_payload:{name:'A'},p_base:{}};
 const races=await Promise.allSettled([rpc({...competing,p_request_id:crypto.randomUUID()}),rpc({...competing,p_request_id:crypto.randomUUID()})]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.find(r=>r.status==='rejected').reason.code,'PT409');
 const count=await db.query('select count(*)::int as count from scavland_drafts.versions');assert.equal(count.rows[0].count,8);
 console.log('PASS R1 PostgreSQL + endpoint + client: durable restart, separate authenticated sessions, exact payloads, immutable identity, request receipts, auth/RPC isolation, conflicts, retained errors/retry, preview, explicit publish, failed publication retains drafts, default publish disabled.');
}finally{if(db)await db.close();fs.rmSync(directory,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
