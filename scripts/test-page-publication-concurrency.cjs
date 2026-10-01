// Isolated PostgreSQL acceptance; refuses non-loopback hosts and creates its own database.
// SCAVLAND_PSQL must point to psql. No production URL or credentials are accepted.
const assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const binary=process.env.SCAVLAND_PSQL;if(!binary)throw Error('Set SCAVLAND_PSQL to a local psql executable.');
const port=process.env.SCAVLAND_PG_TEST_PORT||'55437';if(!/^\d{4,5}$/.test(port))throw Error('Invalid local test port.');
const database='scavland_acceptance_'+crypto.randomBytes(6).toString('hex');
const actor='11111111-1111-4111-8111-111111111111';
const quote=v=>"'"+String(typeof v==='object'?JSON.stringify(v):v).replaceAll("'","''")+"'";
const args=db=>['-X','-qAt','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')));
function once(db,sql){return execFileSync(binary,[...args(db),'-c',sql],{env:cleanEnv,encoding:'utf8',timeout:15000}).trim();}
class Session{
 constructor(name){this.process=spawn(binary,args(database),{env:{...cleanEnv,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});this.out='';this.err='';this.pending=null;
  this.process.stdout.on('data',data=>{this.out+=data;this.check();});this.process.stderr.on('data',data=>{this.err+=data;});
  this.process.on('error',e=>this.reject(e));this.process.on('close',code=>{this.closed=true;if(this.pending)this.reject(Error(this.err||'psql exited '+code));});}
 reject(e){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=null;}}
 check(){if(this.pending&&this.out.includes(this.pending.marker)){const result=this.out.split(this.pending.marker)[0].trim();clearTimeout(this.pending.timer);this.pending.resolve(result);this.pending=null;this.out='';}}
 query(sql){assert.equal(this.pending,null);this.out='';const marker='done_'+crypto.randomBytes(8).toString('hex');return new Promise((resolve,reject)=>{this.pending={marker,resolve,reject,timer:setTimeout(()=>{this.process.kill();this.reject(Error('Timed out waiting for SQL result'));},12000)};this.process.stdin.write(sql+';\n\\echo '+marker+'\n');});}
 close(){if(!this.closed)this.process.stdin.end('ROLLBACK;\n\\q\n');}
}
async function waitBlocked(){for(let i=0;i<100;i++){if(once(database,"select count(*) from pg_stat_activity where application_name='scavland-test-b' and wait_event_type='Lock' and wait_event='advisory'")==='1')return;await new Promise(r=>setTimeout(r,20));}throw Error('Independent session did not block on advisory lock');}
async function race(label,sqlA,sqlB,{roleA=auth(actor),roleB=auth(actor),rollback=false,conflict=false}={}){
 const a=new Session('scavland-test-a'),b=new Session('scavland-test-b');try{
  await a.query("begin;set local statement_timeout='10s';set local lock_timeout='8s';"+roleA);
  await b.query("begin;set local statement_timeout='10s';set local lock_timeout='8s';"+roleB);
  const first=await a.query(sqlA),pending=b.query(sqlB).then(value=>({value}),error=>({error}));await waitBlocked();
  await a.query(rollback?'rollback':'commit');const second=await pending;
  if(conflict){assert.ok(second.error,label);assert.match(second.error.message,/PT409/,label);}else{if(second.error)throw second.error;await b.query('commit');}
  console.log('PASS '+label+' — observed independent advisory-lock wait, '+(conflict?'PT409':'successful receipt')+'.');return {first,second};
 }finally{a.close();b.close();}
}


