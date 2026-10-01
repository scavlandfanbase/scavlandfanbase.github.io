const assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const {createPageGitPublisher}=await import('../supabase/functions/admin-drafts/page-git.mjs');
 const {createTrustedPagePreview}=await import('../supabase/functions/admin-drafts/page-preview.mjs');
 const id=crypto.randomUUID(),saved={page_id:id,version:1,archived:false,payload:{id,title:'Field notes',slug:'field-notes',intro:'Public',sections:[]}};
 const snapshot={head:'a'.repeat(40),manifest:{schemaVersion:1,pages:[]},context:{approvedImages:[],existingPages:[{id,slug:'field-notes'}],currentPageId:id}};
 const preview=await createTrustedPagePreview({saved,snapshot}),input={requestId:crypto.randomUUID(),createdAt:'2026-10-01T12:00:00.000Z',preview,saved,snapshot};
 const candidate='c'.repeat(40),tree='b'.repeat(40);let head=snapshot.head,persisted=false,loss=false,deny=false,readFail=false,ancestor=false,patches=0,bodies=[];
 const claims=new Set();const publisher=createPageGitPublisher({env:()=> 'fixture-token',claimAttempt:async value=>{if(claims.has(value.requestId))return false;claims.add(value.requestId);return true;},persistCandidate:async value=>{assert.equal(value.commit,candidate);persisted=true;},fetcher:async(url,options)=>{
  assert.equal(options.redirect,'error');const body=options.body&&JSON.parse(options.body);if(body)bodies.push(body);
  if(url.endsWith('/git/commits/'+snapshot.head))return Response.json({sha:snapshot.head,tree:{sha:tree}});
  if(url.endsWith('/git/trees')){assert.equal(body.base_tree,tree);assert.deepEqual(body.tree.map(x=>x.path),['pages/field-notes/index.html','data/page-builder-pages.json']);assert.equal(body.tree[0].content,preview.html);return Response.json({sha:tree});}
  if(url.endsWith('/git/commits')){assert.deepEqual(body.parents,[snapshot.head]);assert.equal(body.author.date,input.createdAt);assert.equal(body.committer.date,input.createdAt);return Response.json({sha:candidate});}
  if(url.endsWith('/git/ref/heads/main')){if(readFail&&patches)throw Error('lost read');return Response.json({ref:'refs/heads/main',object:{type:'commit',sha:head}});}
  if(url.includes('/compare/'))return Response.json({status:ancestor?'ahead':'diverged',merge_base_commit:{sha:ancestor?candidate:snapshot.head}});
  if(url.endsWith('/git/refs/heads/main')){assert(persisted);assert.equal(body.force,false);assert.equal(body.sha,candidate);patches++;if(deny)return Response.json({}, {status:422});head=candidate;if(loss)throw Error('response lost');return Response.json({});}
  throw Error('unexpected URL');
 }});
 assert.equal((await publisher(input)).state,'committed');assert.equal(patches,1);
 assert.equal((await publisher(input)).state,'committed');assert.equal(patches,1,'retry must not repeat a landed ref update');
 head=snapshot.head;input.requestId=crypto.randomUUID();loss=true;assert.equal((await publisher(input)).state,'committed','recover lost ref response');
 head=snapshot.head;input.requestId=crypto.randomUUID();deny=true;assert.equal((await publisher(input)).state,'unknown','ref rejection cannot release editing');deny=false;
 const deniedCount=patches;assert.equal((await publisher(input)).state,'unknown');assert.equal(patches,deniedCount,'uncertain replay must never dispatch again');
 head='d'.repeat(40);input.requestId=crypto.randomUUID();const count=patches;const refused=await publisher(input);assert.equal(refused.state,'refused');assert.equal(refused.noWrite,true);assert.equal(patches,count,'changed baseline must not write');
 ancestor=true;assert.equal((await publisher(input)).state,'committed','later unrelated commits retain landed evidence');ancestor=false;
 head=snapshot.head;readFail=true;assert.equal((await publisher(input)).state,'unknown');readFail=false;
 await assert.rejects(publisher({...input,preview:{...preview,digest:'0'.repeat(64)}}),error=>error.status===409);
 await assert.rejects(createPageGitPublisher({env:()=> 'fixture-token',claimAttempt:async()=>true,persistCandidate:async()=>{throw Error('database unavailable');},fetcher:async(url)=>{
  if(url.endsWith('/git/commits/'+snapshot.head))return Response.json({sha:snapshot.head,tree:{sha:tree}});
  if(url.endsWith('/git/trees'))return Response.json({sha:tree});if(url.endsWith('/git/commits'))return Response.json({sha:candidate});throw Error('ref must never be touched');
 }})(input),/database unavailable/);
 console.log('PASS page Git publisher: narrow output, preserved base tree, durable-before-ref order, no force, landed retry, lost response and uncertain refusal. Fixture only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
