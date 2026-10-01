const assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const {createPageControlApi}=await import('../supabase/functions/admin-drafts/page-control-api.mjs');
 const actor=crypto.randomUUID(),pageId=crypto.randomUUID(),previewId=crypto.randomUUID(),requestId=crypto.randomUUID();
 const saved={page_id:pageId,version:1,archived:false,payload:{id:pageId,title:'Field notes',slug:'field-notes',intro:'Unknown',sections:[]}};
 const snapshot={head:'a'.repeat(40),manifest:{schemaVersion:1,pages:[]},context:{approvedImages:[],existingPages:[{id:pageId,slug:'field-notes'}],currentPageId:pageId}};
 const config={PAGE_BUILDER_ENABLED:'true',SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'};
 let preview,publication,candidate,allowed=true,owner=true,claimed=false,dispatches=0,observations=0,build='pending',result='committed',log=[];
 const fetcher=async(url,options)=>{
  log.push(url);if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});
  const args=JSON.parse(options.body),name=url.split('/').at(-1),trusted=options.headers.Authorization==='Bearer private';
  if(!trusted&&!allowed)return Response.json({code:'42501'},{status:400});
  if(name==='is_scavland_owner')return Response.json(owner);
  if(name==='scavland_page')return Response.json(args.p_action==='list'?[]:{draft:saved,currentVersion:1});
  if(name==='scavland_read_page_work'){
   if(args.p_action==='history')return Response.json([{version:1,archived:false}]);
   if(args.p_action==='revision')return Response.json(saved);
   if(!owner)return Response.json({code:'42501'},{status:400});
   return Response.json({publication,preview,saved,candidate});
  }
  if(name==='scavland_prepare_page_preview'){assert(trusted);assert.equal(args.p_actor,actor);preview=args.p_preview;return Response.json({});}
  if(name==='scavland_reserve_page_publication'){
   assert(!trusted);if(!owner)return Response.json({code:'42501'},{status:400});
   publication??={request_id:requestId,actor,state:'prepared',created_at:'2026-10-01T12:00:00.000Z',commit_sha:null};return Response.json(publication);
  }
  if(name==='scavland_prepare_page_git_candidate'){assert(trusted);candidate=args.p_candidate;return Response.json(candidate);}
  if(name==='scavland_page_dispatch'){assert(trusted);if(args.p_action==='claim'){const acquired=!claimed;claimed=true;return Response.json({acquired});}publication.state='refused';return Response.json(publication);}
  if(name==='scavland_page_publication_outcome'){assert(trusted);if(args.p_event.type==='commit'){publication.state='committed';publication.commit_sha=args.p_event.sha;}else if(args.p_event.status==='success')publication.state='live';else if(args.p_event.status==='failure')publication.state='build-failed';return Response.json(publication);}
  throw Error('unexpected RPC '+name);
 };
 const api=createPageControlApi({env:key=>config[key],fetcher,readSnapshot:async()=>snapshot,
  publisherFactory:options=>async()=>{candidate={requestId,commit:'c'.repeat(40),baseHead:snapshot.head,tree:'b'.repeat(40),digest:preview.digest,path:preview.path};await options.persistCandidate(candidate);if(await options.claimAttempt(candidate))dispatches++;return {...candidate,state:result,noWrite:result==='refused'};},
  observeGit:async value=>{observations++;return {...value,state:'committed'};},discoverBuild:async()=> '123',readBuild:async({commit,buildId})=>({type:'build',sha:commit,runId:buildId,status:build})});
 const call=body=>api(new Request('https://fixture',{method:'POST',headers:{Authorization:'Bearer caller'},body:JSON.stringify({domain:'page-builder',...body})}));
 assert.equal((await call({action:'source'})).status,200);
 assert.equal((await call({action:'history',pageId})).status,200);assert.equal((await call({action:'revision',pageId,version:1})).status,200);
 assert.equal((await call({action:'preview',pageId,version:2,requestId:previewId})).status,409);
 assert.equal((await call({action:'preview',pageId,version:1,requestId:previewId})).status,200);assert.equal(preview.pageId,pageId);
 owner=false;assert.equal((await call({action:'publish',previewId,requestId})).status,403);assert.equal(dispatches,0);owner=true;
 assert.equal((await (await call({action:'publish',previewId,requestId})).json()).publication.state,'committed');assert.equal(dispatches,1);
 build='success';assert.equal((await (await call({action:'status',requestId})).json()).publication.state,'live');assert.equal(dispatches,1);
 publication.state='prepared';candidate=null;assert.equal((await (await call({action:'status',requestId})).json()).uncertain,true);assert.equal(observations,0);
 candidate={commit:'c'.repeat(40)};build='pending';assert.equal((await (await call({action:'status',requestId})).json()).publication.state,'committed');assert.equal(observations,1);assert.equal(dispatches,1);
 allowed=false;const before=log.length;assert.equal((await call({action:'preview',pageId,version:1,requestId:previewId})).status,403);assert.equal(log.length,before+1);
 assert.equal((await call({action:'status',requestId,evidence:{status:'success'}})).status,400);
 console.log('PASS Page control API fixtures: gated strict actions, caller permission before service work, saved preview, Owner publishing, status-only reconciliation and matching build confirmation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