const auth=who=>"set local role authenticated;select set_config('request.jwt.claim.sub',"+quote(who)+",true)";
const service='set local role service_role';
const prep=(r,action,id,v,command,payload=null)=>'select public.scavland_prepare_page('+[actor,r,action].map(quote).join(',')+','+(id?quote(id):'null')+','+v+','+quote(command)+','+(payload?quote(payload):'null')+')';
const commit=(id,r)=>"select public.scavland_page('commit',"+quote(id)+','+quote(r)+')';
const reserve=(r,preview)=>'select public.scavland_reserve_page_publication('+quote(r)+','+quote(preview)+')';
async function seed(slug){
 const {createTrustedPagePreview}=await import('../supabase/functions/admin-drafts/page-preview.mjs');
 const r=crypto.randomUUID(),command={title:'Unknown',slug,intro:'',sections:[]};
 const allocation=JSON.parse(once(database,service+';'+prep(r,'create',null,0,command))),payload={id:allocation.page_id,...command};
 once(database,service+';'+prep(r,'create',null,0,command,payload));
 const saved=JSON.parse(once(database,auth(actor)+';'+commit(allocation.page_id,r)).split(/\r?\n/).at(-1)).draft;
 const preview=await createTrustedPagePreview({saved,snapshot:{head:'a'.repeat(40),manifest:{schemaVersion:1,pages:[]},context:{approvedImages:[],existingPages:[{id:payload.id,slug}],currentPageId:payload.id}}});
 const previewId=crypto.randomUUID();
 once(database,service+';select public.scavland_prepare_page_preview('+[actor,previewId,payload.id,1,preview].map(quote).join(',')+')');
 const saveRequest=crypto.randomUUID(),edited={...payload,title:'Later'};
 once(database,service+';'+prep(saveRequest,'save',payload.id,1,{page:edited},edited));
 return {id:payload.id,previewId,saveRequest,preview};
}
(async()=>{let created=false;try{
 once('postgres','create database '+database);created=true;
 once(database,"create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select auth.uid()='"+actor+"'::uuid and p='content_edit'$$;create table public.fixture_owners(id uuid primary key,enabled boolean);insert into public.fixture_owners values('"+actor+"',true);create function public.is_scavland_owner() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select enabled from public.fixture_owners where id=auth.uid()),false)$$;grant usage on schema auth to authenticated");
 for(const file of ['page-builder-storage.sql','page-builder-publication.sql','page-builder-git-candidate.sql','page-builder-dispatch.sql','page-builder-read.sql','page-builder-recovery.sql'])once(database,fs.readFileSync(path.join(__dirname,'../supabase/proposals',file),'utf8'));
 console.log('PostgreSQL '+once(database,'show server_version')+'; isolation '+once(database,'show transaction_isolation'));
 let page=await seed('reservation-first');
 await race('Publication reservation refuses a waiting save',reserve(crypto.randomUUID(),page.previewId),commit(page.id,page.saveRequest),{conflict:true});
 assert.equal(once(database,'select count(*) from scavland_pages.versions where page_id='+quote(page.id)),'1');
 page=await seed('save-first');
 await race('Save makes the waiting preview reservation stale',commit(page.id,page.saveRequest),reserve(crypto.randomUUID(),page.previewId),{conflict:true});
 assert.equal(once(database,'select count(*) from scavland_pages.publications where page_id='+quote(page.id)),'0');
 page=await seed('competing-reservations');
 await race('Competing publication requests retain one intent',reserve(crypto.randomUUID(),page.previewId),reserve(crypto.randomUUID(),page.previewId),{conflict:true});
 assert.equal(once(database,'select count(*) from scavland_pages.publications where page_id='+quote(page.id)),'1');
 page=await seed('same-reservation');let request=crypto.randomUUID();
 const result=await race('Exact concurrent publication retry returns one intent',reserve(request,page.previewId),reserve(request,page.previewId));assert.deepEqual(JSON.parse(result.first),JSON.parse(result.second.value));
 assert.equal(once(database,'select count(*) from scavland_pages.publications where page_id='+quote(page.id)),'1');
 page=await seed('reservation-rollback');
 await race('Rolled-back reservation lets the waiting save commit',reserve(crypto.randomUUID(),page.previewId),commit(page.id,page.saveRequest),{rollback:true});
 assert.equal(once(database,'select count(*) from scavland_pages.publications where page_id='+quote(page.id)),'0');
 assert.equal(once(database,'select count(*) from scavland_pages.versions where page_id='+quote(page.id)),'2');
 page=await seed('owner-revoked-while-waiting');
 const holder=new Session('scavland-test-a'),waiting=new Session('scavland-test-b');
 try{
  await holder.query("begin;select pg_advisory_xact_lock(hashtextextended('page-catalogue-write',0))");
  await waiting.query('begin;'+auth(actor));
  const pending=waiting.query(reserve(crypto.randomUUID(),page.previewId)).then(value=>({value}),error=>({error}));
  await waitBlocked();once(database,"update public.fixture_owners set enabled=false where id="+quote(actor));
  await holder.query('commit');const denied=await pending;assert.ok(denied.error);assert.match(denied.error.message,/42501/);
  assert.equal(once(database,'select count(*) from scavland_pages.publications where page_id='+quote(page.id)),'0');
  console.log('PASS Owner revocation during lock wait refuses publication — observed independent wait and 42501.');
 }finally{holder.close();waiting.close();once(database,"update public.fixture_owners set enabled=true where id="+quote(actor));}
 async function dispatchSeed(slug){const p=await seed(slug),r=crypto.randomUUID();once(database,auth(actor)+';'+reserve(r,p.previewId));
 const candidate={requestId:r,commit:'c'.repeat(40),tree:'d'.repeat(40),baseHead:p.preview.baseHead,digest:p.preview.digest,path:p.preview.path};
 once(database,service+';select public.scavland_prepare_page_git_candidate('+quote(r)+','+quote(candidate)+')');return {...p,request:r};}
 const dispatch=(r,a,action)=>'select public.scavland_page_dispatch('+[r,a,action].map(quote).join(',')+')';
 page=await dispatchSeed('single-dispatch-race');
 const attempts=await race('Concurrent dispatchers acquire exactly one claim',dispatch(page.request,crypto.randomUUID(),'claim'),dispatch(page.request,crypto.randomUUID(),'claim'),{roleA:service,roleB:service});
 assert.equal(JSON.parse(attempts.first).acquired,true);assert.equal(JSON.parse(attempts.second.value).acquired,false);
 page=await dispatchSeed('dispatch-rollback');
 const rolled=await race('Rolled-back claim permits the waiting dispatcher',dispatch(page.request,crypto.randomUUID(),'claim'),dispatch(page.request,crypto.randomUUID(),'claim'),{roleA:service,roleB:service,rollback:true});
 assert.equal(JSON.parse(rolled.second.value).acquired,true);
 page=await dispatchSeed('refusal-save-race');const attempt=crypto.randomUUID();once(database,service+';'+dispatch(page.request,attempt,'claim'));
 await race('Proven no-write refusal releases a waiting save',dispatch(page.request,attempt,'refuse-no-write'),commit(page.id,page.saveRequest),{roleA:service});
 assert.equal(once(database,'select count(*) from scavland_pages.versions where page_id='+quote(page.id)),'2');
 const recovery=(r,a,action,f)=>'select public.scavland_page_recovery('+[r,a,action].map(quote).join(',')+','+quote(f)+')';
 page=await dispatchSeed('recovery-save-race');
 const recoveryAttempt=crypto.randomUUID(),fence={requestId:page.request,commit:'e'.repeat(40),baseHead:page.preview.baseHead,candidateCommit:'c'.repeat(40)};
 once(database,service+';'+recovery(page.request,recoveryAttempt,'prepare',fence)+';'+recovery(page.request,recoveryAttempt,'claim',fence));
 await race('Confirmed recovery fence releases waiting save',recovery(page.request,recoveryAttempt,'confirm',fence),commit(page.id,page.saveRequest),{roleA:service});
 assert.equal(once(database,'select count(*) from scavland_pages.versions where page_id='+quote(page.id)),'2');
 page=await dispatchSeed('recovery-original-race');
 const attemptRecovery=crypto.randomUUID(),fence2={...fence,requestId:page.request};
 once(database,service+';'+recovery(page.request,attemptRecovery,'prepare',fence2)+';'+recovery(page.request,attemptRecovery,'claim',fence2));
 const outcome='select public.scavland_page_publication_outcome('+[page.request,crypto.randomUUID(),{type:'commit',sha:'c'.repeat(40)}].map(quote).join(',')+')';
 await race('Terminal recovery refuses late original commit outcome',recovery(page.request,attemptRecovery,'confirm',fence2),outcome,{roleA:service,roleB:service,conflict:true});
 console.log('PASS eleven independent publication/edit/dispatch/recovery concurrency scenarios. No production calls.');
 }finally{if(created)once('postgres','drop database '+database+' with (force)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
