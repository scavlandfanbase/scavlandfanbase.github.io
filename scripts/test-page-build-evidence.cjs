const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {createPageBuildEvidence}=await import(pathToFileURL(path.resolve('supabase/functions/admin-drafts/page-build-evidence.mjs')));
 const html='<h1>Approved page</h1>',commit='a'.repeat(40),buildId='123',route='pages/field-notes/index.html';
 const digest=require('node:crypto').createHash('sha256').update(html).digest('hex');
 const command={commit,buildId,path:route,digest};let status='built',body=html,wrong=false,calls=[];
 const read=createPageBuildEvidence({env:()=> 'fixture-only-secret',fetcher:async(url,options)=>{
  calls.push({url,options});assert.equal(options.redirect,'error');
  if(url.startsWith('https://api.github.com/'))return Response.json({commit:wrong?'b'.repeat(40):commit,url:'https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io/pages/builds/123',status});
  assert.equal(url,'https://scavlandfanbase.github.io/'+route);assert.equal(options.headers.Authorization,undefined);return new Response(body);
 }});
 assert.equal((await read(command)).status,'success');
 body='old public bytes';assert.equal((await read(command)).status,'pending');
 for(const value of ['queued','building','errored']){status=value;calls=[];assert.equal((await read(command)).status,value==='errored'?'failure':'pending');assert.equal(calls.length,1);}
 wrong=true;await assert.rejects(read(command),error=>error.status===409);wrong=false;status='unknown';await assert.rejects(read(command),error=>error.status===503);
 for(const patch of [{path:'../admin.html'},{path:'pages/admin/index.html?x=1'},{buildId:'123/other'},{commit:'not-sha'},{digest:'bad'}])await assert.rejects(read({...command,...patch}),error=>error.status===400);
 await assert.rejects(createPageBuildEvidence({env:()=>null})(command),error=>error.status===503);
 status='built';body='x'.repeat(2000001);await assert.rejects(read(command),error=>error.status===503);
 console.log('PASS Pages evidence: matching build/commit, exact live bytes, pending/failure refusal, bounded output and credential isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
