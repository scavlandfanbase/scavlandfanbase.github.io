const assert=require('node:assert/strict');
(async()=>{
 const {createPageContextSource}=await import('../supabase/functions/admin-drafts/page-source.mjs');
 const head='a'.repeat(40),calls=[],pageId='11111111-1111-4111-8111-111111111111';
 let truncated=false,custom=false,missing=false;
 const reader=createPageContextSource({env:key=>key==='GITHUB_TOKEN'?'fixture-token':undefined,fetcher:async(url,options)=>{
  calls.push(url);assert.equal(options.headers.Authorization,'Bearer fixture-token');
  if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:head}});
  if(url.includes('/git/trees/')){assert.ok(url.includes(head));return Response.json({truncated,tree:[
   {path:'images/approved.png',type:'blob',mode:'100644'},
   {path:'images/symlink.png',type:'blob',mode:'120000'},
   ...(custom?[{path:'pages/existing.html',type:'blob',mode:'100644'}]:[])]});}
  assert.ok(url.endsWith('?ref='+head));
  if(missing)return Response.json({error:'missing'},{status:404});
  return Response.json({encoding:'base64',content:Buffer.from(JSON.stringify({categories:{fixtures:{images:['images/approved.png','images/approved.png','images/missing.png','images/symlink.png','images/../private.png','https://external/image.png']}}})).toString('base64')});
 }});
 const rpcCalls=[];
 const rpc=async(name,args)=>{assert.equal(name,'scavland_page');rpcCalls.push(args);return args.p_after===null?Array.from({length:100},(_,i)=>({pageId:i===0?pageId:'page-'+i,slug:'fixture-'+i})):[{pageId:'page-last',slug:'last'}];};
 const context=await reader({pageId,rpc});assert.deepEqual(context.approvedImages,['images/approved.png']);assert.equal(context.existingPages.length,101);assert.equal(context.currentPageId,pageId);assert.equal(rpcCalls[1].p_after,'page-99');
 assert.ok(!JSON.stringify(context).includes('fixture-token'));
 truncated=true;await assert.rejects(reader({pageId,rpc}),error=>error.status===503);truncated=false;
 custom=true;await assert.rejects(reader({pageId,rpc}),error=>error.status===503);custom=false;
 missing=true;await assert.rejects(reader({pageId,rpc}),error=>error.status===503);missing=false;
 const noToken=createPageContextSource({env:()=>undefined,fetcher:()=>{throw Error('No network expected');}});await assert.rejects(noToken({pageId,rpc}),error=>error.status===503);
 await assert.rejects(reader({pageId,rpc:async()=>Array.from({length:100},(_,i)=>({pageId:'same-'+i,slug:'fixture-'+i}))}),error=>error.status===503,'nonadvancing cursor is refused');
 console.log('PASS trusted page source: pinned commit, approved real image blobs, traversal/symlink refusal, paginated private identities, truncated/missing source and unknown public-page refusal. Fixture only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
