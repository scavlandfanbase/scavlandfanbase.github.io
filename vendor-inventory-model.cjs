// Private integration of the 8A model. No legacy inventory conversion or canonical writes.
const crypto=require('node:crypto'),L=require('./vendor-listings.js');
function mutate(state,body,entities,settings,actorId='local-operator'){
 const fail=message=>{throw new Error(message);};
 if(body.revision!==state.revision)fail('Vendors changed in another window. Your entries are still on screen. Copy any text you need, then reload saved vendors.');
 const vendor=state.data.find(v=>v.id===body.id);
 if(!vendor||vendor.archived)fail('Select an active vendor.');
 const catalog=L.registry({vendors:state.data,entities});
 let collection=L.validate(state.vendorListings||L.empty());
 const row=collection.listings.find(r=>r.id===body.listingId);
 if(body.operation!=='add'&&(!row||row.vendorId!==vendor.id))fail('Select a listing belonging to this vendor.');
 // Identity is the authenticated loopback session's local operator, never a client field.
 const review={settings,actorId};
 switch(body.operation){
  case 'add': collection=L.add(collection,{id:crypto.randomUUID(),vendorId:vendor.id,entity:body.entity},catalog);break;
  case 'edit': collection=L.update(collection,row.id,body.fields,catalog,review);break;
  case 'verify':
   if(Object.keys(body).some(key=>!['action','operation','id','revision','listingId','confirmId','decision','patchId','requestId'].includes(key)))fail('Verification identity, time and history are recorded by the server.');
   if(body.confirmId!==row.id)fail('Confirm the exact listing to review.');
   if(body.patchId!==settings.current_patch_id)fail('The current patch changed. Reopen the inventory and review again.');
   collection=L.decide(collection,row.id,body.decision,catalog,review);break;
  case 'archive': collection=L.archive(collection,row.id);break;
  case 'restore': collection=L.restore(collection,row.id,catalog);break;
  case 'remove':
   if(body.confirmId!==row.id)fail('Confirm the listing to remove.');
   collection=L.remove(collection,row.id);break;
  case 'move':{
   if(row.archived||![-1,1].includes(body.direction))fail('Choose an active listing and valid direction.');
   const order=L.forVendor(collection,vendor.id),index=order.findIndex(r=>r.id===row.id),next=index+body.direction;
   if(next<0||next>=order.length)fail('Listing is already at the end of the list.');
   [order[index],order[next]]=[order[next],order[index]];
   // Only explicit reordering assigns known display positions; commercial fields are untouched.
   order.forEach((r,i)=>{collection.listings.find(v=>v.id===r.id).displayOrder=i;});
   collection=L.validate(collection);break;
  }
  default:fail('Unknown inventory action.');
 }
 return {state:{...state,revision:state.revision+1,vendorListings:collection},selectedId:vendor.id};
}
module.exports={mutate};
