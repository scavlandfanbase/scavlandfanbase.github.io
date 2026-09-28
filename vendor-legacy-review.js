(function(root){
 function review(vendor,items,listings=[]){
  const A=typeof module==='object'&&module.exports?require('./attachment-model.js'):root.ScavAttachments;
  return (vendor.inventory||[]).map((entry,index)=>{
   const byId=typeof entry.itemId==='string'?items.filter(r=>r.id===entry.itemId):[];
   const byName=typeof entry.name==='string'?items.filter(r=>r.name===entry.name):[];
   const candidates=byId.length?byId:byName;
   const exact=byId.length===1&&(typeof entry.name==='string'&&byId[0].name===entry.name)&&!byId[0].archived;
   const conflict=exact&&A.describe(byId[0]).conflict;
   const existing=exact?listings.find(r=>r.vendorId===vendor.id&&r.entity.type==='item'&&r.entity.id===byId[0].id):null;
   return {index,entry:structuredClone(entry),candidates:candidates.map(r=>({id:r.id,name:r.name})),status:existing?'already-linked':exact&&!conflict?'exact-proposal':candidates.length?'review':'unmatched',reason:existing?'Already linked; compare saved values before any migration.':conflict?'Classification conflict: legacy row remains pending human review. No catalogue move is proposed.':exact?'Exact existing Item reference and matching name. Proposal only.':byId.length?'Reference and name disagree, or the target is archived.':byName.length?'Name-only match: confirm the intended Item.':'No exact existing Item found. Human review required.'};
  });
 }
 const api=Object.freeze({review});if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavLegacyReview=api;
})(globalThis);
