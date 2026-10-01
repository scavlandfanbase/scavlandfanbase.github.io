const assert=require('node:assert/strict');
(async()=>{
 const {createPageGitRecovery}=await import('../supabase/functions/admin-drafts/page-git-recovery.mjs');
 const base='a'.repeat(40),original='b'.repeat(40),fence='c'.repeat(40),tree='d'.repeat(40);let head=base,persisted=false,claimed=false,patches=0,lose=false,race=false;
 const recover=createPageGitRecovery({env:()=> 'fixture-token',persistFence:async value=>{assert.equal(value.candidateCommit,original);persisted=true;},claimFence:async()=>{if(claimed)return false;claimed=true;return true;},fetcher:async(url,options)=>{
  if(url.endsWith('/git/ref/heads/main'))return Response.json({ref:'refs/heads/main',object:{type:'commit',sha:head}});
  if(url.includes('/compare/'))return Response.json({status:'diverged',merge_base_commit:{sha:base}});
  if(url.endsWith('/git/commits/'+base))return Response.json({sha:base,tree:{sha:tree}});
  if(url.endsWith('/git/commits')){const body=JSON.parse(options.body);assert.equal(body.tree,tree);assert.deepEqual(body.parents,[base]);return Response.json({sha:fence});}
  if(url.endsWith('/git/refs/heads/main')){assert(persisted);assert.equal(JSON.parse(options.body).force,false);patches++;head=race?original:fence;if(lose)throw Error('lost reply');return Response.json({});}
  throw Error('unexpected '+url);
 }});
 const input={candidate:{requestId:'12345678-1234-1234-1234-123456789012',commit:original,baseHead:base},createdAt:'2026-10-01T12:00:00.000Z'};
 lose=true;assert.equal((await recover(input)).state,'fenced');assert.equal(patches,1);assert.equal((await recover(input)).state,'fenced');assert.equal(patches,1);
 head=base;claimed=false;race=true;assert.equal((await recover(input)).state,'committed','original publication wins race: never unlock as refused');
 head='f'.repeat(40);assert.equal((await recover(input)).state,'unknown');assert.equal(patches,2,'changed main is never overwritten');
 head=base;race=false;assert.equal((await recover(input)).state,'fenced','recovery claim crash can retry identical fence');assert.equal(patches,3);
 console.log('PASS recovery fence adapter: identical tree, durable-before-ref, same-fence retry, lost reply, original-wins race, unknown remains protected. Isolated fixture; no live calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
