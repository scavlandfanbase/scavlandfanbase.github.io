const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{
 let listener,requests=[],lose=true,fetches=0;const parent={postMessage(){}};
 const context={window:{addEventListener:(name,callback)=>listener=callback},parent,location:{search:'?live=1',origin:'https://fixture'},URLSearchParams,crypto,Promise,Error,JSON,
 fetch:async(url,options)=>{fetches++;const body=JSON.parse(options.body);requests.push(body);assert.equal(url,'https://demtoqsafufzmnhvaykj.supabase.co/functions/v1/admin-drafts');assert.equal(options.headers.Authorization,'Bearer memory-only');
  if(lose){lose=false;throw Error('reply lost');}return {ok:true,json:async()=>({draft:{payload:{id:'server-id',title:'Saved'},version:1,archived:false}})};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('page-builder-live.js','utf8'),context);const api=context.window.ScavPageBackend;
 listener({source:{},origin:'https://fixture',data:{type:'scavland-admin-token',token:'spoof'}});assert.equal(fetches,0);
 listener({source:parent,origin:'https://other',data:{type:'scavland-admin-token',token:'spoof'}});assert.equal(fetches,0);
 listener({source:parent,origin:'https://fixture',data:{type:'scavland-admin-token',token:'memory-only'}});
 const body=JSON.stringify({action:'create',page:{id:'local-only-id',title:'Saved',slug:'saved',intro:'',sections:[]}});
 await assert.rejects(api.api('/api/pages',{body}),/reply lost/);const record=await api.api('/api/pages',{body});assert.equal(record.record.draft.id,'server-id');
 assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(requests[0].page.id,undefined);
 await api.api('/api/pages',{body:JSON.stringify({action:'delete',id:crypto.randomUUID(),revision:1})});assert.equal(requests.at(-1).action,'archive');
 listener({source:parent,origin:'https://fixture',data:{type:'scavland-admin-token',token:''}});await assert.rejects(api.call({action:'list'}),/Sign in again/);
 console.log('PASS live draft bridge: trusted parent session, memory-only token, permanent server identity, lost-response same-ID retry, archive mapping and sign-out refusal.');
})().catch(error=>{console.error(error);process.exitCode=1;});
