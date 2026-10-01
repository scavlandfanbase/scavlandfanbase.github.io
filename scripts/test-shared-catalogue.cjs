const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Catalogue=require('../shared-catalogue.js'),Vendors=require('../vendor-canonical.js');
const root=path.resolve(__dirname,'..'),load=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const registries=Object.fromEntries(['items','ammo','armour','weapons'].map(n=>[n,load(n).data]));
const original=JSON.stringify(registries),catalogue=Catalogue.create(registries),report=catalogue.report();
for(const [kind,count]of Object.entries({ammo:13,armour:31,weapons:39})){
 assert.equal(report.categories[kind].records,count);assert.equal(report.categories[kind].linked,count);
 assert.deepEqual(report.categories[kind].unlinked,[]);
}
const vendors=load('vendors');
for(const row of vendors.vendorListings.listings){assert.equal(row.entity.type,'item');assert(catalogue.item(row.entity.id));}
assert.equal(JSON.stringify(registries),original,'inspection must not change any source data');
assert.equal(report.categories.ammo.conflicts.filter(c=>c.field==='estimatedPrice').length,2);
assert.equal(report.categories.weapons.conflicts.filter(c=>c.field==='name').length,2);
const shared={id:'stable',name:'Renamed armour',image:null,description:'Shared description',classification:['armour']};
const specialist={id:'stable',name:'Old name',image:'images/old.png',ballistic:50,source:{file:'evidence-inbox/proof.png'}};
const demo=Catalogue.create({items:[shared],armour:[specialist,{id:'unlinked',name:shared.name}]});
const resolved=demo.item('stable');assert.equal(resolved.shared.name,shared.name);assert.equal(resolved.shared.image,null);
assert.equal(resolved.specialists.armour.ballistic,50);assert.deepEqual(resolved.specialists.armour.source,specialist.source);
assert.equal(demo.item('unlinked'),null,'matching names cannot invent links');
assert.deepEqual(demo.report().categories.armour.unlinked,['unlinked']);
assert.equal(demo.category('armour').length,1);
resolved.canonical.name='Attempted mutation';shared.name='Caller mutation';assert.equal(demo.item('stable').shared.name,'Renamed armour');
assert.throws(()=>Catalogue.create({items:[{id:'same'},{id:'same'}]}),/duplicate/);
const listing={id:'stock',vendorId:'shop',entity:{type:'item',id:'stable'},archived:false,displayOrder:0,price:999,rank:3};
const stock=Vendors.rows('shop',{listings:[listing]},[demo.item('stable').canonical]);
assert.equal(stock[0].item.name,'Renamed armour');assert.equal(stock[0].listing.price,999);assert.equal(stock[0].listing.rank,3);
assert.deepEqual(specialist,{id:'stable',name:'Old name',image:'images/old.png',ballistic:50,source:{file:'evidence-inbox/proof.png'}});
console.log('PASS shared catalogue: all current specialist/vendor identities, explicit conflict reporting, no name inference, null/source/stat preservation, category views, immutable snapshots and independent vendor commercial values.');
