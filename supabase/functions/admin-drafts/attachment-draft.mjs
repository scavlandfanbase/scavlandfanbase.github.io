// Trusted master-only classification preparation; not registered as a live API.
import {validateAttachmentCompatibility} from './attachment-compatibility.mjs';
import {Attachments,Verification} from './models.generated.mjs';
import {fail} from './core.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function authorize(context){
 if(typeof context.actor!=='string'||!context.actor.trim())fail('Authenticated identity is required.',401);
 if(!context.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
}

export function prepareAttachmentAction(command,context={}){
 authorize(context);
 const allowed=['action','confirmId','expectedVersion','decision','patchId'];
 if(!object(command)||Object.keys(command).some(key=>!allowed.includes(key))||!['review-attachment','archive-attachment','restore-attachment'].includes(command.action))fail('Unsupported Attachment action.');
 const saved=context.savedDraft;
 if(!saved||saved.itemId!==command.confirmId||saved.record?.id!==command.confirmId||saved.record.contentType!=='Attachment')fail('Load the saved Attachment identity.');
 if(!Number.isSafeInteger(context.version)||context.version<1||command.expectedVersion!==context.version)fail('The saved draft changed. Reload before reviewing.',409);
 const result=structuredClone(saved);
 if(command.action==='review-attachment'){
  if(saved.record.archived)fail('Restore the item before reviewing.');
  if(!['verified','unverified'].includes(command.decision)||command.patchId!==Verification.patchId(context.settings))fail('Choose a review decision for the current patch.',409);
  if(command.decision==='verified'&&!Verification.patchId(context.settings))fail('Set the current patch before verifying.');
  result.record.verification=Verification.decide(saved.record,command.decision,context.settings,context.actor,context.clock||(()=>new Date()));
  result.record.verification=result.record.verification.verification;
 }else{
  if(command.decision!==undefined||command.patchId!==undefined)fail('Unsupported visibility fields.');
  const archive=command.action==='archive-attachment';
  if(!!saved.record.archived===archive)fail('Item is already in that state.');
  result.record.archived=archive;
 }
 result.actor=context.actor;result.expectedVersion=context.version;return result;
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

export function prepareAttachmentEdit(command,context={}){
 authorize(context);
 const allowed=['action','confirmId','expectedVersion','fields'];
 if(!object(command)||Object.keys(command).some(k=>!allowed.includes(k))||command.action!=='edit-attachment')fail('Unsupported Attachment edit.');
 if(!Number.isSafeInteger(context.version)||context.version<1||command.expectedVersion!==context.version)fail('The saved draft changed. Reload before editing.',409);
 const saved=context.savedDraft;
 if(!object(saved)||saved.category!=='attachments'||saved.itemId!==command.confirmId||saved.record?.id!==saved.itemId||saved.record.contentType!=='Attachment')fail('Load the saved Attachment before editing.');
 if(saved.record.archived)fail('Restore the item before editing.');
 const fields=['name','description','notes','image','estimatedPrice','maxStack','attachmentType','compatibleWeaponIds'];
 if(!object(command.fields)||Object.keys(command.fields).some(k=>!fields.includes(k)))fail('Unsupported Attachment fields.');
 const result=structuredClone(saved),changed=[];
 for(const [key,input]of Object.entries(command.fields)){
  const value=key==='compatibleWeaponIds'?validateAttachmentCompatibility(input,context.weapons):input;
  if(key==='name'&&(typeof value!=='string'||!value.trim()||value.length>300))fail('Enter an item name.');
  if(['description','notes'].includes(key)&&value!==null&&(typeof value!=='string'||value.length>10000))fail('Enter text or an unknown value.');
  if(key==='image'&&value!==null&&(!Array.isArray(context.images)||!context.images.includes(value)))fail('Choose an image from the trusted library.');
  if(['estimatedPrice','maxStack'].includes(key)&&value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||key==='maxStack'&&!Number.isSafeInteger(value)))fail('Enter a valid recorded number or unknown value.');
  if(key==='attachmentType'&&!Attachments.types.includes(value))fail('Choose an Attachment Type, including Unknown.');
  if(JSON.stringify(result.record[key])!==JSON.stringify(value)){result.record[key]=structuredClone(value);changed.push(key);}
 }
 Attachments.validate(result.record);
 if(changed.length)result.record.verification=Verification.decide(saved.record,'unverified',context.settings,context.actor,context.clock||(()=>new Date())).verification;
 result.expectedVersion=context.version;result.actor=context.actor;
 result.changedFields=['contentType','attachmentType','classification','verification',...fields].filter((key,index,array)=>array.indexOf(key)===index&&JSON.stringify(result.before?.[key])!==JSON.stringify(result.record[key]));
 return result;
}

