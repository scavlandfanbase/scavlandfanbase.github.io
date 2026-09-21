const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('item-catalog.js','utf8'),context);
const project=context.ScavCatalog.records;
for(const [kind,tag] of Object.entries({weapons:'weapon',armour:'armour',ammunition:'ammunition',crafting:'crafted-item'})){
  const shared=[{id:'new-item',name:'New item',image:'images/item.png',classification:[tag],source:{status:'screenshot-verified'}}];
  const before=JSON.stringify(shared);
  const rows=project(kind,shared,[]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'new-item');assert.equal(rows[0].source.status,'pending-review');
  const known={id:'new-item',name:'Old name',damage:42,source:{status:'screenshot-verified'}};
  const complete=project(kind,shared,[known]);assert.equal(complete.length,1);assert.equal(complete[0].damage,42);assert.equal(complete[0].name,'New item');
  assert.equal(project(kind,shared,[known],{editor:true})[0],known,'editor original must match the stored record for conflict checks');
  assert.equal(JSON.stringify(shared),before);
  shared[0].classification=[];
  assert.equal(project(kind,shared,[known]).length,0,'removed tag hides the public entry');
  assert.equal(project(kind,shared,[known],{editor:true}).length,1,'removing a tag never deletes stored stats');
}
console.log('PASS catalog: all four specialist tags, pending evidence, existing details, no duplicates, tag removal and immutable editor originals.');
