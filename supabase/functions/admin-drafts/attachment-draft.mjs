// Trusted master-only classification preparation; not registered as a live API.
import {Attachments,Verification} from './models.generated.mjs';
import {fail} from './core.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function authorize(context){
 if(typeof context.actor!=='string'||!context.actor.trim())fail('Authenticated identity is required.',401);
 if(!context.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
}

// Context is loaded by the trusted service, never supplied in a browser payload.
// The eventual receipt store must recheck these bindings within its save transaction.
export async function prepareAttachmentDecision(command,context={}){
 authorize(context);
 const allowed=['action','confirmId','attachmentType','confirmReclassification','expectedVersion','sourceDigest'];
 if(!object(command)||Object.keys(command).some(key=>!allowed.includes(key)))fail('Unsupported Attachment preparation fields.');
 if(!Number.isSafeInteger(context.version)||context.version<0||command.expectedVersion!==context.version)fail('The saved draft changed. Reload before classifying.',409);
 const source=context.source;
 if(!object(source)||command.confirmId!==source.id)fail('Confirm the current Item identity.');
 if(context.savedDraft)fail('This item already has private shared work. Review it before classifying.',409);
 if(!Array.isArray(context.legacyDrafts))fail('Load existing Items work before classifying.',503);
 const blockers=legacyItemBlockers(source.id,source,context.legacyDrafts);
 if(blockers.length)fail('This item has pending work in the existing Items draft. Preserve it before classifying.',409);
 if(!object(context.settings))fail('Load the current patch before classifying.',503);
 const sourceDigest=await legacyDigest({source,settings:context.settings});
 if(command.sourceDigest!==sourceDigest)fail('Item facts or the patch changed. Reload before classifying.',409);
 const {expectedVersion,sourceDigest:ignored,...decision}=command;
 const prepared=prepareAttachmentClassification(source,decision,context);
 return {...prepared,expectedVersion,sourceDigest,actor:context.actor,
  legacyDigest:await legacyDigest(context.legacyDrafts),category:'attachments'};
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

