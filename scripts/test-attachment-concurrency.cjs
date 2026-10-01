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
const prepared=(item,request,version=0,legacy=0)=>'select public.scavland_prepare_attachment('+[actor,item,request,{action:'edit-attachment'},{itemId:item,category:'attachments',expectedVersion:version,actor,record:{id:item,contentType:'Attachment'}},legacy].map(quote).join(',')+')';
const save=(item,request)=>'select public.scavland_attachment_draft('+['save',item,request].map(quote).join(',')+')';
const auth="set local role authenticated;select set_config('request.jwt.claim.sub',"+quote(actor)+",true)";
async function waitBlocked(){for(let i=0;i<100;i++){if(once(database,"select count(*) from pg_stat_activity where application_name='scavland-test-b' and wait_event_type='Lock' and wait_event='advisory'")==='1')return;await new Promise(r=>setTimeout(r,20));}throw Error('Independent session did not block on advisory lock');}
async function race(label,sqlA,sqlB,{roleA=auth,roleB=auth,rollback=false,conflict=false}={}){
 const a=new Session('scavland-test-a'),b=new Session('scavland-test-b');try{
  await a.query("begin;set local statement_timeout='10s';set local lock_timeout='8s';"+roleA);
  await b.query("begin;set local statement_timeout='10s';set local lock_timeout='8s';"+roleB);
  const first=await a.query(sqlA),pending=b.query(sqlB).then(value=>({value}),error=>({error}));await waitBlocked();
  await a.query(rollback?'rollback':'commit');const second=await pending;
  if(conflict){assert.ok(second.error,label);assert.match(second.error.message,/PT409/,label);}else{if(second.error)throw second.error;await b.query('commit');}
  console.log('PASS '+label+' — observed independent advisory-lock wait, '+(conflict?'PT409':'successful receipt')+'.');return {first,second};
 }finally{a.close();b.close();}
}
(async()=>{let created=false;try{
 once('postgres','create database '+database);created=true;
 once(database,"do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end $$");
 once(database,"create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select auth.uid()='"+actor+"'::uuid and p in ('items_edit','ammunition_edit')$$;grant usage on schema auth to authenticated;create schema scavland_drafts;create table scavland_drafts.versions(domain text,entity_id text,version integer,payload jsonb)");
 for(const file of ['shared-item-drafts.sql','attachment-classification-storage.sql','attachment-preview.sql','attachment-creation-allocation.sql'])once(database,fs.readFileSync(path.join(__dirname,'../supabase/proposals',file),'utf8'));
 console.log('PostgreSQL '+once(database,'show server_version')+'; isolation '+once(database,'show transaction_isolation'));
 const service='set local role service_role';
 const prepare=(item,r,version=0,legacy=0)=>once(database,'begin;'+service+';'+prepared(item,r,version,legacy)+';commit');
 let r1=crypto.randomUUID(),r2=crypto.randomUUID();prepare('competing',r1);prepare('competing',r2);
 await race('Competing same-head saves',save('competing',r1),save('competing',r2),{conflict:true});
 assert.equal(once(database,"select count(*)||':'||max(version) from scavland_item_drafts.attachment_versions where item_id='competing'"),'1:1');
 r1=crypto.randomUUID();prepare('retry',r1);const retry=await race('Same receipt lost-response retry',save('retry',r1),save('retry',r1));assert.equal(JSON.parse(retry.first).request_id,JSON.parse(retry.second.value).request_id);
 assert.equal(once(database,"select count(*) from scavland_item_drafts.attachment_versions where item_id='retry'"),'1');
 r1=crypto.randomUUID();prepare('rollback',r1);await race('Rolled-back save permits one retry',save('rollback',r1),save('rollback',r1),{rollback:true});assert.equal(once(database,"select count(*) from scavland_item_drafts.attachment_versions where item_id='rollback'"),'1');
 for(const reverse of [false,true]){
  const item=reverse?'attachment-wins':'specialist-wins',ar=crypto.randomUUID(),sr=crypto.randomUUID();prepare(item,ar);
  const payload={itemId:item,category:'ammo',original:{ammo:{id:item}},legacyVersion:0};
  once(database,'begin;'+service+';select public.scavland_prepare_item('+[actor,item,'ammo',0,sr,{action:'edit'},payload].map(quote).join(',')+');commit');
  const specialist='select public.scavland_item_draft('+['save',item,'ammo',0,sr].map(quote).join(',')+')';
  await race(item,reverse?save(item,ar):specialist,reverse?specialist:save(item,ar),{conflict:true});
  assert.equal(once(database,'select (select count(*) from scavland_item_drafts.versions where item_id='+quote(item)+')+(select count(*) from scavland_item_drafts.attachment_versions where item_id='+quote(item)+')'),'1');
 }
 r1=crypto.randomUUID();prepare('legacy-race',r1);
 const legacy="select pg_advisory_xact_lock(hashtextextended('items:catalogue',0));insert into scavland_drafts.versions values('items','catalogue',1,'{}')";
 await race('Legacy catalogue change revokes old receipt',legacy,save('legacy-race',r1),{roleA:'set local role postgres',conflict:true});
 assert.equal(once(database,"select count(*) from scavland_item_drafts.attachment_versions where item_id='legacy-race'"),'0');
 r1=crypto.randomUUID();prepare('attachment-before-legacy',r1,0,1);
 const legacyAfter="select pg_advisory_xact_lock(hashtextextended('items:catalogue',0));insert into scavland_drafts.versions values('items','catalogue',2,'{}')";
 await race('Attachment then legacy save preserves lock order',save('attachment-before-legacy',r1),legacyAfter,{roleB:'set local role postgres'});
 assert.equal(once(database,"select count(*) from scavland_item_drafts.attachment_versions where item_id='attachment-before-legacy'"),'1');
 const request=crypto.randomUUID(),command={action:'create-attachment',confirmCreation:true,fields:{name:'Fixture'}};
 const allocation='select public.scavland_allocate_attachment('+[actor,request,command].map(quote).join(',')+')';
 const allocated=await race('Concurrent creation allocates one identity',allocation,allocation,{roleA:service,roleB:service});assert.equal(JSON.parse(allocated.first).item_id,JSON.parse(allocated.second.value).item_id);
 assert.equal(once(database,'select count(*) from scavland_item_drafts.attachment_allocations where request_id='+quote(request)),'1');
 const changedAllocation='select public.scavland_allocate_attachment('+[actor,request,{...command,fields:{name:'Changed'}}].map(quote).join(',')+')';
 await race('Concurrent changed allocation command refused',allocation,changedAllocation,{roleA:service,roleB:service,conflict:true});
 const otherAllocation='select public.scavland_allocate_attachment('+['22222222-2222-4222-8222-222222222222',request,command].map(quote).join(',')+')';
 await race('Concurrent other allocation actor refused',allocation,otherAllocation,{roleA:service,roleB:service,conflict:true});
 const rollbackRequest=crypto.randomUUID(),rollbackAllocation='select public.scavland_allocate_attachment('+[actor,rollbackRequest,command].map(quote).join(',')+')';
 await race('Creation rollback leaves one surviving allocation',rollbackAllocation,rollbackAllocation,{roleA:service,roleB:service,rollback:true});
 assert.equal(once(database,'select count(*) from scavland_item_drafts.attachment_allocations where request_id='+quote(rollbackRequest)),'1');
 const next=crypto.randomUUID();prepare('retry',next,1,2);
 const preview='select public.scavland_attachment_preview('+[actor,'retry',1,'a'.repeat(64)].map(quote).join(',')+')';
 await race('Preview waits and refuses superseded revision',save('retry',next),preview,{roleB:service,conflict:true});
 once(database,'begin;'+service+';select public.scavland_attachment_preview('+[actor,'retry',2,'a'.repeat(64)].map(quote).join(',')+');commit');
 console.log('PASS all isolated real PostgreSQL concurrency scenarios. Auth/Git remain fixtures; no production writes.');
 }finally{if(created)once('postgres','drop database '+database+' with (force)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
