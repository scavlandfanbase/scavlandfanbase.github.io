const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.admin_users(user_id uuid primary key,role text,is_active boolean,permissions text[]);
  insert into public.admin_users values
  ('11111111-1111-4111-8111-111111111111','owner',true,'{}'),
  ('22222222-2222-4222-8222-222222222222','reviewer',true,'{evidence_review}'),
  ('33333333-3333-4333-8333-333333333333','admin',true,'{items_edit}');`);
  await db.exec(fs.readFileSync('supabase/proposals/reviewer-draft-permissions.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/proposals/reviewer-draft-activation.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/proposals/r1-private-drafts.sql','utf8'));
  const actor=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  const can=async permission=>(await db.query('select public.has_scavland_permission($1) as ok',[permission])).rows[0].ok;
  await actor('22222222-2222-4222-8222-222222222222');
  for(const p of ['items_edit','weapons_edit','armour_edit','ammunition_edit','vendors_edit','evidence_review'])assert.equal(await can(p),true,p);
  assert.equal(await can('publish_public'),false);
  await db.exec("update public.admin_users set permissions=permissions||array['publish_public'] where role='reviewer'");
  assert.equal(await can('publish_public'),false,'Reviewer cannot gain publication through permissions');
  const payload={catalogue:{data:[{id:'example',name:'Reviewer correction'}]}};
  await db.query("select public.scavland_draft('save','items','catalogue',0,$1,'{}','44444444-4444-4444-8444-444444444444')",[payload]);
  await actor('11111111-1111-4111-8111-111111111111');
  const saved=(await db.query("select public.scavland_draft('load','items','catalogue') as v")).rows[0].v;
  assert.deepEqual(saved.draft.payload,payload);assert.equal(saved.draft.saved_by,'22222222-2222-4222-8222-222222222222');
  assert.equal(await can('publish_public'),true);
  await actor('33333333-3333-4333-8333-333333333333');assert.equal(await can('publish_public'),true);
  await db.exec("update public.admin_users set is_active=false where role='reviewer'");
  await actor('22222222-2222-4222-8222-222222222222');assert.equal(await can('items_edit'),false);
  const {createHandler}=await import('../supabase/functions/admin-drafts/handler.mjs');
  let gitWrites=0;
  const handler=createHandler({env:k=>({SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'key',DRAFT_PUBLISH_ENABLED:'true'})[k],fetcher:async(url,options)=>{
   if(url.endsWith('/scavland_draft'))return Response.json(saved);
   if(url.endsWith('/has_scavland_permission')){assert.equal(JSON.parse(options.body).required_permission,'publish_public');assert.equal(options.headers.Authorization,'Bearer reviewer');return Response.json(false);}
   throw Error(url);
  },publishers:{items:{validate:async()=>{},publish:async()=>{gitWrites++;}}}});
  const response=await handler(new Request('https://fixture',{method:'POST',headers:{Authorization:'Bearer reviewer'},body:JSON.stringify({domain:'items',entityId:'catalogue',action:'publish',expectedVersion:1,confirm:true})}));
  assert.equal(response.status,403);assert.equal(gitWrites,0);
  console.log('PASS Reviewer shared private save/Owner read and author retention; Reviewer publication denied even with forged permission; inactive denied; Admin publishing retained; direct publish causes zero writes.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
