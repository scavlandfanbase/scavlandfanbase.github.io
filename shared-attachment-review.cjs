// Read-only review foundation. Never infer membership from names or evidence.
const Attachments=require('./attachment-model.js');
function create({items,listings=[]}){
 if(!Array.isArray(items)||!Array.isArray(listings))throw Error('Supply Items and canonical listings.');
 const records=new Map();
 for(const row of items){
  if(!row||typeof row.id!=='string'||!row.id.trim()||records.has(row.id))throw Error('Invalid or duplicate Item identity.');
  records.set(row.id,structuredClone(row));
 }
 const stock=structuredClone(listings),seen=new Set();
 for(const row of stock){
  if(!row||typeof row.id!=='string'||!row.id.trim()||seen.has(row.id))throw Error('Invalid or duplicate listing identity.');
  seen.add(row.id);
 }
 function inspect(id){
  const item=records.get(id);if(!item)return null;
  const explicit=item.contentType==='Attachment'||item.classification?.includes('attachment')===true;
  const candidate=Attachments.candidate(item),issues=[];
  try{Attachments.validate(item);}catch(error){issues.push(error.message);}
  const description=Attachments.describe(item);
  if(explicit&&description.conflict)issues.push(description.message);
  return {id,item:structuredClone(item),explicit,candidate,
   state:explicit?(issues.length?'classification-review':'attachment'):candidate?'candidate-review':'outside-category',
   issues,stockedBy:structuredClone(stock.filter(row=>row.entity?.type==='item'&&row.entity.id===id&&!row.archived))};
 }
 function queue({includeInactive=false}={}){
  return [...records.values()].filter(item=>includeInactive||!item.hidden&&!item.archived)
   .map(item=>inspect(item.id)).filter(item=>item.explicit||item.candidate);
 }
 function report(){
  const all=queue({includeInactive:true});
  return {explicit:all.filter(r=>r.explicit).length,candidates:all.filter(r=>r.candidate&&!r.explicit).length,
   classificationReview:all.filter(r=>r.state==='classification-review').length,
   unlinkedListings:stock.filter(r=>r.entity?.type==='item'&&!records.has(r.entity.id)).map(r=>r.id)};
 }
 return Object.freeze({inspect,queue,report});
}
module.exports=Object.freeze({create});
