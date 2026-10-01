const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite(),actor=crypto.randomUUID(),other=crypto.randomUUID();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.fixture_permissions(actor uuid primary key,allowed boolean);
 insert into public.fixture_permissions values('${actor}',true),('${other}',false);
 create function public.has_scavland_permission(p text) returns boolean language sql stable security definer set search_path='' as $$select coalesce((select allowed from public.fixture_permissions where actor=auth.uid()),false) and p='content_edit'$$;
 grant usage on schema auth to authenticated;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/proposals/page-builder-storage.sql'),'utf8'));
 const {createPageApi}=await import('../supabase/functions/admin-drafts/page-api.mjs');
 const config={PAGE_BUILDER_ENABLED:'true',SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'private-fixture'};
 const log=[];let loseCommit=false,contexts=0;
 const fetcher=async(url,options)=>{
  log.push({url,options});const token=options.headers.Authorization;
  if(url.endsWith('/auth/v1/user'))return token==='Bearer '+actor?Response.json({id:actor}):Response.json({error:'private detail'},{status:401});
  const name=url.split('/').at(-1),body=JSON.parse(options.body),trusted=token==='Bearer private-fixture';
  const args=name==='scavland_page'?['p_action','p_page','p_request','p_after']:['p_actor','p_request','p_action','p_page','p_version','p_command','p_payload'];
  let result;
  try{result=await db.transaction(async tx=>{await tx.exec('set local role '+(trusted?'service_role':'authenticated'));await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[trusted?'':token.slice(7)]);
   return (await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as v',args.map(key=>body[key]??null))).rows[0].v;});}
  catch(error){return Response.json({code:error.code,message:'PRIVATE SQL DETAIL'},{status:400});}
  if(loseCommit&&name==='scavland_page'&&body.p_action==='commit'){loseCommit=false;throw Error('Lost committed response');}
  return Response.json(result);
 };
 const readContext=async({pageId,rpc})=>{
  contexts++;const pages=await rpc('scavland_page',{p_action:'list',p_page:null,p_request:null,p_after:null});
  return {approvedImages:['images/approved.png'],existingPages:pages.map(page=>({id:page.pageId,slug:page.slug})),currentPageId:pages.some(page=>page.pageId===pageId)?pageId:null};
 };
 const api=createPageApi({env:key=>config[key],fetcher,readContext});
 const call=(body,token=actor,handler=api)=>handler(new Request('https://fixture',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)}));
 const command={domain:'page-builder',action:'create',requestId:crypto.randomUUID(),page:{title:'Unknown',slug:'api-fixture',intro:'',sections:[]}};
 let before=log.length;assert.equal((await call(command,actor,createPageApi({env:()=>undefined,fetcher}))).status,503);assert.equal(log.length,before);
 assert.equal((await call(command,null)).status,401);
 assert.equal((await call({...command,page:{...command.page,title:'x'.repeat(1100000)}})).status,413);
 before=log.length;assert.equal((await call({...command,actor:'forged'})).status,400);assert.equal(log.length,before);
 assert.equal((await call(command,other)).status,403);assert.ok(!log.slice(before).some(entry=>entry.options.headers.apikey==='private-fixture'));
 assert.equal((await call({...command,requestId:crypto.randomUUID(),page:{...command.page,approved:true}})).status,400);
 const imageCommand={...command,requestId:crypto.randomUUID(),page:{...command.page,slug:'invalid-image',sections:[{id:'section',title:'',hidden:false,layout:{},blocks:[{id:'image',type:'image',hidden:false,image:null,alt:'Unknown'}]}]}};
 assert.equal((await call(imageCommand)).status,400);assert.equal((await db.query('select count(*)::integer as n from scavland_pages.versions')).rows[0].n,0);
 loseCommit=true;assert.equal((await call(command)).status,503);
 const retried=await call(command);assert.equal(retried.status,200);const first=await retried.json();assert.equal(first.replayed,true);assert.equal(first.draft.saved_by,actor);assert.equal(first.draft.payload.title,'Unknown');assert.ok(first.draft.page_id);
 assert.equal((await db.query('select count(*)::integer as n from scavland_pages.versions')).rows[0].n,1);
 assert.equal((await call({...command,page:{...command.page,title:'Changed retry'}})).status,409);
 const pageId=first.draft.page_id,save={domain:'page-builder',action:'save',pageId,expectedVersion:1,requestId:crypto.randomUUID(),page:{...first.draft.payload,title:'Edited'}};
 const saved=await call(save);assert.equal(saved.status,200);assert.equal((await saved.json()).currentVersion,2);
 assert.equal((await call({...save,requestId:crypto.randomUUID()})).status,409);
 const missingContext=createPageApi({env:key=>config[key],fetcher});
 assert.equal((await call({...command,requestId:crypto.randomUUID()},actor,missingContext)).status,503);
 const list=await (await call({domain:'page-builder',action:'list'})).json();assert.equal(list.pages.length,1);assert.equal(list.nextCursor,null);assert.ok(!('payload' in list.pages[0]));
 assert.deepEqual((await (await call({domain:'page-builder',action:'list',after:pageId})).json()).pages,[]);
 assert.equal((await call({domain:'page-builder',action:'archive',pageId,expectedVersion:2,requestId:crypto.randomUUID()})).status,200);
 await db.query('update public.fixture_permissions set allowed=false where actor=$1',[actor]);
 const denied=await call(command);assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes('PRIVATE SQL DETAIL'));
 assert.ok(contexts>=2);assert.ok(log.filter(entry=>entry.url.endsWith('scavland_prepare_page')).every(entry=>entry.options.headers.apikey==='private-fixture'));
 const modelPath=path.join(__dirname,'../supabase/functions/admin-drafts/page-model.mjs');
 const modelText=fs.readFileSync(modelPath,'utf8').replace(/\r\n/g,'\n'),hash=/Original normalized SHA-256: ([a-f0-9]{64})/.exec(modelText)[1];
 const inner=modelText.split('const model=(()=>{\n')[1].split('})();\nexport default model;')[0];
 const umd="(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavPageBuilderModel=api;})(globalThis,()=>{\n"+inner+'});\n';
 assert.equal(crypto.createHash('sha256').update(umd).digest('hex'),hash,'ESM adaptation must preserve reviewed model body exactly');
 console.log('PASS private Page Builder adapter with real local SQL: caller permissions, trusted validation, lost-response retry, stale edits, archive, model fingerprint and disabled gate. No live calls.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
