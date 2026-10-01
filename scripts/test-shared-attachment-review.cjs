const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Review=require('../shared-attachment-review.cjs');
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name+'.json'),'utf8'));
const items=load('items').data,listings=load('vendors').vendorListings.listings;
const before=JSON.stringify({items,listings}),actual=Review.create({items,listings});
assert.equal(actual.report().explicit,0);assert.equal(actual.report().candidates,74);
assert.deepEqual(actual.report().unlinkedListings,[]);
assert.equal(JSON.stringify({items,listings}),before);
const fixture=[
 {id:'known',name:'Scope',contentType:'Attachment',attachmentType:'Scope',classification:['attachment']},
 {id:'evidence',name:'Something',source:{file:'evidence-inbox/attachments/proof.png'}},
 {id:'name-only',name:'Rifle Scope'},
 {id:'conflict',contentType:'Attachment',attachmentType:'Unknown',classification:['weapon']},
 {id:'incomplete',classification:['attachment']},
 {id:'hidden',contentType:'Attachment',attachmentType:'Unknown',hidden:true}
];
const stock=[{id:'sale',vendorId:'shop',entity:{type:'item',id:'known'},price:999,rank:3,quantity:2},
 {id:'archived',entity:{type:'item',id:'known'},archived:true},
 {id:'orphan',entity:{type:'item',id:'absent'}}];
const review=Review.create({items:fixture,listings:stock});
assert.equal(review.inspect('known').state,'attachment');
assert.equal(review.inspect('evidence').state,'candidate-review');
assert.equal(review.inspect('name-only').state,'outside-category');
assert.equal(review.inspect('conflict').state,'classification-review');
assert.equal(review.inspect('incomplete').state,'classification-review');
assert.equal(review.inspect('absent'),null);
assert.equal(review.queue().some(r=>r.id==='hidden'),false);
assert.equal(review.queue({includeInactive:true}).some(r=>r.id==='hidden'),true);
assert.deepEqual(review.report().unlinkedListings,['orphan']);
assert.deepEqual(review.inspect('known').stockedBy,[stock[0]]);
const result=review.inspect('known');result.item.name='Mutated';result.stockedBy[0].price=0;
fixture[0].name='Caller mutation';stock[0].rank=0;
assert.equal(review.inspect('known').item.name,'Scope');
assert.equal(review.inspect('known').stockedBy[0].price,999);assert.equal(review.inspect('known').stockedBy[0].rank,3);
assert.throws(()=>Review.create({items:[{id:'x'},{id:'x'}]}),/duplicate/);
assert.throws(()=>Review.create({items:[],listings:[{id:'x'},{id:'x'}]}),/duplicate/);
console.log('PASS Attachment review: 74 candidates, no inferred membership, exact vendor identity, conflicts, inactive filtering and immutable source data.');
