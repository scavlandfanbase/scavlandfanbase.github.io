// Private Items foundation. The existing registry remains the sole seed source.
// Never derive identity/category/facts from names or merge specialist/vendor records.
const Verification=require('./verification.js'),Attachments=require('./attachment-model.js');
const categories=Object.freeze(['Food & Drink','Medical','Repair & Maintenance','Crafting Materials','Tools','Other']);
const factFields=Object.freeze(['notes','rank','estimatedPrice','maxStack','stackable','effects']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function validate(state){
 if(!object(state)||state.foundationVersion!==1||!Array.isArray(state.data))throw new Error('Unsupported Items catalogue.');
 const ids=new Set();
 for(const r of state.data){
  if(!object(r)||typeof r.id!=='string'||!r.id.trim()||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim())throw new Error('Invalid or duplicate item identity.');
  ids.add(r.id);Attachments.validate(r);
  for(const key of ['category','description','image'])if(r[key]!==null&&typeof r[key]!=='string')throw new Error('Invalid item '+key+'.');
  if(r.properties!==null&&!object(r.properties)&&!Array.isArray(r.properties))throw new Error('Invalid item properties.');
  for(const key of ['hidden','archived'])if(typeof r[key]!=='boolean')throw new Error('Invalid item '+key+'.');
  for(const key of ['createdAt','updatedAt'])if(r[key]!==null&&(typeof r[key]!=='string'||!Number.isFinite(Date.parse(r[key]))))throw new Error('Invalid item timestamp.');
  if(r.verification!==null)Verification.validate(r.verification);
 }
 return state;
}
function foundation(source){
 if(!object(source)||source.schemaVersion!==1||!Array.isArray(source.data))throw new Error('Unsupported Items registry.');
 const state=structuredClone(source);
 state.foundationVersion=1;
 state.data=state.data.map(record=>({category:null,description:null,properties:null,image:null,evidence:null,verification:null,hidden:false,archived:false,createdAt:null,updatedAt:null,...record}));
 return validate(state);
}
const crypto=require('node:crypto'),Pages=require('./page-model.js');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function mutate(input,body,{images=[],settings,actorId='local-operator'}={}){
 validate(input);
 if(!body||body.revision!==(input.revision??0))fail('Items changed in another window. Your entries are still on screen. Copy any text you need, then reload saved items.',409);
 const state=structuredClone(input),r=state.data.find(r=>r.id===body.id),now=new Date().toISOString();
 if(body.action!=='add'&&!r)fail('Select an existing item.');
 if(r?.archived&&body.action!=='restore')fail('Restore this archived item before editing it.');
 let selectedId=r?.id;
 const string=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Enter a valid '+(required?'name':'value')+' (maximum '+max+' characters).');return v;};
 const optional=(v,max)=>v===null?null:string(v,max);
 function details(d){
  if(!object(d))fail('Enter item details.');
  const name=string(d.name,300,true),category=optional(d.category,300),description=optional(d.description,10000);
  if(category!==null&&category!==r?.category&&!category.trim())fail('Enter a category name or choose Not recorded.');
  if(d.properties!==null&&!object(d.properties)&&!Array.isArray(d.properties))fail('Enter valid item properties.');
  if(JSON.stringify(d.properties)?.length>100000||d.properties===undefined)fail('Too many properties.');
  return {name,category,description,properties:structuredClone(d.properties)};
 }
 function resetVerification(record){
  // An edited fact is not covered by a previous review; keep all dated history.
  if(Verification.inspect(record,settings).status!=='unverified'||record.verification?.decision==='verified')record.verification=Verification.decide(record,'unverified',settings,actorId).verification;
 }
 switch(body.action){
  case 'classify':{
   if(!['Item','Attachment'].includes(body.contentType))fail('Choose Item or Attachment.');
   if(body.contentType==='Attachment'&&!Attachments.types.includes(body.attachmentType))fail('Choose an Attachment Type, including Unknown.');
   // Always confirm reversal, including unknown future relationships. Never delete source fields.
   if(Attachments.contentType(r)==='Attachment'&&body.contentType==='Item'&&body.confirmId!==r.id)fail('Confirm changing this Attachment back to Item. All recorded information will be retained.');
   r.contentType=body.contentType;
   if(body.contentType==='Attachment')r.attachmentType=body.attachmentType;
   break;
  }
  case 'add':{
   const record={id:crypto.randomUUID(),...details(body.details),image:null,evidence:null,verification:null,hidden:false,archived:false,createdAt:now,updatedAt:now};
   state.data.push(record);selectedId=record.id;break;
  }
  case 'edit':{
   const next=details(body.details);
   if(body.details.facts!==undefined){
    if(!object(body.details.facts)||Object.keys(body.details.facts).some(key=>!factFields.includes(key)||!Object.hasOwn(r,key)))fail('Choose an existing recorded fact.');
    if(JSON.stringify(body.details.facts).length>100000)fail('Too many recorded facts.');
    Object.assign(next,structuredClone(body.details.facts));
   }
   if(JSON.stringify(next)!==JSON.stringify(Object.fromEntries(Object.keys(next).map(k=>[k,r[k]])))){Object.assign(r,next);resetVerification(r);}break;
  }
  case 'duplicate':{
   const verification={schemaVersion:1,decision:'unverified',verified_patch_id:null,last_verified_at:null,last_verified_by:null,history:[]};
   const copy={...structuredClone(r),id:crypto.randomUUID(),name:r.name.slice(0,295)+' Copy',hidden:true,archived:false,verification,createdAt:now,updatedAt:now};
   // Provenance remains a reference, never a copied attestation/history for the new identity.
   state.data.push(copy);selectedId=copy.id;break;
  }
  case 'image':
   if(body.image!==null&&body.image!==r.image&&(!Pages.image(body.image)||!images.includes(body.image)))fail('Choose an image from the existing library.');
   if(body.image!==r.image){r.image=body.image;resetVerification(r);}break;
  case 'visibility':r.hidden=!r.hidden;break;
  case 'archive':if(body.confirmId!==r.id)fail('Confirm the item to archive.');r.archived=true;break;
  case 'restore':r.archived=false;break;
  case 'verify':
   if(body.confirmId!==r.id)fail('Confirm the item you reviewed.');
   if(body.patchId!==Verification.patchId(settings))fail('The current patch changed. Reload saved items before reviewing.',409);
   r.verification=Verification.decide(r,body.decision,settings,actorId).verification;break;
  default:fail('Unknown item action.');
 }
 if(r&&body.action!=='duplicate')r.updatedAt=now;
 state.revision=(input.revision??0)+1;
 return {state:validate(state),selectedId};
}
module.exports=Object.freeze({categories,factFields,foundation,validate,mutate});
