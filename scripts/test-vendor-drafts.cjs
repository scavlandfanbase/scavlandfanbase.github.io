const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createStore,createServer}=require('./page-builder-server.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scav-vendors-')),store=createStore(directory,{vendorMode:true});
 const source=fs.readFileSync(path.join(__dirname,'../data/vendors.json'),'utf8'),initial=store.read();
 let state=initial,id=state.data[0].id;
 const act=(action,extra={})=>{const r=store.mutate({action,id,revision:state.revision,...extra});state=r.state;return r;};
 act('edit',{details:{name:'Edited',location:'Draft location',factionId:state.data[0].factionId},inventory:[]});
 assert.deepEqual(state.data[0].inventory,initial.data[0].inventory);assert.deepEqual(state.data[0].source,initial.data[0].source);
 assert.throws(()=>store.mutate({action:'visibility',id,revision:0}),/another window/);
 const before=JSON.stringify(state);assert.throws(()=>act('image',{image:'../private.json'}));assert.equal(JSON.stringify(store.read()),before);
 act('image',{image:'images/vendors/grigory.png'});assert.deepEqual(state.data[0].portrait,{file:'images/vendors/grigory.png'});
 act('image',{image:null});assert.equal(state.data[0].portrait,undefined);
 act('move',{direction:1});assert.equal(state.data[1].id,id);
 act('visibility');assert.equal(state.data[1].hidden,true);
 const copy=act('duplicate');assert.notEqual(copy.selectedId,id);assert.deepEqual(state.data.find(v=>v.id===copy.selectedId).inventory,[]);
 assert.throws(()=>act('archive',{confirmId:'wrong'}));act('archive',{confirmId:id});assert.throws(()=>act('edit',{details:{name:'No'}}),/Restore/);act('restore');
 act('add',{details:{name:'New vendor',location:'',factionId:''}});
 assert.equal(createStore(directory,{vendorMode:true}).read().revision,state.revision);
 const server=createServer({directory,vendorMode:true,token:'test'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port,headers={'X-Scav-Session':'test',Origin:base,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/vendors')).status,403);
  for(const route of ['/vendors.json','/data/vendors.json','/api/pages','/pages/test','/.git/config'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/api/vendors',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/vendors',{headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,403);
  const result=await fetch(base+'/api/vendors',{headers});assert.equal(result.status,200);assert.deepEqual(await result.json(),state);
  fs.writeFileSync(path.join(directory,'vendors.json'),'broken');assert.throws(()=>store.read(),/preserved/);assert.throws(()=>act('visibility'));assert.equal(fs.readFileSync(path.join(directory,'vendors.json'),'utf8'),'broken');
  assert.equal(fs.readFileSync(path.join(__dirname,'../data/vendors.json'),'utf8'),source);
 }finally{await new Promise(r=>server.close(r));}
 console.log('PASS vendor draft operations, inventory/metadata preservation, durable reload, conflicts, invalid edits, private access, cross-site rejection, corrupt storage and unchanged public source');
})().catch(e=>{console.error(e);process.exitCode=1;});
