(function(root){
 function review(vendor,items,listings=[]){
  return (vendor.inventory||[]).map((entry,index)=>{
   const byId=typeof entry.itemId==='string'?items.filter(r=>r.id===entry.itemId):[];
   const byName=typeof entry.name==='string'?items.filter(r=>r.name===entry.name):[];
   const candidates=byId.length?byId:byName;
   const exact=byId.length===1&&(!entry.name||byId[0].name===entry.name)&&!byId[0].archived;
   const existing=exact?listings.find(r=>r.vendorId===vendor.id&&r.entity.type==='item'&&r.entity.id===byId[0].id):null;
   return {index,entry:structuredClone(entry),candidates:candidates.map(r=>({id:r.id,name:r.name})),status:existing?'already-linked':exact?'exact-proposal':candidates.length?'review':'unmatched',reason:existing?'Already linked; compare saved values before any migration.':exact?'Exact existing Item reference and matching name. Proposal only.':byId.length?'Reference and name disagree, or the target is archived.':byName.length?'Name-only match: confirm the intended Item.':'No exact existing Item found. Human review required.'};
  });
 }
 const api=Object.freeze({review});if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavLegacyReview=api;
})(globalThis);
