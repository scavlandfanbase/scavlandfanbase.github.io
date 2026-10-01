const assert=require('node:assert/strict');
(async()=>{
 const {createAttachmentSource}=await import('../supabase/functions/admin-drafts/attachment-source.mjs');
 const {createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');
 const paths=[];const fetcher=async url=>{paths.push(url);if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:'pinned-head'}});assert.equal(new URL(url).searchParams.get('ref'),'pinned-head');return Response.json({sha:'blob',encoding:'base64',content:Buffer.from(JSON.stringify(url.includes('site-images')?{categories:{test:{images:['images/a.png']}}}:url.includes('verification-settings')?{current_patch_id:'fixture'}:{data:[]})).toString('base64')});};
 const read=createAttachmentSource({env:()=> 'fixture-token',fetcher}),result=await read();
 assert.equal(paths.length,8);assert.equal(result.head,'pinned-head');assert.deepEqual(result.images,['images/a.png']);
 let calls=0;const handler=createProductionHandler({env:()=>undefined,fetcher:async()=>{calls++;throw Error('No network expected');},core:{publishers:{}}});
 const response=await handler(new Request('https://fixture',{method:'POST',body:JSON.stringify({domain:'shared-attachment',action:'list'})}));
 assert.equal(response.status,503);assert.equal(calls,0);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://scavlandfanbase.github.io');
 console.log('PASS Attachment production preparation: pinned source documents, disabled default with no network and expected CORS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
