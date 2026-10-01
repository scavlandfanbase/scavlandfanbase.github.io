const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const id=crypto.randomUUID(),actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',root=path.join(__dirname,'..');let lose=false;
 const submission={id,item_name:'<script>unsafe()</script>',category:'Items',status:'pending',notes:'Original submission',screenshot_path:'fixture.png'};
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select auth.uid() in ('"+actor+"'::uuid,'"+other+"'::uuid) and p='evidence_review'$$;grant usage on schema auth to authenticated;create table public.evidence_submissions(id uuid primary key,created_at timestamptz default now(),submission_type text,category text,item_name text,notes text,screenshot_path text,status text default 'pending',reviewed_at timestamptz,review_notes text)");
 await db.query('insert into public.evidence_submissions(id,item_name,category,notes,screenshot_path) values($1,$2,$3,$4,$5)',[id,submission.item_name,submission.category,submission.notes,submission.screenshot_path]);
 await db.exec(fs.readFileSync(path.join(root,'supabase/proposals/evidence-review-history.sql'),'utf8'));
 const run=(who,sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);return (await tx.query(sql,args)).rows[0]?.v;});
 const state=()=>run(actor,'select public.scavland_evidence_state($1) as v',[id]);
 const names={scavland_evidence_state:['p_submission'],scavland_review_evidence:['p_submission','p_request','p_version','p_status','p_decision','p_notes'],scavland_evidence_queue:['p_status','p_before','p_before_id']};
 const {createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');
 const handler=createProductionHandler({env:key=>({EVIDENCE_REVIEW_ENABLED:'true',SUPABASE_URL:'https://fixture-db.test',SUPABASE_ANON_KEY:'fixture-anon'})[key],core:{publishers:{}},fetcher:async(url,options)=>{
  assert.ok(url.startsWith('https://fixture-db.test/rest/v1/rpc/'));assert.equal(options.headers.apikey,'fixture-anon');const auth=options.headers.Authorization;
  const who=auth==='Bearer fixture'?actor:auth==='Bearer other'?other:'33333333-3333-4333-8333-333333333333';
  const name=url.split('/').at(-1),body=JSON.parse(options.body),args=names[name].map(key=>body[key]);
  try{return Response.json(await run(who,'select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as v',args));}catch(e){return Response.json({code:e.code},{status:400});}
 }});
 await page.route('https://fixture.test/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);if(!file)return route.fulfill({contentType:'text/html',body:'<iframe src="evidence-review.html" style="width:100%;height:1000px;border:0"></iframe><script>addEventListener("message",e=>{if(e.data.type==="scavland-admin-ready")e.source.postMessage({type:"scavland-admin-token",token:"fixture"},location.origin)})</script>'});return route.fulfill({path:path.join(root,file)});});
 await page.route('https://demtoqsafufzmnhvaykj.supabase.co/**',async route=>{
  const req=route.request();
  if(req.url().includes('/storage/'))return route.fulfill({status:403,json:{error:'Fixture screenshot unavailable'}});
  const body=req.postDataJSON(),response=await handler(new Request(req.url(),{method:req.method(),headers:req.headers(),body:req.postData()}));
  if(body.action==='decide'&&lose&&response.ok){lose=false;return route.abort('failed');}
  return route.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers),"Access-Control-Allow-Origin":"https://fixture.test"},body:await response.text()});
 });
 await page.goto('https://fixture.test/');const f=page.frameLocator('iframe');await f.getByRole('button',{name:'<script>unsafe()</script> · pending',exact:true}).click();
 await f.locator('#status').filter({hasText:'Loaded saved evidence'}).waitFor();assert.equal(await f.locator('#name').textContent(),submission.item_name);assert.equal(await f.locator('#detail script').count(),0);
 await f.locator('#notes').fill('Review notes');lose=true;await f.locator('#approve').click();await f.locator('#retry:not(:disabled)').waitFor();assert.equal((await state()).version,1);assert.equal(await f.locator('#notes').inputValue(),'Review notes');assert(await f.locator('#approve').isDisabled());
 await f.locator('#retry').click();await f.locator('#status').filter({hasText:'Review recorded privately'}).waitFor();assert.equal((await state()).version,1);assert.equal(await f.locator('#history li').count(),1);assert.equal(submission.notes,'Original submission');
 await f.locator('#restore').click();await f.locator('#status').filter({hasText:'Review recorded privately'}).waitFor();await f.locator('#approve:not(:disabled)').waitFor();assert.equal((await state()).version,2);
 await run(other,'select public.scavland_review_evidence($1,$2,2,$3,$4,$5) as v',[id,crypto.randomUUID(),'pending','approved','Other reviewer notes']);await f.locator('#notes').fill('Keep stale notes');await f.locator('#reject').click();await f.locator('#status').filter({hasText:'Evidence review changed'}).waitFor();assert.equal(await f.locator('#notes').inputValue(),'Keep stale notes');assert(await f.locator('#approve').isDisabled());assert(await f.locator('#reject').isDisabled());
 await f.locator('#reload').click();await f.locator('#status').filter({hasText:'Loaded saved evidence'}).waitFor();assert.equal(await f.locator('#notes').inputValue(),'Other reviewer notes');
 const saved=await state();assert.equal(saved.version,3);assert.equal(saved.history.length,3);assert.equal(saved.history[0].actor,actor);assert.equal(saved.history[2].actor,other);assert.equal(saved.submission.notes,'Original submission');assert.equal(saved.submission.screenshot_path,'fixture.png');
 const denied=await handler(new Request('https://fixture.test/api',{method:'POST',headers:{Authorization:'Bearer denied'},body:JSON.stringify({domain:'evidence-review',action:'load',submissionId:id})}));assert.equal(denied.status,403);
 for(const width of [320,1280]){await page.setViewportSize({width,height:1100});assert(await f.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS combined Evidence browser/production handler/SQL: real durable decisions, lost-response retry, another reviewer conflict, protected history/source, denied permission and responsive recovery. Auth and Storage remain fixtures; no live calls.');
}finally{await browser.close();await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
