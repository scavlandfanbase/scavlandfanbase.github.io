const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const Items=require('../item-model.cjs'),V=require('../verification.js'),{createStore,createServer}=require('./page-builder-server.cjs');
const root=path.resolve(__dirname,'..'),settings={schemaVersion:1,current_patch_id:'test-patch'},images=['images/test.png'];
let state=Items.foundation({schemaVersion:1,metadata:{keep:true},data:[{id:'stable',name:'Before',category:'Legacy category',properties:{zero:0,unknown:null,no:false,list:[{a:'b'},null]},estimatedPrice:10,source:{status:'screenshot-verified',file:'evidence-inbox/test.png'},extra:{preserved:true}}]});
const original=structuredClone(state);
const run=(action,extra={})=>{const result=Items.mutate(state,{action,id:'stable',revision:state.revision??0,...extra},{images,settings});state=result.state;return result;};
const details={name:'Renamed',category:'Legacy category',description:null,properties:state.data[0].properties};
run('edit',{details});assert.equal(state.data[0].id,'stable');assert.deepEqual(original.data[0].name,'Before');assert.equal(state.data[0].source.status,'screenshot-verified');assert.deepEqual(state.data[0].extra,{preserved:true});assert.equal(V.inspect(state.data[0],settings).status,'unverified');
run('verify',{decision:'verified',confirmId:'stable',patchId:'test-patch',actorId:'forged'});assert.equal(state.data[0].verification.last_verified_by,'local-operator');assert.equal(V.inspect(state.data[0],settings).status,'verified');
assert.throws(()=>Items.mutate(state,{action:'verify',id:'stable',revision:state.revision,decision:'verified',confirmId:'stable',patchId:null},{images,settings:{schemaVersion:1,current_patch_id:null}}),/current patch/);
assert.throws(()=>run('verify',{decision:'verified',patchId:'test-patch'}),/Confirm/);
assert.throws(()=>run('verify',{decision:'verified',confirmId:'stable',patchId:'old'}),/patch changed/);
const sourceBeforeDuplicate=structuredClone(state.data[0]);
const dup=run('duplicate').selectedId,copy=state.data.find(r=>r.id===dup);assert.notEqual(dup,'stable');assert.equal(copy.hidden,true);assert.equal(copy.verification.history.length,0);assert.equal(V.inspect(copy,settings).status,'unverified');assert.deepEqual(copy.properties,details.properties);assert.deepEqual(copy.source,state.data[0].source);assert.deepEqual(state.data[0],sourceBeforeDuplicate);
run('image',{image:images[0]});assert.equal(state.data[0].image,images[0]);assert.equal(V.inspect(state.data[0],settings).status,'unverified');assert.equal(state.data[0].verification.history.filter(e=>e.decision==='verified').length,1);
run('verify',{decision:'unverified',confirmId:'stable',patchId:'test-patch'});assert.equal(state.data[0].verification.decision,'unverified');assert.equal(state.data[0].verification.history.filter(e=>e.decision==='verified').length,1);
assert.throws(()=>run('image',{image:'https://bad.test/x.png'}),/library/);run('image',{image:null});assert.equal(state.data[0].image,null);
run('visibility');assert.equal(state.data[0].hidden,true);run('visibility');assert.equal(state.data[0].hidden,false);
assert.throws(()=>run('archive'),/Confirm/);run('archive',{confirmId:'stable'});assert.equal(state.data.length,2);assert.throws(()=>run('edit',{details}),/Restore/);run('restore');assert.equal(state.data[0].archived,false);
run('edit',{details:{...details,category:'Custom category',properties:[0,false,null,{legacy:'kept'}],description:'Description'}});assert.deepEqual(state.data[0].properties,[0,false,null,{legacy:'kept'}]);
const added=run('add',{details:{name:'Renamed',category:null,description:null,properties:null}}).selectedId;assert.notEqual(added,dup);assert.equal(state.data.find(r=>r.id===added).image,null);
assert.throws(()=>Items.mutate(state,{action:'visibility',id:'stable',revision:0},{images,settings}),e=>e.status===409);
assert.throws(()=>run('edit',{details:{...details,name:''}}));assert.throws(()=>run('move',{direction:1}),/Unknown/);
const before=JSON.stringify(state);assert.throws(()=>run('edit',{details:{...details,properties:5}}));assert.equal(JSON.stringify(state),before);
run('edit',{details:{...details,facts:{estimatedPrice:0}}});assert.equal(state.data[0].estimatedPrice,0);
run('edit',{details:{...details,facts:{estimatedPrice:null}}});assert.equal(state.data[0].estimatedPrice,null);
for(const facts of [{id:'forged'},{verification:null},{source:{}},{rank:1}])assert.throws(()=>run('edit',{details:{...details,facts}}),/recorded fact/);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-items-actions-'));
(async()=>{
 let server;
 try{
  const publicBefore=fs.readFileSync(path.join(root,'data/items.json')),store=createStore(directory,{itemMode:true});
  assert.equal(store.read().data.length,285);assert.equal(fs.existsSync(path.join(directory,'items.json')),false);
  const body={action:'add',revision:0,requestId:crypto.randomUUID(),details:{name:'Test',category:null,description:null,properties:null}};
  const saved=store.mutate(body);assert.equal(saved.state.data.length,286);assert.equal(store.mutate(body).state.data.length,286);assert.equal(store.read().revision,1);
  assert.deepEqual(saved.state.data.slice(0,285),Items.foundation(JSON.parse(publicBefore)).data);
  assert.throws(()=>store.mutate({...body,details:{...body.details,name:'Changed'}}),e=>e.status===409);
  assert.throws(()=>store.mutate({...body,requestId:crypto.randomUUID()}),e=>e.status===409);
  assert.equal(createStore(directory,{itemMode:true}).read().data.at(-1).id,saved.selectedId);
  // Force atomic replacement failure; the previous file remains intact.
  const rename=fs.renameSync;fs.renameSync=()=>{throw new Error('disk unavailable');};
  try{assert.throws(()=>store.mutate({action:'visibility',id:saved.selectedId,revision:1,requestId:crypto.randomUUID()}),e=>e.status===503);}finally{fs.renameSync=rename;}
  assert.equal(store.read().revision,1);assert.deepEqual(fs.readdirSync(directory),['items.json']);
  server=createServer({itemMode:true,directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const auth=await (await fetch(base+'/api/session')).json(),headers={'X-Scav-Session':auth.token,'Content-Type':'application/json',Origin:base};
  assert.equal((await fetch(base+'/api/items',{method:'POST',headers:{...headers,Origin:'https://bad.test'},body:JSON.stringify(body)})).status,403);
  assert.equal((await fetch(base+'/api/items',{method:'POST',headers,body:'bad'})).status,400);
  assert.equal((await fetch(base+'/api/items',{method:'POST',headers,body:JSON.stringify({...body,requestId:crypto.randomUUID()})})).status,409);
  assert.equal((await fetch(base+'/api/items',{method:'DELETE',headers})).status,405);
  assert.equal((await fetch(base+'/api/items',{method:'POST',headers,body:'x'.repeat(1024*1024+1)})).status,413);
  assert.equal((await fetch(base+'/items.json')).status,404);
  const result=await fetch(base+'/api/items',{method:'POST',headers,body:JSON.stringify({action:'visibility',id:saved.selectedId,revision:1,requestId:crypto.randomUUID()})});assert.equal(result.status,200);
  fs.writeFileSync(path.join(directory,'items.json'),'broken');assert.throws(()=>store.read(),/preserved/);assert.equal(fs.readFileSync(path.join(directory,'items.json'),'utf8'),'broken');
  assert.deepEqual(fs.readFileSync(path.join(root,'data/items.json')),publicBefore);
  console.log('PASS Items actions: add/edit/properties/categories/images/duplicate/hide/show/archive/restore/review, immutable IDs, unknown values, provenance/history, atomic storage, stale conflicts, idempotent retry, malformed/protected API and unchanged 285-record public seed.');
 }finally{if(server)await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
