// Trusted master-only classification preparation; not registered as a live API.
import {Attachments,Verification} from './models.generated.mjs';
import {fail} from './core.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function authorize(context){
 if(typeof context.actor!=='string'||!context.actor.trim())fail('Authenticated identity is required.',401);
 if(!context.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
}
export function prepareAttachmentClassification(record,command,context={}){
 authorize(context);
 if(!object(record)||typeof record.id!=='string'||!record.id.trim())fail('Select an existing Item identity.');
 if(record.archived)fail('Restore the item before classifying it.');
 if(!object(command)||Object.keys(command).some(k=>!['action','confirmId','attachmentType','confirmReclassification'].includes(k)))fail('Unsupported classification fields.');
 if(command.action!=='classify-attachment'||command.confirmId!==record.id)fail('Confirm the existing Item identity.');
 if(!Attachments.types.includes(command.attachmentType))fail('Choose an Attachment Type, including Unknown.');
 if(record.classification!==undefined&&(!Array.isArray(record.classification)||record.classification.some(tag=>typeof tag!=='string')))fail('Review the malformed Item classification.');
 const previous=Attachments.describe(record);
 const competing=(record.classification||[]).some(tag=>['weapon','armour','ammunition','ammo','blueprint'].includes(tag))||['Weapon','Armour','Ammo','Blueprint'].includes(previous.recorded);
 if(competing)fail('This item belongs to another category. Review its linked records before reclassifying.',409);
 if(command.confirmReclassification!==true)fail('Explicit classification confirmation is required.');
 const result=structuredClone(record);
 result.contentType='Attachment';result.attachmentType=command.attachmentType;
 result.classification=[...new Set([...(record.classification||[]).filter(tag=>tag!=='item'),'attachment'])];
 Attachments.validate(result);
 if(JSON.stringify(result)!==JSON.stringify(record))result.verification=Verification.decide(record,'unverified',context.settings,context.actor,(context.clock||(()=>new Date()))).verification;
 return {itemId:record.id,before:structuredClone(record),record:result,
  changedFields:['contentType','attachmentType','classification','verification'].filter(key=>JSON.stringify(record[key])!==JSON.stringify(result[key]))};
}

