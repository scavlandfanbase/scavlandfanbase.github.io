// Operations on private vendor drafts. Unknown existing fields and inventories are preserved.
const crypto=require('node:crypto'),Pages=require('./page-model.js');
const fail=message=>{throw new Error(message);};
function validate(state){
 if(state?.version!==1||!Number.isInteger(state.revision)||state.revision<0||!Array.isArray(state.data))fail('Saved vendor format is invalid. The file has been preserved.');
 const ids=new Set();
 for(const v of state.data){if(!v||typeof v.id!=='string'||!v.id||ids.has(v.id)||typeof v.name!=='string')fail('Invalid or duplicate vendor identity.');ids.add(v.id);}
 return state;
}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('Enter a valid '+(required?'name':'value')+' (maximum '+max+' characters).');return value.trim();}
function mutate(state,body,{factions,images}){
 validate(state);
 if(body?.revision!==state.revision)fail('Vendors changed in another window. Your entries are still on screen. Copy any text you need, then reload saved vendors.');
 const v=state.data.find(v=>v.id===body.id);
 if(body.action!=='add'&&!v)fail('Select an existing vendor.');
 if(v?.archived&&body.action!=='restore')fail('Restore this archived vendor before editing it.');
 let selectedId=v?.id;
 function details(input){
  const name=text(input?.name,160,true),location=text(input?.location,300),factionId=text(input?.factionId,80);
  if(factionId&&!factions.includes(factionId)&&factionId!==v?.factionId)fail('Choose an existing faction.');
  return {name,location,factionId};
 }
 switch(body.action){
  case 'edit':Object.assign(v,details(body.details));break;
  case 'add':{
   if(state.data.length>=500)fail('This editor supports up to 500 vendors.');
   const record={id:crypto.randomUUID(),...details(body.details),inventory:[],inventoryDocumented:false,source:{status:'pending-review'},hidden:false,archived:false};state.data.push(record);selectedId=record.id;break;
  }
  case 'duplicate':{
   if(state.data.length>=500)fail('This editor supports up to 500 vendors.');
   const record={id:crypto.randomUUID(),name:(v.name.slice(0,155)+' Copy'),location:v.location||'',factionId:v.factionId||'',inventory:[],inventoryDocumented:false,source:{status:'pending-review'},hidden:true,archived:false};
   if(v.portrait)record.portrait=structuredClone(v.portrait);
   state.data.splice(state.data.indexOf(v)+1,0,record);selectedId=record.id;break;
  }
  case 'image':
   if(body.image!==null&&typeof body.image!=='string')fail('Choose an image or remove the current image.');
   if(body.image!==v.portrait?.file&&body.image!==null&&(!Pages.image(body.image)||!images.includes(body.image)))fail('Choose an image from the existing library.');
   if(body.image!==v.portrait?.file){if(body.image===null)delete v.portrait;else v.portrait={file:body.image};}break;
  case 'move':{
   if(![-1,1].includes(body.direction))fail('Invalid move.');
   const active=state.data.filter(r=>!r.archived),i=active.indexOf(v),other=active[i+body.direction];
   if(!other)fail('Vendor is already at the end of the list.');
   const a=state.data.indexOf(v),b=state.data.indexOf(other);[state.data[a],state.data[b]]=[state.data[b],state.data[a]];break;
  }
  case 'visibility':v.hidden=!v.hidden;break;
  case 'archive':if(body.confirmId!==v.id)fail('Confirm the vendor to archive.');v.archived=true;break;
  case 'restore':v.archived=false;break;
  default:fail('Unknown vendor action.');
 }
 state.revision++;validate(state);return {state,selectedId};
}
module.exports={validate,mutate};
