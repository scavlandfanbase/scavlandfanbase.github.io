const assert=require('node:assert/strict');
(async()=>{
 const {validatePageRequest:validate}=await import('../supabase/functions/admin-drafts/page-request.mjs');
 const pageId='11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222';
 const cases=[{domain:'page-builder',action:'list'},
  {domain:'page-builder',action:'load',pageId},
  {domain:'page-builder',action:'create',requestId,page:{title:'Unknown',sections:[]}},
  {domain:'page-builder',action:'save',pageId,expectedVersion:1,requestId,page:{id:pageId,title:'Unknown',sections:[]}},
  {domain:'page-builder',action:'archive',pageId,expectedVersion:1,requestId}];
 const rejects=value=>assert.throws(()=>validate(value),error=>error.status===400&&error.message==='Invalid private page request.');
 for(const original of cases){
  const result=validate(original);assert.deepEqual(result,original);assert.notEqual(result,original);
  for(const key of Object.keys(original)){const value={...original};delete value[key];rejects(value);}
  for(const field of ['actor','savedAt','permissions','approved','base','source','digest','extra'])rejects({...original,[field]:'forged'});
 }
 for(const action of ['publish','approve','delete','preview','source','prepare'])rejects({domain:'page-builder',action});
 for(const input of [null,[],true,'page',{}, {domain:'items',action:'list'}])rejects(input);
 for(const value of [0,-1,1.5,'1',null,Number.MAX_SAFE_INTEGER+1])rejects({...cases[3],expectedVersion:value});
 for(const value of ['../page','',null,[],pageId+' ']){
  rejects({...cases[1],pageId:value});rejects({...cases[2],requestId:value});
 }
 rejects({...cases[2],page:{id:pageId,title:'local ID'}});
 rejects({...cases[3],page:{id:requestId}});
 rejects({...cases[3],page:[]});rejects({...cases[2],page:null});
 const cloned=validate(cases[3]);cloned.page.sections.push({title:'Changed'});
 assert.deepEqual(cases[3].page.sections,[]);assert.equal(cloned.page.title,'Unknown');
 console.log('PASS private page request boundary: strict actions/envelopes, protected authority, server-owned creation identity, version checks, and buffer preservation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
