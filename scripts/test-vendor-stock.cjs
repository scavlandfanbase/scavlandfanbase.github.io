const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('vendor-stock.js','utf8'),context);
const suggest=context.ScavVendorStock.defaults;
const item={id:'item',name:'An item',estimatedPrice:0,rank:0,description:'Recorded details',source:{status:'screenshot-verified'}};
let row=suggest(item,{armour:[{id:'item',price:20,vendorRank:'2'}]},[]);
assert.equal(row.price,0);assert.equal(row.rank,'0');assert.equal(row.details,'Recorded details');assert.equal(row.source.status,'pending-review');assert.equal(row.source.file,null);
row=suggest({id:'item',name:'Armour'},{armour:[{id:'item',price:20,vendorRank:'2',category:'Helmets'}]},[]);
assert.equal(row.price,20);assert.equal(row.rank,'2');
row=suggest({id:'item',name:'Attachment'},{},[{inventory:[{itemId:'item',price:75,rank:'3',details:'Grip'}]}]);
assert.equal(row.price,75);assert.equal(row.rank,'3');assert.equal(row.details,'Grip');
row=suggest({id:'item',name:'Conflicting shop data'},{},[{inventory:[{itemId:'item',price:75,rank:'3'},{itemId:'item',price:100,rank:'4'}]}]);
assert.equal(row.price,null);assert.equal(row.rank,'');
row=suggest({id:'item',name:'Unknown'});assert.equal(row.price,null);assert.equal(row.rank,'');
const read=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8')).data;
const items=read('items'),vendors=read('vendors'),catalog=Object.fromEntries(['weapons','armour','ammo'].map(name=>[name,read(name)]));
for(const id of ['pm-nikolay','mk-triangle-stock','armoured-rags','mutated-stick']){
  row=suggest(items.find(item=>item.id===id),catalog,vendors);assert.equal(row.itemId,id);assert.notEqual(row.price,null);assert.notEqual(row.rank,'');assert.equal(row.source.status,'pending-review');
}
console.log('PASS stock defaults: full registry examples, price/rank precedence, zero values, unknown/conflicting data, conservative provenance.');
