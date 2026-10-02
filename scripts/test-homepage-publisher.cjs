const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
(async()=>{
 const original=JSON.parse(fs.readFileSync('data/site-content.json','utf8'));let handler,writes=[],publicationAllowed=true;
 const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/publish-site-content/index.ts','utf8'));
 vm.runInNewContext(source,{Request,Response,TextEncoder,TextDecoder,Uint8Array,atob,btoa,Set,JSON,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},fetch:async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:'fixture-owner'});
  if(url.endsWith('/has_scavland_permission'))return Response.json(JSON.parse(options.body).required_permission==='content_edit'||publicationAllowed);
  if(url.includes('api.github.com')&&options.method==='PUT'){writes.push(JSON.parse(options.body));return Response.json({commit:{sha:'fixture-commit'}});}
  if(url.includes('api.github.com'))return Response.json({sha:'fixture-file',content:Buffer.from(JSON.stringify(original)).toString('base64')});
  throw Error('Unexpected request');
 }});
 const content=structuredClone(original.pages['index.html']);content.sections.find(s=>s.id==='feature-grid').cards.push({id:'guides',title:'Guides',description:'Scavland Guides',href:'https://scavlandfanbase.github.io/pages/guides/',image:null});
 const call=page=>handler(new Request('https://fixture',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({page:'index.html',content:page})}));
 assert.equal((await call(content)).status,200);assert.equal(writes.length,1);
 const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString());assert.deepEqual(saved.pages['index.html'],content);assert.deepEqual(saved.global,original.global);
 for(const bad of [123,'../unsafe.png','https://evil.invalid/image.png']){const invalid=structuredClone(content);invalid.sections[0].image=bad;assert.equal((await call(invalid)).status,400);}
 const invalidText=structuredClone(content);invalidText.sections[0].intro={unsafe:true};assert.equal((await call(invalidText)).status,400);assert.equal(writes.length,1);
 publicationAllowed=false;assert.equal((await call(content)).status,403);assert.equal(writes.length,1);
 console.log('PASS real homepage publisher accepts omitted optional fields/new Guides card, preserves content, rejects invalid fields and blocks Reviewer writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
