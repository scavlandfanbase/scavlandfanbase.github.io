const assert=require('node:assert/strict');
(async()=>{
 const {createAttachmentApi}=await import('../supabase/functions/admin-drafts/attachment-api.mjs');
 const {legacyDigest}=await import('../supabase/functions/admin-drafts/legacy-item-review.mjs');
 const actor='11111111-1111-4111-8111-111111111111',item={id:'stable',name:'Known',classification:['item']},settings={schemaVersion:1,current_patch_id:'fixture'};
 let saved=null,prepared=null,preparations=0;
 const dependencies={enabled:()=>true,authenticate:async token=>token==='Bearer valid'?{actor,permissions:['items_edit']}:null,
 loadContext:async()=>({source:item,settings,version:saved?1:0,savedDraft:saved,legacyDrafts:[],legacyVersion:0}),
 storage:{receipt:async()=>prepared,prepare:async input=>{preparations++;prepared=input;return input;},save:async()=>{saved=prepared.payload;return {version:1,payload:saved};}}};
 const api=createAttachmentApi(dependencies),call=(body,token='valid')=>api(new Request('https://fixture/attachment',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
 assert.equal((await call({action:'load',itemId:'stable'},'bad')).status,401);
 assert.equal((await createAttachmentApi({...dependencies,enabled:()=>false})(new Request('https://fixture'))).status,503);
 const load=await (await call({action:'load',itemId:'stable'})).json();assert.equal(load.currentVersion,0);
 const command={action:'classify-attachment',confirmId:'stable',attachmentType:'Unknown',confirmReclassification:true,expectedVersion:0,sourceDigest:await legacyDigest({source:item,settings})};
 const requestId='22222222-2222-4222-8222-222222222222';
 assert.equal((await call({action:'prepare',itemId:'stable',requestId,command})).status,200);
 assert.equal((await call({action:'prepare',itemId:'stable',requestId,command})).status,200);assert.equal(preparations,1);
 assert.equal((await call({action:'save',itemId:'stable',requestId,command})).status,400);
 assert.equal((await call({action:'save',itemId:'stable',requestId})).status,200);
 assert.equal((await (await call({action:'load',itemId:'stable'})).json()).draft.record.contentType,'Attachment');
 assert.equal((await call({action:'load',itemId:'stable',actor:'forged'})).status,400);
 assert.equal((await call({action:'preview',itemId:'stable',expectedVersion:0})).status,400);
 assert.equal((await call({action:'publish',itemId:'stable',expectedVersion:1,previewId:requestId,confirm:true})).status,403);
 let published=0;
 const publishApi=createAttachmentApi({...dependencies,publishEnabled:()=>true,publication:async input=>{assert.equal(input.actor,actor);published++;return {commit:'fixture'};}});
 const publishCall=body=>publishApi(new Request('https://fixture',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)}));
 assert.equal((await publishCall({action:'publish',itemId:'stable',expectedVersion:1,previewId:requestId})).status,403);assert.equal(published,0);
 assert.equal((await publishCall({action:'publish',itemId:'stable',expectedVersion:1,previewId:requestId,confirm:true})).status,200);assert.equal(published,1);
 console.log('PASS Attachment request adapter: feature gate, authenticated permission, trusted preparation, receipt retry, receipt-only save and private reload. Storage transport mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
