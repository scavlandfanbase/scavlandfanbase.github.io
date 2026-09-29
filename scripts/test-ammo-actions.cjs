const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const Ammo=require('../ammo-model.cjs'),V=require('../verification.js');
const root=path.resolve(__dirname,'..'),settings={schemaVersion:1,current_patch_id:'test-patch'},images=['images/test.png'];
let state=Ammo.foundation({schemaVersion:1,metadata:{keep:true},data:[{id:'stable',name:'Before',category:'Legacy category',damage:'6 x 5 = 30',estimatedPrice:10,source:{status:'screenshot-verified',file:'evidence-inbox/test.png'},extra:{preserved:true}}]});
const original=structuredClone(state);
const run=(action,extra={})=>{const result=Ammo.mutate(state,{action,id:'stable',revision:state.revision??0,...extra},{images,settings});state=result.state;return result;};
const details={name:'Renamed',category:'Legacy category',description:null,facts:{damage:state.data[0].damage}};
run('edit',{details});assert.equal(state.data[0].id,'stable');assert.deepEqual(original.data[0].name,'Before');assert.equal(state.data[0].source.status,'screenshot-verified');assert.deepEqual(state.data[0].extra,{preserved:true});assert.equal(V.inspect(state.data[0],settings).status,'unverified');
run('verify',{decision:'verified',confirmId:'stable',patchId:'test-patch',actorId:'forged'});assert.equal(state.data[0].verification.last_verified_by,'local-operator');assert.equal(V.inspect(state.data[0],settings).status,'verified');
assert.throws(()=>Ammo.mutate(state,{action:'verify',id:'stable',revision:state.revision,decision:'verified',confirmId:'stable',patchId:null},{images,settings:{schemaVersion:1,current_patch_id:null}}),/current patch/);
assert.throws(()=>run('verify',{decision:'verified',patchId:'test-patch'}),/Confirm/);
assert.throws(()=>run('verify',{decision:'verified',confirmId:'stable',patchId:'old'}),/patch changed/);
const sourceBeforeDuplicate=structuredClone(state.data[0]);
const dup=run('duplicate').selectedId,copy=state.data.find(r=>r.id===dup);assert.notEqual(dup,'stable');assert.equal(copy.hidden,true);assert.equal(copy.verification.history.length,0);assert.equal(V.inspect(copy,settings).status,'unverified');assert.deepEqual(copy.damage,details.facts.damage);assert.deepEqual(copy.source,state.data[0].source);assert.deepEqual(state.data[0],sourceBeforeDuplicate);
run('image',{image:images[0]});assert.equal(state.data[0].image,images[0]);assert.equal(V.inspect(state.data[0],settings).status,'unverified');assert.equal(state.data[0].verification.history.filter(e=>e.decision==='verified').length,1);
run('verify',{decision:'unverified',confirmId:'stable',patchId:'test-patch'});assert.equal(state.data[0].verification.decision,'unverified');assert.equal(state.data[0].verification.history.filter(e=>e.decision==='verified').length,1);
assert.throws(()=>run('image',{image:'https://bad.test/x.png'}),/library/);run('image',{image:null});assert.equal(state.data[0].image,null);
run('visibility');assert.equal(state.data[0].hidden,true);run('visibility');assert.equal(state.data[0].hidden,false);
assert.throws(()=>run('archive'),/Confirm/);run('archive',{confirmId:'stable'});assert.equal(state.data.length,2);assert.throws(()=>run('edit',{details}),/Restore/);run('restore');assert.equal(state.data[0].archived,false);
run('edit',{details:{...details,category:'Custom category',facts:{damage:'Unknown',penetrationPercent:-25,maxStack:0},description:'Description'}});assert.equal(state.data[0].penetrationPercent,-25);assert.equal(state.data[0].maxStack,0);
const added=run('add',{details:{name:'Renamed',category:null,description:null,facts:{}}}).selectedId;assert.notEqual(added,dup);assert.equal(state.data.find(r=>r.id===added).image,null);
assert.throws(()=>Ammo.mutate(state,{action:'visibility',id:'stable',revision:0},{images,settings}),e=>e.status===409);
assert.throws(()=>run('edit',{details:{...details,name:''}}));assert.throws(()=>run('move',{direction:1}),/Unknown/);
const before=JSON.stringify(state);assert.throws(()=>run('edit',{details:{...details,facts:{damage:Infinity}}}));assert.equal(JSON.stringify(state),before);
run('edit',{details:{...details,facts:{estimatedPrice:0}}});assert.equal(state.data[0].estimatedPrice,0);
run('edit',{details:{...details,facts:{estimatedPrice:null}}});assert.equal(state.data[0].estimatedPrice,null);
for(const facts of [{id:'forged'},{verification:null},{source:{}},{unsupported:1}])assert.throws(()=>run('edit',{details:{...details,facts}}),/recorded fact/);
run('archive',{confirmId:'stable'});
const archivedBefore=structuredClone(state.data[0]);
run('add',{details:{name:'Added from archived selection',category:null,description:null}});
assert.deepEqual(state.data[0],archivedBefore);
run('restore');
// No-op editing preserves every supplied source value and every absent fact.
const source=Ammo.foundation(JSON.parse(fs.readFileSync(path.join(root,'data/ammo.json'))));
for(const record of source.data){
 const facts=Object.fromEntries(Ammo.factFields.filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]]));
 const next=Ammo.mutate(source,{action:'edit',id:record.id,revision:0,details:{name:record.name,category:record.category,description:record.description,facts}},{images,settings}).state.data.find(r=>r.id===record.id);
 for(const key of Object.keys(record))if(key!=='updatedAt')assert.deepEqual(next[key],record[key]);
 for(const key of Ammo.factFields)assert.equal(Object.hasOwn(next,key),Object.hasOwn(record,key));
}
for(const value of [null,0,-25,'','Unknown','6 x 5 = 30']){
 run('edit',{details:{...details,facts:{damage:value,penetrationPercent:value,maxStack:value}}});
 for(const key of ['damage','penetrationPercent','maxStack'])assert.deepEqual(state.data[0][key],value);
}
console.log('PASS Ammo model: all source facts and absent fields preserved, private actions, provenance, verification history and unknown/zero/text values.');
