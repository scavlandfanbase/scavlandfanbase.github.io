// Creation contract only. API/storage/publication integration is a separate checkpoint.
import {fail} from './core.mjs';
import {prepareAttachmentEdit} from './attachment-draft.mjs';
import {Verification} from './models.generated.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
export async function prepareAttachmentCreation(command,context={}){
 if(typeof context.actor!=='string'||!context.actor.trim())fail('Authenticated identity is required.',401);
 if(!context.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
 if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(k=>!['action','fields','confirmCreation'].includes(k))||command.action!=='create-attachment'||command.confirmCreation!==true)fail('Explicit new Attachment confirmation is required.');
 const id=context.newItemId;
 if(typeof id!=='string'||!/^attachment-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('A server-assigned Attachment identity is required.',503);
 if(!context.documents||!Array.isArray(context.legacyDrafts)||!context.settings)fail('Load current catalogues, private work and patch before creating.',503);
 for(const path of ['data/items.json','data/weapons.json','data/armour.json','data/ammo.json']){
  const records=context.documents[path]?.data;if(!Array.isArray(records))fail('Load all canonical identity catalogues.',503);
  if(records.some(record=>record.id===id))fail('The new identity is already recorded.',409);
 }
 for(const draft of context.legacyDrafts){const records=draft?.payload?.catalogue?.data;if(!Array.isArray(records))fail('Review the existing Items work before creating.',503);if(records.some(r=>r.id===id))fail('The new identity has existing private work.',409);}
 if(!Array.isArray(context.privateItemIds))fail('Inspect saved shared identities before creating.',503);
 if(context.privateItemIds.includes(id))fail('The new identity has saved shared work.',409);
 if(typeof command.fields?.name!=='string'||!command.fields.name.trim())fail('Enter an Attachment name.');
 const record={id,name:command.fields.name,contentType:'Attachment',attachmentType:'Unknown',classification:['attachment'],description:null,notes:null,image:null,estimatedPrice:null,maxStack:null,compatibleWeaponIds:null};
 const saved={itemId:id,category:'attachments',before:null,record};
 const result=prepareAttachmentEdit({action:'edit-attachment',confirmId:id,expectedVersion:1,fields:command.fields},{...context,version:1,savedDraft:saved,weapons:context.documents['data/weapons.json'].data});
 result.record.verification=Verification.decide(result.record,'unverified',context.settings,context.actor,context.clock||(()=>new Date())).verification;
 return {...result,before:null,creation:true,expectedVersion:0,sourceDigest:await legacyDigest({source:null,settings:context.settings}),legacyDigest:await legacyDigest(context.legacyDrafts)};
}
