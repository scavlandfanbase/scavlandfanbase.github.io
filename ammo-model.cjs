// Private Ammo foundation. The existing registry remains the sole seed source.
// Never derive identity/category/facts from names or merge specialist/vendor records.
const Verification=require('./verification.js');
const categories=Object.freeze(['Pistol','Shotgun','Rifle','High Caliber Rifle','Special']);
const factFields=Object.freeze(['damage','penetrationPercent','maxStack','notes','rank','estimatedPrice']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function validate(state){
 if(!object(state)||state.foundationVersion!==1||!Array.isArray(state.data))throw new Error('Unsupported Ammo catalogue.');
 const ids=new Set();
 for(const r of state.data){
  if(!object(r)||typeof r.id!=='string'||!r.id.trim()||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim())throw new Error('Invalid or duplicate ammo identity.');
  ids.add(r.id);
  for(const key of ['category','description','image'])if(r[key]!==null&&typeof r[key]!=='string')throw new Error('Invalid ammo '+key+'.');
  for(const key of ['hidden','archived'])if(typeof r[key]!=='boolean')throw new Error('Invalid ammo '+key+'.');
  for(const key of ['createdAt','updatedAt'])if(r[key]!==null&&(typeof r[key]!=='string'||!Number.isFinite(Date.parse(r[key]))))throw new Error('Invalid ammo timestamp.');
  if(r.verification!==null)Verification.validate(r.verification);
 }
 return state;
}
function foundation(source){
 if(!object(source)||source.schemaVersion!==1||!Array.isArray(source.data))throw new Error('Unsupported Ammo registry.');
 const state=structuredClone(source);
 state.foundationVersion=1;
 state.data=state.data.map(record=>({category:null,description:null,image:null,evidence:null,verification:null,hidden:false,archived:false,createdAt:null,updatedAt:null,...record}));
 return validate(state);
}
const crypto=require('node:crypto'),Pages=require('./page-model.js');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function mutate(input,body,{images=[],settings,actorId="local-operator"}={}){
 validate(input);
 if(!body||body.revision!==(input.revision??0))fail('Ammo changed in another window. Your entries are still on screen. Copy any text you need, then reload saved ammo.',409);
 const state=structuredClone(input),r=body.action==='add'?undefined:state.data.find(r=>r.id===body.id),now=new Date().toISOString();
 if(body.action!=='add'&&!r)fail('Select an existing ammo.');
 if(r?.archived&&body.action!=='restore')fail('Restore this archived ammo before editing it.');
 let selectedId=r?.id;
 const string=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Enter a valid '+(required?'name':'value')+' (maximum '+max+' characters).');return v;};
 const optional=(v,max)=>v===null?null:string(v,max);
 function details(d){
  if(!object(d))fail('Enter ammo details.');
  const name=string(d.name,300,true),category=optional(d.category,300),description=optional(d.description,10000);
  if(category!==null&&category!==r?.category&&!category.trim())fail('Enter a category name or choose Not recorded.');
  const facts=d.facts??{};
  if(!object(facts)||Object.keys(facts).some(key=>!factFields.includes(key)))fail('Choose a supported recorded fact.');
  if(JSON.stringify(facts).length>100000)fail('Too many recorded facts.');
  function finite(value){if(typeof value==='number'&&!Number.isFinite(value))fail('Enter a finite number.');if(value&&typeof value==='object')Object.values(value).forEach(finite);}
  finite(facts);
  return {name,category,description,...structuredClone(facts)};
 }
 function resetVerification(record){
  // An edited fact is not covered by a previous review; keep all dated history.
  if(Verification.inspect(record,settings).status!=='unverified'||record.verification?.decision==='verified')record.verification=Verification.decide(record,'unverified',settings,actorId).verification;
 }
 switch(body.action){
  case 'add':{
   const record={id:crypto.randomUUID(),...details(body.details),image:null,evidence:null,verification:null,hidden:false,archived:false,createdAt:now,updatedAt:now};
   state.data.push(record);selectedId=record.id;break;
  }
  case 'edit':{
   const next=details(body.details);
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
  case 'archive':if(body.confirmId!==r.id)fail('Confirm the ammo to archive.');r.archived=true;break;
  case 'restore':r.archived=false;break;
  case 'verify':
   if(body.confirmId!==r.id)fail('Confirm the ammo you reviewed.');
   if(body.patchId!==Verification.patchId(settings))fail('The current patch changed. Reload saved ammo before reviewing.',409);
   r.verification=Verification.decide(r,body.decision,settings,actorId).verification;break;
  default:fail('Unknown ammo action.');
 }
 if(r&&body.action!=='duplicate')r.updatedAt=now;
 state.revision=(input.revision??0)+1;
 return {state:validate(state),selectedId};
}
module.exports=Object.freeze({categories,factFields,foundation,validate,mutate});
