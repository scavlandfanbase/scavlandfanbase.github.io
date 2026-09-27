import assert from 'node:assert/strict';
import {githubPublisher} from '../supabase/functions/admin-drafts/github-publisher.mjs';
let head='head',base='a'.repeat(40),conflict=false,lost=false,tree,commit,writes=[];
const publicData={data:[{id:'stable',name:'Original'},{id:'other',name:'Preserve'}]},unrelated={value:'Keep latest main work'};
const fetcher=async(url,opt)=>{
 const p=new URL(url).pathname.replace('/repos/test/repo',''),body=opt.body?JSON.parse(opt.body):null;
 if(opt.method==='GET'){
  if(p==='/git/ref/heads/main')return Response.json({object:{sha:head}});
  if(p==='/git/commits/'+head)return Response.json({tree:{sha:'current-main-tree'}});
  if(p==='/contents/data/items.json')return Response.json({sha:base,encoding:'base64',content:Buffer.from(JSON.stringify(publicData)).toString('base64')});
  throw Error('Unexpected read '+p);
 }
 writes.push({p,body});
 if(p==='/git/trees'){tree=body;return Response.json({sha:'new-tree'});}
 if(p==='/git/commits'){commit=body;return Response.json({sha:'new-commit'});}
 if(p==='/git/refs/heads/main'){
  assert.equal(body.force,false);if(conflict)return Response.json({},{status:422});
  publicData.data=JSON.parse(tree.tree[0].content).data;head='new-commit';base='b'.repeat(40);
  if(lost)throw Error('lost response');return Response.json({object:{sha:head}});
 }
 throw Error('Unexpected write '+p);
};
const config={repository:'test/repo',token:'test',paths:['data/items.json'],fetcher,validate:d=>{if(typeof d.payload.name!=='string'||!d.payload.name.trim())throw Object.assign(Error('Name required'),{status:400});},project:(d,docs)=>{docs['data/items.json'].data.find(r=>r.id===d.entity_id).name=d.payload.name;return docs;}};
const publisher=githubPublisher(config),draft={domain:'items',entity_id:'stable',version:1,payload:{name:'Draft'},base:{'data/items.json':base}};
await publisher.preview(draft);assert.equal(writes.length,0);assert.equal(publicData.data[0].name,'Original');
await assert.rejects(publisher.publish({...draft,base:{'data/items.json':'c'.repeat(40)}}),e=>e.status===409);assert.equal(writes.length,0);
await assert.rejects(publisher.publish({...draft,payload:{name:''}}));assert.equal(writes.length,0);
conflict=true;await assert.rejects(publisher.publish(draft),e=>e.status===409);assert.equal(publicData.data[0].name,'Original');conflict=false;
const result=await publisher.publish(draft);assert.equal(result.commit,'new-commit');assert.equal(publicData.data[0].name,'Draft');assert.equal(publicData.data[1].name,'Preserve');assert.equal(unrelated.value,'Keep latest main work');assert.equal(tree.base_tree,'current-main-tree');assert.deepEqual(commit.parents,['head']);assert.deepEqual(tree.tree.map(r=>r.path),['data/items.json']);
await assert.rejects(publisher.publish(draft),e=>e.status===409); // No blind replay using latest SHA.
const invalid=githubPublisher({...config,project:()=>({'data/evil.json':{}})});await assert.rejects(invalid.publish({...draft,base:{'data/items.json':base}}),/projection/);
const snapshot=structuredClone(draft);lost=true;await assert.rejects(publisher.publish({...draft,version:2,payload:{name:'Confirmed only by reconciliation'},base:{'data/items.json':base}}));assert.deepEqual(draft,snapshot);
console.log('PASS R1 GitHub boundary: read-only preview, validation, stale public base, competing-main rejection, allowlisted atomic tree, unrelated records/main tree retained, no force, lost-response reconciliation and immutable drafts. All transport mocked.');
