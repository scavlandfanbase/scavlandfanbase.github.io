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
const other='22222222-2222-4222-8222-222222222222';
const auth=who=>"set local role authenticated;select set_config('request.jwt.claim.sub',"+quote(who)+",true)";
const decide=(id,r,version=0,status='pending',decision='approved')=>'select public.scavland_review_evidence('+[id,r,version,status,decision,'Fixture review'].map(quote).join(',')+')';
const seed=()=>{const id=crypto.randomUUID();once(database,"insert into public.evidence_submissions(id,item_name,notes,screenshot_path) values("+quote(id)+",'Fixture','Original notes','original.png')");return id;};
(async()=>{let created=false;try{
 once('postgres','create database '+database);created=true;
 once(database,"create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.has_scavland_permission(p text) returns boolean language sql stable as $$select auth.uid() in ('"+actor+"'::uuid,'"+other+"'::uuid) and p='evidence_review'$$;grant usage on schema auth to authenticated;create table public.evidence_submissions(id uuid primary key,created_at timestamptz default now(),submission_type text,category text,item_name text,notes text,screenshot_path text,status text default 'pending',reviewed_at timestamptz,review_notes text)");
 once(database,fs.readFileSync(path.join(__dirname,'../supabase/proposals/evidence-review-history.sql'),'utf8'));
 console.log('PostgreSQL '+once(database,'show server_version')+'; isolation '+once(database,'show transaction_isolation'));
 let id=seed();await race('Two reviewers competing at the same revision',decide(id,crypto.randomUUID()),decide(id,crypto.randomUUID(),0,'pending','rejected'),{roleA:auth(actor),roleB:auth(other),conflict:true});
 assert.equal(once(database,'select count(*)||\':\'||max(version)||\':\'||min(actor::text) from scavland_evidence_review.reviews where submission_id='+quote(id)),'1:1:'+actor);
 id=seed();let request=crypto.randomUUID();const receipt=await race('Exact concurrent retry records one decision',decide(id,request),decide(id,request),{roleA:auth(actor),roleB:auth(actor)});assert.deepEqual(JSON.parse(receipt.first),JSON.parse(receipt.second.value));
 assert.equal(once(database,'select count(*) from scavland_evidence_review.reviews where submission_id='+quote(id)),'1');
 id=seed();request=crypto.randomUUID();await race('Receipt cannot be reused by another reviewer',decide(id,request),decide(id,request),{roleA:auth(actor),roleB:auth(other),conflict:true});
 id=seed();request=crypto.randomUUID();await race('Rollback allows the waiting review to succeed',decide(id,request),decide(id,crypto.randomUUID(),0,'pending','rejected'),{roleA:auth(actor),roleB:auth(other),rollback:true});
 assert.equal(once(database,'select count(*)||\':\'||min(actor::text) from scavland_evidence_review.reviews where submission_id='+quote(id)),'1:'+other);
 id=seed();const state=await race('State waits for a consistent committed decision and history',decide(id,crypto.randomUUID()),'select public.scavland_evidence_state('+quote(id)+')',{roleA:auth(actor),roleB:auth(other)});const loaded=JSON.parse(state.second.value);assert.equal(loaded.version,1);assert.equal(loaded.submission.status,'approved');assert.equal(loaded.history.length,1);assert.equal(loaded.submission.notes,'Original notes');assert.equal(loaded.submission.screenshot_path,'original.png');
 await race('Restore competes safely with another review',decide(id,crypto.randomUUID(),1,'approved','pending'),decide(id,crypto.randomUUID(),1,'approved','pending'),{roleA:auth(actor),roleB:auth(other),conflict:true});
 assert.equal(once(database,'select count(*)||\':\'||max(version) from scavland_evidence_review.reviews where submission_id='+quote(id)),'2:2');
 console.log('PASS six isolated Evidence concurrency scenarios; no production calls.');
 }finally{if(created)once('postgres','drop database '+database+' with (force)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
