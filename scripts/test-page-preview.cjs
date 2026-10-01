const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {createTrustedPagePreview:create,verifyTrustedPagePreview:verify,pageDigest}=await import('../supabase/functions/admin-drafts/page-preview.mjs');
 const id=crypto.randomUUID(),page={id,title:'Unknown <script>bad()</script>',slug:'preview-fixture',intro:'A & B',sections:[
  {id:'visible',title:'Public',hidden:false,layout:{},blocks:[
   {id:'text',type:'text',hidden:false,text:'<img src=x onerror=bad()> Unknown'},
   {id:'hidden-block',type:'text',hidden:true,text:'SECRET HIDDEN BLOCK'},
   {id:'image',type:'image',hidden:false,image:'images/approved.png',alt:'Approved'}]},
  {id:'private-section',title:'Private',hidden:true,layout:{},blocks:[{id:'private-text',type:'text',hidden:false,text:'SECRET HIDDEN SECTION'}]}]};
 const saved={page_id:id,version:1,archived:false,payload:page,saved_by:'PRIVATE ACTOR',saved_at:'PRIVATE TIME'};
 const snapshot={head:'a'.repeat(40),manifest:{schemaVersion:1,pages:[]},context:{approvedImages:['images/approved.png'],existingPages:[{id,slug:page.slug}],currentPageId:id}};
 const preview=await create({saved,snapshot});assert.equal(preview.version,1);assert.equal(preview.path,'pages/preview-fixture/index.html');assert.equal(preview.digest,await pageDigest(preview.html));
 assert.ok(preview.html.includes('&lt;script&gt;bad()&lt;/script&gt;'));assert.ok(preview.html.includes('&lt;img src=x onerror=bad()&gt;'));
 for(const secret of ['SECRET HIDDEN BLOCK','SECRET HIDDEN SECTION','PRIVATE ACTOR','PRIVATE TIME'])assert.ok(!preview.html.includes(secret));
 assert.ok(preview.html.includes('<style>'));assert.ok(preview.html.includes('class="published-page"'));assert.ok(preview.html.includes('src="/images/approved.png"'));
 assert.deepEqual(preview.manifest.pages,[{id,slug:page.slug,version:1,digest:preview.digest}]);
 assert.deepEqual(await create({saved,snapshot}),preview,'deterministic preview bytes');
 assert.deepEqual(await verify({...preview,html:'FORGED HTML',manifest:{actor:'private'}},{saved,snapshot}),preview,'verification regenerates all output rather than trusting submitted bytes');
 for(const field of ['version','pageId','baseHead','digest','styleDigest','path'])await assert.rejects(verify({...preview,[field]:'changed'},{saved,snapshot}),error=>error.status===409);
 await assert.rejects(verify(preview,{saved:{...saved,version:2},snapshot}),error=>error.status===409);
 await assert.rejects(verify(preview,{saved:{...saved,payload:{...page,title:'Changed'}},snapshot}),error=>error.status===409);
 await assert.rejects(verify(preview,{saved,snapshot:{...snapshot,head:'b'.repeat(40)}}),error=>error.status===409);
 await assert.rejects(create({saved:{...saved,archived:true},snapshot}),error=>error.status===409);
 await assert.rejects(create({saved,snapshot:{...snapshot,context:{...snapshot.context,approvedImages:[]}}}),/approved image/);
 const unsafe=structuredClone(saved);unsafe.payload.sections[0].blocks.push({id:'unsafe',type:'button',hidden:false,title:'Bad',href:'javascript:bad()'});
 await assert.rejects(create({saved:unsafe,snapshot}),/HTTPS link/);
 const renderer=fs.readFileSync(path.join(__dirname,'../supabase/functions/admin-drafts/page-renderer.mjs'),'utf8').replace(/\r\n/g,'\n');
 const expected=/Original normalized SHA-256: ([a-f0-9]{64})/.exec(renderer)[1],inner=renderer.split('const renderer=(()=>{\n')[1].split('})();\nexport default renderer;')[0];
 const wrapper="(function(root,factory){const api=factory(typeof module==='object'?require('./page-builder-model.js'):root.ScavPageBuilderModel);if(typeof module==='object')module.exports=api;else root.ScavPageBuilder=api;})(globalThis,Model=>{\n"+inner+'});';
 assert.ok([wrapper,wrapper+'\n'].some(text=>crypto.createHash('sha256').update(text).digest('hex')===expected),'renderer body must match reviewed source');
 console.log('PASS trusted page preview: saved revision/output/style/head binding, escaped output, hidden/private exclusion, approved images, regenerated output and reviewed renderer parity. No publication calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
