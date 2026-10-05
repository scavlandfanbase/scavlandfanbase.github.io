const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createStore,createServer}=require('./page-builder-server.cjs'),L=require('../vendor-listings.js'),M=require('../vendor-inventory-model.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-inventory-')),store=createStore(directory,{vendorMode:true});
 const catalog=store.catalog(),original=store.read(),sourceFiles=['items','weapons','ammo','armour','vendors','verification-settings'];
 const sources=sourceFiles.map(n=>fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
 assert.deepEqual(Object.keys(catalog.entities),L.types);assert.deepEqual(catalog.entities.attachment,[]);assert.deepEqual(catalog.entities.blueprint,[]);
 let state=original,id=state.data[0].id;
 const act=(operation,extra={})=>{state=store.mutate({action:'inventory',operation,id,revision:state.revision,...extra}).state;return state;};
 const ref={type:'weapon',id:catalog.entities.weapon[0].id};act('add',{entity:ref});
 const row=()=>state.vendorListings.listings.find(r=>r.vendorId===id),listingId=row().id;
 for(const field of ['rank','price','quantity','notes','displayOrder'])assert.equal(row()[field],null);
 assert.throws(()=>act('add',{entity:ref}),/already has/);
 assert.throws(()=>act('edit',{listingId,fields:{quantity:-1}}));assert.throws(()=>act('edit',{listingId,fields:{entity:ref}}));
 act('edit',{listingId,fields:{rank:0,price:0,quantity:0,notes:'<script>text only</script>'}});assert.equal(row().quantity,0);
 const other=state.data[1].id;
 assert.throws(()=>store.mutate({action:'inventory',operation:'remove',id:other,revision:state.revision,listingId,confirmId:listingId}),/belonging/);
 state=store.mutate({action:'inventory',operation:'add',id:other,revision:state.revision,entity:ref}).state;
 assert.equal(state.vendorListings.listings.find(r=>r.vendorId===other).price,null);
 act('add',{entity:{type:'ammo',id:catalog.entities.ammo[0].id}});
 let ordered=L.forVendor(state.vendorListings,id);act('move',{listingId:ordered[0].id,direction:1});assert.equal(L.forVendor(state.vendorListings,id)[1].id,ordered[0].id);
 act('archive',{listingId});assert.throws(()=>act('add',{entity:ref}),/restore or edit/);act('restore',{listingId});
 const stable=store.read();assert.throws(()=>store.mutate({action:'inventory',operation:'remove',id,revision:0,listingId,confirmId:listingId}),/another window/);assert.deepEqual(store.read(),stable);
 // Existing attestation is invalidated on commercial edits, with trusted local identity.
 state.vendorListings=L.decide(state.vendorListings,listingId,'verified',L.registry({vendors:state.data,entities:catalog.entities}),{settings:catalog.settings,actorId:'fixture-reviewer'});
 fs.writeFileSync(path.join(directory,'vendors.json'),JSON.stringify(state));
 act('edit',{listingId,fields:{price:5},actorId:'untrusted'});assert.equal(row().verification.decision,'unverified');assert.equal(row().verification.history.at(-1).by,'local-operator');
 act('archive',{listingId});assert.equal(row().verification.history.length,2);act('restore',{listingId});
 assert.throws(()=>act('remove',{listingId,confirmId:'wrong'}));act('remove',{listingId,confirmId:listingId});assert(!state.vendorListings.listings.some(r=>r.id===listingId));
 assert.equal(state.vendorListings.listings.find(r=>r.vendorId===other).price,null);
 assert.deepEqual(state.data,original.data);assert.deepEqual(createStore(directory,{vendorMode:true}).read(),state);
 const retained=structuredClone(state.vendorListings);
 state=store.mutate({action:'visibility',id,revision:state.revision}).state;assert.deepEqual(state.vendorListings,retained);
 state=store.mutate({action:'archive',id,revision:state.revision,confirmId:id}).state;assert.deepEqual(state.vendorListings,retained);
 assert.throws(()=>act('add',{entity:ref}),/active vendor/);
 state=store.mutate({action:'restore',id,revision:state.revision}).state;
 // Every 8A type uses the same endpoint integration; missing sources are never invented.
 const entities=Object.fromEntries(L.types.map(t=>[t,[{id:'same',name:'Same name'}]]));let fixture={version:1,revision:0,data:[{id:'v',name:'Vendor'}]};
 for(const type of L.types)fixture=M.mutate(fixture,{revision:fixture.revision,id:'v',operation:'add',entity:{type,id:'same'}},entities,catalog.settings).state;
 assert.equal(fixture.vendorListings.listings.length,6);
 // Review intent is exact, patch-bound and isolated from other listings/entities.
 const target=fixture.vendorListings.listings[0],beforeReview=structuredClone(fixture),beforeEntities=structuredClone(entities);
 const review={revision:fixture.revision,id:'v',operation:'verify',listingId:target.id,confirmId:target.id,decision:'verified',patchId:catalog.settings.current_patch_id};
 for(const extra of [{actorId:'forged'},{clock:'forged'},{history:[]},{confirmId:'wrong'},{patchId:'stale'},{decision:'invented'}])assert.throws(()=>M.mutate(fixture,{...review,...extra},entities,catalog.settings,'trusted-reviewer'));
 assert.throws(()=>M.mutate(fixture,review,{...entities,[target.entity.type]:[]},catalog.settings,'trusted-reviewer'));
 assert.throws(()=>M.mutate({...fixture,data:[{id:'v',name:'Vendor',archived:true}]},review,entities,catalog.settings,'trusted-reviewer'));
 const noPatch={...catalog.settings,current_patch_id:null};assert.throws(()=>M.mutate(fixture,{...review,patchId:null},entities,noPatch,'trusted-reviewer'));
 fixture=M.mutate(fixture,review,entities,catalog.settings,'trusted-reviewer').state;
 assert.equal(fixture.vendorListings.listings[0].verification.last_verified_by,'trusted-reviewer');
 assert.deepEqual(fixture.vendorListings.listings.slice(1),beforeReview.vendorListings.listings.slice(1));assert.deepEqual(entities,beforeEntities);
 for(const field of ['rank','price','quantity','notes'])assert.equal(fixture.vendorListings.listings[0][field],null);
 const server=createServer({directory,vendorMode:true,token:'test'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port,headers={'X-Scav-Session':'test',Origin:base,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/vendor-catalog')).status,403);
  assert.equal((await fetch(base+'/api/vendor-catalog',{headers:{...headers,Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(base+'/api/vendor-catalog',{method:'POST',headers,body:'{}'})).status,405);
  assert.deepEqual(await(await fetch(base+'/api/vendor-catalog',{headers})).json(),catalog);
  for(const route of ['/data/items.json','/data/weapons.json','/vendor-inventory-model.cjs','/vendors.json'])assert.equal((await fetch(base+route)).status,404);
  const before=fs.readFileSync(path.join(directory,'vendors.json'),'utf8');
  const rename=fs.renameSync;fs.renameSync=()=>{throw new Error('Simulated disk failure');};
  try{assert.throws(()=>act('add',{entity:ref}),/previous saved file is preserved/);}finally{fs.renameSync=rename;}
  assert.equal(fs.readFileSync(path.join(directory,'vendors.json'),'utf8'),before);
  fs.writeFileSync(path.join(directory,'vendors.json'),JSON.stringify({...state,vendorListings:null}));assert.throws(()=>store.read());
 }finally{await new Promise(r=>server.close(r));}
 sourceFiles.forEach((n,i)=>assert.equal(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'),sources[i]));
 console.log('PASS inventory storage: empty start, exact types/IDs, six types, unknown/zero, isolation, reorder/archive/restore/remove, history, conflicts, access controls, disk failure, corruption, unchanged source data');
})().catch(e=>{console.error(e);process.exitCode=1;});
