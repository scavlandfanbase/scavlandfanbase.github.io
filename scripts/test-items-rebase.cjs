const assert=require('node:assert/strict');

function source(data){return {schemaVersion:1,data};}
function record(id,name,extra={}){return {id,name,category:'Tools',description:'base description',properties:{weight:1},...extra};}

(async()=>{
 const {rebasePayload}=await import('../supabase/functions/admin-drafts/core.mjs');
 const oldSource=source([record('metal','Metal Breastplate',{image:null,evidence:null}),record('old','Old item')]);
 const latestSource=source([record('metal','Metal Breastplate',{description:'public description',image:null,evidence:null}),record('old','Old item'),record('new','New public item')]);
 const oldCatalogue={foundationVersion:1,revision:4,data:[
  {id:'metal',name:'Metal Breastplate',category:'Tools',description:'base description',properties:{weight:1},image:'images/metal-breastplate.png',evidence:{file:'evidence-inbox/metal.png'},verification:null,hidden:false,archived:false,createdAt:null,updatedAt:null},
  {id:'old',name:'Old item',category:'Tools',description:'base description',properties:{weight:1},image:null,evidence:null,verification:null,hidden:false,archived:false,createdAt:null,updatedAt:null}
 ]};
 const draft={payload:{catalogue:oldCatalogue,source:oldSource,selectedId:'metal',settings:{schemaVersion:1,current_patch_id:'0.7.2'}},base:{'data/items.json':'old-sha'}};
 const merged=rebasePayload('items',draft,{source:latestSource,base:{'data/items.json':'new-sha'},settings:{schemaVersion:1,current_patch_id:'0.7.2'}});
 assert.deepEqual(merged.conflicts,[]);
 const metal=merged.payload.catalogue.data.find(r=>r.id==='metal');
 assert.equal(metal.description,'public description');
 assert.equal(metal.image,'images/metal-breastplate.png');
 assert.deepEqual(metal.evidence,{file:'evidence-inbox/metal.png'});
 assert(merged.payload.catalogue.data.some(r=>r.id==='new'));
 assert.equal(merged.payload.selectedId,'metal');
 assert.equal(merged.base['data/items.json'],'new-sha');

 const conflictDraft=structuredClone(draft);conflictDraft.payload.catalogue.data[0].description='private description';
 const conflict=rebasePayload('items',conflictDraft,{source:latestSource,base:{'data/items.json':'new-sha'},settings:{schemaVersion:1,current_patch_id:'0.7.2'}});
 assert.equal(conflict.conflicts.length,1);assert.equal(conflict.conflicts[0].path,'data["metal"].description');
 const removed=structuredClone(draft);removed.payload.source.data[0].notes='Old note';removed.payload.catalogue.data[0].notes='Old note';
 const removal=rebasePayload('items',removed,{source:latestSource,base:{'data/items.json':'new-sha'},settings:merged.payload.settings});
 assert(!Object.hasOwn(removal.payload.catalogue.data[0],'notes'),'Removed optional field remains absent rather than undefined');
 assert.doesNotThrow(()=>JSON.stringify(removal.payload));
 const conflictingDelete=rebasePayload('items',draft,{source:source([record('old','Old item')]),base:{},settings:merged.payload.settings});
 assert(conflictingDelete.conflicts.length,'Public deletion cannot discard private image/evidence edits');

 const {createProductionHandler}=await import('../supabase/functions/admin-drafts/production.mjs');
 const env=k=>({SUPABASE_URL:'https://supabase.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}[k]);
 const core={context:(_domain,saved)=>({payload:saved.payload,base:saved.base}),read:async()=>({source:latestSource,base:{'data/items.json':'new-sha'},settings:{schemaVersion:1,current_patch_id:'0.7.2'}}),publishers:{}};
 const fetcher=async(url,opt)=>{
  if(url.endsWith('/user'))return Response.json({id:'actor'});
  if(url.endsWith('/scavland_draft'))return Response.json({currentVersion:4,draft});
  assert(url.endsWith('/scavland_prepare'));const args=JSON.parse(opt.body);
  return Response.json(args.p_payload?{request_id:args.p_request,payload:args.p_payload,base:args.p_base}:null);
 };
 const handler=createProductionHandler({env,core,fetcher});
 const response=await handler(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer signed-in'},body:JSON.stringify({action:'prepare',command:{action:'refresh-public'},requestId:crypto.randomUUID(),domain:'items',entityId:'catalogue',expectedVersion:4})}));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.payload.catalogue.data.find(r=>r.id==='metal').description,'public description');
 const Client=require('../draft-persistence.js');let saves=0,rebases=0;
 const client=Client.create({endpoint:'https://edge.test',apiKey:'public',getToken:()=> 'signed-in',domain:'items',entityId:'catalogue',fetcher:async(url,opt)=>{
  const request=JSON.parse(opt.body);if(request.action==='load')return Response.json({currentVersion:4,draft:null});
  if(request.action==='prepare'){rebases++;return Response.json({request_id:request.requestId,payload:{catalogue:{foundationVersion:1,revision:4,data:[]},source:latestSource,settings:{schemaVersion:1,current_patch_id:'0.7.2'}},base:{'data/items.json':'new-sha'}});}
  if(request.action==='save'){saves++;assert.equal(request.expectedVersion,4);return Response.json({currentVersion:5,draft:{version:5,request_id:request.requestId,saved_at:'2026-09-29T00:00:00.000Z',payload:request.payload,base:request.base}});}
  throw new Error('unexpected action '+request.action);
 }});
 await client.load();const saved=await client.rebase();assert.equal(rebases,1);assert.equal(saves,1);assert.equal(saved.version,5);assert.equal(client.getVersion(),5);assert.equal(client.getPending(),null);
 console.log('PASS Items stale-draft rebase: private image/evidence preserved, public-only changes adopted, new records retained, selected item preserved, same-field conflicts reported, authenticated Edge Function rebase is read/merge only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
