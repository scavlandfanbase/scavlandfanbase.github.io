import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepare,createHandler,paths} from '../supabase/functions/_shared/records.js';
const fixture=()=>Object.fromEntries([...Object.values(paths),'data/factions.json'].map(p=>[p,JSON.parse(fs.readFileSync(p,'utf8'))]));
const source={file:null,status:'pending-review',note:null,lastVerified:null};
test('all six kinds create, and specialists get shared entries without guessed verification',()=>{
  for(const kind of Object.keys(paths)){
    const docs=fixture(),sample=docs[paths[kind]].data[0];
    const changes=kind==='items'?{name:'Test resource',classification:['crafting-resource'],source}:kind==='vendors'?{name:'Test vendor',factionId:'gunners',source}:kind==='crafting'?{name:'Test recipe',workbench:'medical',ingredients:[{itemId:'metal-scrap',quantity:2,name:'stale'}],source}:{name:'Test '+kind,category:sample.category,...(kind==='weapons'?{tier:sample.tier}:{}),source};
    const result=prepare({kind,create:true,changes},docs);
    assert.ok(docs[paths[kind]].data.some(x=>x.id===result.record.id));
    if(!['items','vendors'].includes(kind)){const shared=docs[paths.items].data.find(x=>x.id===result.record.id);assert.ok(shared);assert.equal(shared.source.status,'pending-review');}
    if(kind==='crafting')assert.equal(result.record.ingredients[0].name,'Metal Scrap');
  }
});
test('a second save updates the new record rather than creating a duplicate',()=>{
  const docs=fixture(),first=prepare({kind:'items',create:true,changes:{name:'Test resource',classification:['junk-item'],source}},docs).record;
  const second=prepare({kind:'items',id:first.id,original:structuredClone(first),changes:{name:'Renamed resource'}},docs).record;
  assert.equal(second.id,first.id);assert.equal(docs[paths.items].data.filter(x=>x.id===first.id).length,1);
});
test('duplicate names and stale forms are rejected',()=>{
  const docs=fixture(),item=docs[paths.items].data[0];
  assert.throws(()=>prepare({kind:'items',create:true,changes:{name:item.name,classification:['junk-item']}},docs),/exists/);
  assert.throws(()=>prepare({kind:'items',id:item.id,original:{...item,name:'stale'},changes:{name:'Oops'}},docs),/changed since/);
});
test('link an existing shared item without destroying classifications or evidence',()=>{
  const docs=fixture(),shared=docs[paths.items].data.find(x=>x.id==='metal-scrap'),before=structuredClone(shared);
  prepare({kind:'crafting',create:true,changes:{name:shared.name,workbench:'weapon',ingredients:[{itemId:'fabric-scrap',name:'Fabric Scrap',quantity:1}],source}},docs);
  assert.equal(docs[paths.crafting].data.at(-1).id,shared.id);
  assert.deepEqual(shared.source,before.source);for(const c of before.classification)assert.ok(shared.classification.includes(c));assert.ok(shared.classification.includes('crafted-item'));
});
test('negative ammunition penetration is accepted and malformed source is rejected',()=>{
  const docs=fixture(),item=docs[paths.ammunition].data[0];
  prepare({kind:'ammunition',id:item.id,changes:{penetrationPercent:-25}},docs);
  assert.equal(item.penetrationPercent,100); // replaced record, fixture object is not mutated
  assert.equal(docs[paths.ammunition].data[0].penetrationPercent,-25);
  assert.throws(()=>prepare({kind:'ammunition',id:item.id,changes:{source:{status:'screenshot-verified'}}},docs),/screenshot/);
});
test('unknown ingredient IDs and fractional quantities are rejected',()=>{
  for(const row of [{itemId:'missing',quantity:1},{itemId:'metal-scrap',quantity:1.5}])assert.throws(()=>prepare({kind:'crafting',create:true,changes:{name:'Invalid recipe',workbench:'medical',ingredients:[row]}},fixture()),/ingredient/);
});
test('armour verification requires full durability',()=>{
  const docs=fixture(),item=docs[paths.armour].data[0];
  assert.throws(()=>prepare({kind:'armour',id:item.id,changes:{durability:50,source:{status:'screenshot-verified',file:'evidence-inbox/example.png'}}},docs),/100%/);
});
test('an unrelated vendor edit preserves every inventory and evidence field',()=>{
  const docs=fixture(),old=structuredClone(docs[paths.vendors].data[0]);
  const result=prepare({kind:'vendors',id:old.id,changes:{location:'New location'}},docs).record;
  assert.deepEqual(result.inventory,old.inventory);assert.deepEqual(result.shopEvidence,old.shopEvidence);assert.deepEqual(result.portrait,old.portrait);
});
test('linked names and pictures sync without replacing unrelated specialist stats',()=>{
  const docs=fixture(),weapon=docs[paths.weapons].data[0],damage=weapon.damage;
  prepare({kind:'items',id:weapon.id,changes:{name:'Renamed weapon',image:'images/new.png'}},docs);
  assert.equal(weapon.name,'Renamed weapon');assert.equal(weapon.damage,damage);
  for(const v of docs[paths.vendors].data)for(const r of v.inventory)if(r.itemId===weapon.id)assert.equal(r.name,'Renamed weapon');
});
function service({deny=false,conflict=false,missing=false}={}){
  const docs=fixture(),calls=[],env=k=>({SUPABASE_URL:'https://supabase.test',SUPABASE_ANON_KEY:'anon',GITHUB_TOKEN:'private'})[k];
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
  const fetcher=async(url,opt={})=>{
    const body=opt.body?JSON.parse(opt.body):null;calls.push({url,...opt,body});
    if(url.endsWith('/auth/v1/user'))return json({},deny?401:200);
    if(url.endsWith('/rpc/is_scavland_admin'))return json(true);
    if(url.endsWith('/git/ref/heads/main'))return json({object:{sha:'base'}});
    if(url.endsWith('/git/commits/base'))return json({tree:{sha:'tree'}});
    if(url.includes('/contents/')){const path=url.split('/contents/')[1].split('?')[0];return json({content:Buffer.from(JSON.stringify(docs[path])).toString('base64')});}
    if(url.includes('/git/trees/tree?'))return json({tree:missing?[]:[{type:'blob',path:'images/example.png'}],truncated:false});
    if(opt.method==='PATCH')return json({},conflict?422:200);
    return json({sha:'new-sha'});
  };
  return {calls,handler:createHandler('specialist',env,fetcher)};
}
const request=changes=>new Request('https://service.test',{method:'POST',headers:{Authorization:'Bearer user','Content-Type':'application/json'},body:JSON.stringify({kind:'weapons',create:true,changes:{name:'New test weapon',category:'Pistols',tier:'Scrap',source,...changes}})});
test('one atomic tree contains specialist and shared item; only then move main without force',async()=>{
  const {handler,calls}=service();const response=await handler(request({}));assert.equal(response.status,200);
  const tree=calls.find(c=>c.url.endsWith('/git/trees'));assert.ok(tree.body.tree.some(x=>x.path===paths.weapons));assert.ok(tree.body.tree.some(x=>x.path===paths.items));
  const mutation=calls.filter(c=>c.method==='PATCH');assert.equal(mutation.length,1);assert.equal(mutation[0].body.force,false);
  assert.equal(calls.some(c=>c.method==='PUT'),false);
});
test('a competing main commit returns a conflict instead of a partial publish',async()=>{
  const {handler}=service({conflict:true});const response=await handler(request({}));assert.equal(response.status,409);assert.match((await response.json()).error,/changed while saving/);
});
test('unauthorized requests cannot reach GitHub',async()=>{
  const {handler,calls}=service({deny:true});assert.equal((await handler(request({}))).status,403);assert.equal(calls.length,1);
});
test('missing supporting pictures are rejected before any git writes',async()=>{
  const {handler,calls}=service({missing:true});assert.equal((await handler(request({image:'images/missing.png'}))).status,400);assert.equal(calls.some(c=>c.url.includes('api.github')&&c.method!=='GET'),false);
});
test('picture, library and data enter the same commit',async()=>{
  const {handler,calls}=service();const req=request({image:'evidence-inbox/admin/test.png'});const body=await req.json();body.uploads=[{path:body.changes.image,content:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')}];
  const response=await handler(new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(body)}));assert.equal(response.status,200);
  const tree=calls.find(c=>c.url.endsWith('/git/trees')).body.tree;assert.ok(tree.some(x=>x.path===body.changes.image));assert.ok(tree.some(x=>x.path==='data/admin-images.json'));
});
