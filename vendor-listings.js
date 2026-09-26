/* Pure relationship model. No storage, network, migration or canonical-record writes.
 * Registries must be explicitly supplied by a trusted caller; never infer links by name.
 */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./verification.js'):root.ScavVerification);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavVendorListings=api;
})(globalThis,function(Verification){
 'use strict';
 const types=Object.freeze(['item','weapon','ammo','armour','attachment','blueprint']);
 const fields=['id','vendorId','entity','rank','price','quantity','notes','displayOrder','archived','verification'];
 const editable=['rank','price','quantity','notes','displayOrder'];
 const fail=message=>{throw new Error(message);};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function keys(value,allowed){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Unsupported listing fields. Canonical attributes belong on their canonical record.');}
 function id(value){if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>160)fail('An exact stable ID is required.');}
 function reference(value){keys(value,['type','id']);if(!types.includes(value.type))fail('Unsupported canonical entity type.');id(value.id);}
 function number(value,label,integer){if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||(integer&&!Number.isSafeInteger(value))))fail(label+' must be null (unknown) or a non-negative '+(integer?'integer.':'number.'));}
 function emptyVerification(){return {schemaVersion:1,decision:'unverified',verified_patch_id:null,last_verified_at:null,last_verified_by:null,history:[]};}
 function listing(value){
  keys(value,fields);if(fields.some(k=>!Object.hasOwn(value,k)))fail('Missing listing field. Use null for unknown values.');
  id(value.id);id(value.vendorId);reference(value.entity);
  number(value.rank,'Rank',true);number(value.price,'Price',false);number(value.quantity,'Quantity',true);number(value.displayOrder,'Display order',true);
  if(value.notes!==null&&(typeof value.notes!=='string'||value.notes.length>4000))fail('Notes must be null or text up to 4000 characters.');
  if(typeof value.archived!=='boolean')fail('Archived must be a boolean.');Verification.validate(value.verification);
 }
 function validate(state){
  keys(state,['schemaVersion','listings']);if(state.schemaVersion!==1||!Array.isArray(state.listings))fail('Invalid listing collection.');
  const ids=new Set(),relationships=new Set();
  for(const row of state.listings){
   listing(row);const key=JSON.stringify([row.vendorId,row.entity.type,row.entity.id]);
   if(ids.has(row.id))fail('Duplicate listing ID.');if(relationships.has(key))fail('Vendor already has this canonical entity; restore or edit its listing.');
   ids.add(row.id);relationships.add(key);
  }
  return structuredClone(state);
 }
 function registry({vendors,entities}){
  if(!Array.isArray(vendors)||!object(entities)||Object.keys(entities).some(t=>!types.includes(t)))fail('Supply explicit vendor and typed entity registries.');
  function index(records){
   if(!Array.isArray(records))fail('Registry must contain records.');const result=new Map();
   for(const record of records){if(!object(record))fail('Invalid registry record.');id(record.id);if(result.has(record.id))fail('Duplicate canonical registry ID.');result.set(record.id,structuredClone(record));}return result;
  }
  const vendorIndex=index(vendors),entityIndexes=new Map(Object.entries(entities).map(([type,records])=>[type,index(records)]));
  return Object.freeze({
   vendor:vendorId=>structuredClone(vendorIndex.get(vendorId)||null),
   entity:ref=>{reference(ref);return structuredClone(entityIndexes.get(ref.type)?.get(ref.id)||null);}
  });
 }
 function resolve(row,catalog){
  listing(row);const vendor=catalog.vendor(row.vendorId),entity=catalog.entity(row.entity);
  return {vendor,entity,issues:[...(!vendor?['missing-vendor']:vendor.archived?['archived-vendor']:[]),...(!entity?['missing-entity']:entity.archived?['archived-entity']:[])]};
 }
 function available(row,catalog){const result=resolve(row,catalog);if(result.issues.length)fail('Cannot link listing: '+result.issues.join(', '));}
 function add(state,input,catalog){
  keys(input,['id','vendorId','entity',...editable]);
  const next=validate(state),row={rank:null,price:null,quantity:null,notes:null,displayOrder:null,...structuredClone(input),archived:false,verification:emptyVerification()};
  listing(row);available(row,catalog);next.listings.push(row);return validate(next);
 }
 function find(state,listingId){id(listingId);const row=state.listings.find(r=>r.id===listingId);if(!row)fail('Listing not found.');return row;}
 function update(state,listingId,patch,catalog,reviewContext){
  keys(patch,editable);const next=validate(state),row=find(next,listingId);
  if(row.archived)fail('Restore the listing before editing.');available(row,catalog);
  const changed=Object.keys(patch).some(k=>k!=='displayOrder'&&patch[k]!==row[k]);
  Object.assign(row,structuredClone(patch));listing(row);
  // Commercial edits invalidate the listing attestation, not the canonical record.
  // The trusted caller supplies authenticated actor identity, never raw request data.
  if(changed&&row.verification.decision==='verified'){
   if(!reviewContext)fail('Authenticated review context is required to invalidate verification.');
   row.verification=Verification.decide(row,'unverified',reviewContext.settings,reviewContext.actorId,reviewContext.clock).verification;
  }
  return validate(next);
 }
 function archive(state,listingId){const next=validate(state);find(next,listingId).archived=true;return next;}
 function restore(state,listingId,catalog){const next=validate(state),row=find(next,listingId);available(row,catalog);row.archived=false;return next;}
 function remove(state,listingId){const next=validate(state);find(next,listingId);next.listings=next.listings.filter(r=>r.id!==listingId);return next;}
 // Trusted integration must check authorization and explicit review intent first.
 function decide(state,listingId,decision,catalog,{settings,actorId,clock}={}){
  const next=validate(state),row=find(next,listingId);if(row.archived)fail('Restore the listing before reviewing.');available(row,catalog);
  row.verification=Verification.decide(row,decision,settings,actorId,clock).verification;return validate(next);
 }
 function forVendor(state,vendorId,{includeArchived=false}={}){
  id(vendorId);return validate(state).listings.filter(r=>r.vendorId===vendorId&&(includeArchived||!r.archived)).sort((a,b)=>{
   if(a.displayOrder===b.displayOrder)return a.id<b.id?-1:a.id>b.id?1:0;
   if(a.displayOrder===null)return 1;if(b.displayOrder===null)return -1;return a.displayOrder-b.displayOrder;
  });
 }
 return Object.freeze({types,empty:()=>({schemaVersion:1,listings:[]}),validate,registry,resolve,add,update,archive,restore,remove,decide,forVendor});
});
