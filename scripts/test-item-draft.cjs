const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),load=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const documents=Object.fromEntries(['items','ammo','armour','weapons'].map(n=>['data/'+n+'.json',load(n)]));
const originals=structuredClone(documents),settings={schemaVersion:1,current_patch_id:'fixture-patch'},actor='fixture-owner';
const context={actor,permissions:['ammunition_edit'],settings,clock:()=>new Date('2026-09-30T10:00:00Z')};
(async()=>{
 const {snapshotItem,categoryView,editItem,reviewItem,createAmmoItem,addAmmoFacet,reconcilePublishedItem,planItem,createItemPublisher,legacyItemBlockers}=await import('../supabase/functions/admin-drafts/item-draft.mjs');
 const {seed}=await import('../supabase/functions/admin-drafts/core.mjs');
 const id=documents['data/ammo.json'].data[0].id;
 const state=snapshotItem(documents,id,'ammo',context);
 const review={action:'review',expectedRevision:0,confirmId:id,patchId:'fixture-patch',decision:'verified'};
 assert.throws(()=>reviewItem(state,{...review,patchId:'old-patch'},context),e=>e.status===409);
 assert.throws(()=>reviewItem(state,{...review,confirmId:'another-item'},context),/Confirm/);
 assert.throws(()=>reviewItem(state,{...review,actor:'forged'},context),/Unsupported/);
 assert.throws(()=>reviewItem(state,review,{...context,permissions:[]}),e=>e.status===403);
 const reviewed=reviewItem(state,review,context);
 assert.deepEqual(reviewed.records.items,state.records.items,'category review must not attest unrelated shared/facet records');
 assert.equal(reviewed.records.ammo.verification.history.at(-1).by,actor);
 const unreviewed=reviewItem(reviewed,{...review,expectedRevision:1,decision:'unverified'},context);
 assert.equal(unreviewed.records.ammo.verification.history.length,2);
 assert.equal(unreviewed.records.ammo.verification.last_verified_by,actor);
 const reviewPlan=planItem(reviewed,documents);
 assert.equal(reviewPlan['data/ammo.json'].data.find(r=>r.id===id).verification.decision,'verified');
 assert(!JSON.stringify(reviewPlan).includes(actor));
 const reviewEdited=editItem(reviewed,{action:'edit',expectedRevision:1,specialist:{damage:'Changed after review'}},context);
 assert.equal(reviewEdited.records.ammo.verification.decision,'unverified');
 assert.equal(reviewEdited.records.ammo.verification.history.length,2);
 assert.throws(()=>snapshotItem(documents,id,'armour',context),e=>e.status===403);
 assert.throws(()=>snapshotItem(documents,id,'armour',{permissions:['armour_edit']}),e=>e.status===403);
 assert.throws(()=>editItem(state,{action:'edit',expectedRevision:1,shared:{name:'Wrong'}},context),e=>e.status===409);
 assert.throws(()=>editItem(state,{action:'edit',expectedRevision:0,shared:{verification:{decision:'verified'}}},context),/Unsupported/);
 assert.throws(()=>editItem(state,{action:'edit',expectedRevision:0,specialist:{ballistic:99}},context),/Unsupported/);
 assert.throws(()=>editItem(state,{action:'edit',expectedRevision:0,shared:{image:'https://untrusted.test/a.png'}},context),/library/);
 const edited=editItem(state,{action:'edit',expectedRevision:0,shared:{name:'One shared rename',description:'One description'},specialist:{damage:'6 x 5 = 30',penetrationPercent:-25}},context);
 assert.equal(edited.records.items.name,'One shared rename');assert.equal(edited.records.ammo.name,'One shared rename');
 assert.equal(state.records.items.name,originals['data/items.json'].data.find(r=>r.id===id).name);
 const fresh=structuredClone(documents);fresh['data/items.json'].data.find(r=>r.id!==id).name='Another published item';
 const planned=planItem(edited,fresh);
 assert.equal(planned['data/items.json'].data.find(r=>r.id!==id).name,'Another published item');
 assert.equal(planned['data/ammo.json'].data.find(r=>r.id===id).damage,'6 x 5 = 30');
 assert.equal(planned['data/ammo.json'].data.find(r=>r.id===id).penetrationPercent,-25);
 assert.deepEqual(documents,originals);assert(!Object.hasOwn(planned,'data/vendors.json'));
 const simultaneous=structuredClone(documents);simultaneous['data/items.json'].data.find(r=>r.id===id).notes='Other administrator note';
 assert.equal(planItem(edited,simultaneous)['data/items.json'].data.find(r=>r.id===id).notes,'Other administrator note');
 const conflicting=structuredClone(documents);conflicting['data/items.json'].data.find(r=>r.id===id).name='Different rename';
 assert.throws(()=>planItem(edited,conflicting),e=>e.status===409&&e.conflicts.some(c=>c.field==='name'));
 const source=originals['data/items.json'],catalogue=seed('items',source);
 catalogue.data.find(r=>r.id===id).name='Saved old-draft edit';
 const legacy={domain:'items',entity_id:'catalogue',version:20,payload:{source,catalogue}};
 assert.equal(legacyItemBlockers(id,state.original.items,[legacy]).length,1);
 assert.throws(()=>planItem(edited,documents,{legacyDrafts:[legacy]}),e=>e.status===409);
 const unrelatedId=catalogue.data.find(r=>r.id!==id).id;
 assert.equal(legacyItemBlockers(unrelatedId,source.data.find(r=>r.id===unrelatedId),[legacy]).length,0);
 assert.equal(catalogue.data.find(r=>r.id===id).name,'Saved old-draft edit');
 // Trusted edit invalidation retains previous private review history and source evidence.
 const verified=structuredClone(state),verification={schemaVersion:1,decision:'verified',verified_patch_id:'fixture-patch',last_verified_at:'2026-09-29T10:00:00Z',last_verified_by:'previous-owner',history:[{decision:'verified',patch_id:'fixture-patch',at:'2026-09-29T10:00:00Z',by:'previous-owner'}]};
 verified.records.items.verification=structuredClone(verification);verified.original.items.verification=structuredClone(verification);
 const invalidated=editItem(verified,{action:'edit',expectedRevision:0,shared:{name:'Reviewed rename'}},context);
 assert.equal(invalidated.records.items.verification.decision,'unverified');
 assert.deepEqual(invalidated.records.items.verification.history.slice(0,-1),verification.history);
 assert.equal(invalidated.records.items.verification.history.at(-1).by,actor);
 const privateCurrent=structuredClone(documents);privateCurrent['data/items.json'].data.find(r=>r.id===id).verification=verification;
 const publicPlan=planItem(invalidated,privateCurrent);
 assert.equal(publicPlan['data/items.json'].data.find(r=>r.id===id).verification.schemaVersion,2);
 assert(!JSON.stringify(publicPlan).includes('previous-owner'));assert(!JSON.stringify(publicPlan).includes(actor));
 const alreadyPublished=structuredClone(privateCurrent);alreadyPublished['data/items.json']=publicPlan['data/items.json'];
 assert.deepEqual(planItem(invalidated,alreadyPublished),publicPlan,'response-lost retry accepts the exact public verification summary without dropping private history');
 assert.throws(()=>categoryView(state,'armour',{permissions:['armour_edit']}),e=>e.status===403);
 // Existing price conflicts remain untouched until that exact field is deliberately edited.
 const ap='high-caliber-rifle-ap-ammo',apState=snapshotItem(documents,ap,'ammo',context);
 const apRename=editItem(apState,{action:'edit',expectedRevision:0,shared:{name:'AP renamed'}},context);
 const apPlan=planItem(apRename,documents);
 assert.equal(apPlan['data/items.json'].data.find(r=>r.id===ap).estimatedPrice,500);
 assert.equal(apPlan['data/ammo.json'].data.find(r=>r.id===ap).estimatedPrice,300);
 const reconciled=editItem(apState,{action:'edit',expectedRevision:0,shared:{estimatedPrice:0}},context);
 assert.equal(reconciled.records.items.estimatedPrice,0);assert.equal(reconciled.records.ammo.estimatedPrice,0);
 // Mock GitHub commits both linked files with one non-force main ref update.
 let current=structuredClone(fresh),head='fixture-head',tree,commit,writes=0,failRef=false;
 const sha=d=>crypto.createHash('sha1').update(JSON.stringify(d)).digest('hex');
 const transport=async(url,options={})=>{
  const p=new URL(url).pathname.replace('/repos/fixture/repo',''),b=options.body&&JSON.parse(options.body);
  if(!options.method||options.method==='GET'){
   if(p==='/git/ref/heads/main')return Response.json({object:{sha:head}});
   if(p==='/git/commits/'+head)return Response.json({tree:{sha:'fixture-tree'}});
   if(p.startsWith('/contents/')){const doc=current[p.slice(10)];return Response.json({sha:sha(doc),encoding:'base64',content:Buffer.from(JSON.stringify(doc)).toString('base64')});}
  }
  writes++;
  if(p==='/git/trees'){tree=b;return Response.json({sha:'new-tree'});}
  if(p==='/git/commits'){commit=b;return Response.json({sha:'new-commit'});}
  if(p==='/git/refs/heads/main'){
   assert.equal(b.force,false);assert.deepEqual(commit.parents,[head]);
   if(failRef)return Response.json({},{status:409});
   for(const f of tree.tree)current[f.path]=JSON.parse(f.content);head=b.sha;return Response.json({});
  }
  throw Error('Unexpected fixture URL '+url);
 };
 const base=Object.fromEntries(Object.entries(originals).map(([p,doc])=>[p,sha(doc)]));
 const publisher=createItemPublisher({state:edited,base,repository:'fixture/repo',token:'fixture-only',fetcher:transport});
 const preview=await publisher.preview();assert.equal(writes,0);assert.equal(preview.files.length,2);
 failRef=true;const beforeFailure=structuredClone(current);await assert.rejects(publisher.publish(),e=>e.status===409);assert.deepEqual(current,beforeFailure);
 failRef=false;await publisher.publish();
 assert.equal(current['data/items.json'].data.find(r=>r.id===id).name,'One shared rename');
 assert.equal(current['data/ammo.json'].data.find(r=>r.id===id).name,'One shared rename');
 assert.equal(current['data/items.json'].data.find(r=>r.id!==id).name,'Another published item');
 assert.deepEqual(current['data/armour.json'],originals['data/armour.json']);assert.deepEqual(current['data/weapons.json'],originals['data/weapons.json']);
 const statsOnly=editItem(state,{action:'edit',expectedRevision:0,specialist:{damage:0}},context);
 current=structuredClone(originals);head='stats-head';
 const statsPublisher=createItemPublisher({state:statsOnly,base,repository:'fixture/repo',token:'fixture-only',fetcher:transport});
 const statsPreview=await statsPublisher.preview();assert.equal(statsPreview.files.length,2);
 await statsPublisher.publish();assert.equal(current['data/ammo.json'].data.find(r=>r.id===id).damage,0);
 assert.deepEqual(current['data/items.json'],originals['data/items.json']);assert.deepEqual(statsOnly.records.items,state.records.items);
 // New identities publish the shared record and facet together, with unknowns retained.
 const newId='item-11111111-1111-4111-8111-111111111111';
 const create={action:'create',shared:{name:'Fixture new Ammo'},specialist:{damage:'8 x 12',penetrationPercent:-25}};
 assert.throws(()=>createAmmoItem(documents,newId,{...create,id:'browser-id'},context),/Unsupported/);
 assert.throws(()=>createAmmoItem(documents,'browser-name-slug',create,context),/server-assigned/);
 assert.throws(()=>createAmmoItem(documents,newId,create,{...context,permissions:[]}),e=>e.status===403);
 assert.throws(()=>createAmmoItem(documents,newId,{action:'create',shared:{}},context),/name/);
 const added=createAmmoItem(documents,newId,create,context);
 assert.equal(added.records.items.id,added.records.ammo.id);
 assert.equal(added.records.ammo.category,null);assert.equal(added.records.items.estimatedPrice,null);
 assert.equal(added.records.ammo.source.status,'pending-review');assert(!added.records.ammo.verification);
 const orphan=structuredClone(documents);orphan['data/weapons.json'].data.push({id:newId,name:'Other category'});
 assert.throws(()=>createAmmoItem(orphan,newId,create,context),e=>e.status===409);
 assert.throws(()=>planItem(added,orphan),e=>e.status===409);
 current=structuredClone(originals);head='create-head';failRef=true;
 const addPublisher=createItemPublisher({state:added,base,repository:'fixture/repo',token:'fixture-only',fetcher:transport});
 const addPreview=await addPublisher.preview();assert.equal(addPreview.files.length,2);assert.equal(current['data/items.json'].data.length,originals['data/items.json'].data.length);
 await assert.rejects(addPublisher.publish(),e=>e.status===409);assert.deepEqual(current,originals);
 failRef=false;await addPublisher.publish();await addPublisher.publish();
 assert.equal(current['data/items.json'].data.filter(r=>r.id===newId).length,1);
 assert.equal(current['data/ammo.json'].data.filter(r=>r.id===newId).length,1);
 const afterAdd=reconcilePublishedItem(added,current);assert.deepEqual(afterAdd.creation,{});assert.deepEqual(afterAdd.changes,{});
 const later=editItem(afterAdd,{action:'edit',expectedRevision:afterAdd.revision,shared:{name:'New Ammo updated'}},context);
 assert.equal(planItem(later,current)['data/ammo.json'].data.find(r=>r.id===newId).name,'New Ammo updated');
 const collision=structuredClone(originals);collision['data/items.json'].data.push({...added.records.items,name:'Concurrent different record'});
 assert.throws(()=>planItem(added,collision),e=>e.status===409);
 // Facet creation keeps an explicitly classified existing identity; no name matching.
 const missing=structuredClone(originals);missing['data/ammo.json'].data=missing['data/ammo.json'].data.filter(r=>r.id!==id);
 const missingState=snapshotItem(missing,id,'ammo',context),facetAdded=addAmmoFacet(missingState,{action:'add-facet',expectedRevision:0,confirmId:id,specialist:{damage:0}},context);
 assert.deepEqual(facetAdded.records.items,missingState.records.items);
 const facetPlan=planItem(facetAdded,missing);assert.equal(facetPlan['data/ammo.json'].data.find(r=>r.id===id).damage,0);
 assert.deepEqual(facetPlan['data/items.json'],missing['data/items.json']);
 assert.throws(()=>addAmmoFacet(state,{action:'add-facet',expectedRevision:0,confirmId:id},context),e=>e.status===409);
 assert.deepEqual(documents,originals);
 console.log('PASS Ammo creation: server identity, permissions, unknown facts, orphan/concurrent collisions, atomic paired add with failed-ref protection, duplicate-free retry, post-publication editing and explicit missing-facet creation.');
 console.log('PASS per-item contract: category permission/membership, protected fields, one-item edits, history/privacy, pending legacy-work blockers, unrelated concurrent changes, same-field conflicts, deliberate reconciliation and atomic linked Git publication with failed-ref preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
