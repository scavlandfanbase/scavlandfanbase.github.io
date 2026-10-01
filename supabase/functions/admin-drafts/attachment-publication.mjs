// Selected master-only preview planner. No live publish route in this checkpoint.
import {publicValue,same,fail} from './core.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
const fields=['name','description','notes','image','estimatedPrice','maxStack','contentType','attachmentType','classification','verification'];
const own=(record,key)=>({present:Object.hasOwn(record,key),...(Object.hasOwn(record,key)?{value:record[key]}:{})});
const published=(record,key)=>({present:Object.hasOwn(record,key),...(Object.hasOwn(record,key)?{value:key==='verification'?publicValue({verification:record[key]}).verification:publicValue(record[key])}:{})});
export async function planAttachmentPublication(saved,documents,{settings,legacyDrafts,permissions=[]}={}){
 if(!permissions.includes('items_edit'))fail('Items editing permission is required.',403);
 if(!saved||saved.category!=='attachments'||saved.itemId!==saved.before?.id||saved.itemId!==saved.record?.id||saved.record.contentType!=='Attachment')fail('Load the saved Attachment before previewing.');
 if(!Array.isArray(legacyDrafts)||!settings)fail('Load current patch and existing Items work.',503);
 if(await legacyDigest({source:saved.before,settings})!==saved.sourceDigest)fail('The patch changed. Review the draft before publishing.',409);
 const source=documents['data/items.json'];
 if(!Array.isArray(source?.data)||source.data.filter(r=>r.id===saved.itemId).length!==1)fail('Item identity changed. Reload before publishing.',409);
 const current=source.data.find(r=>r.id===saved.itemId);
 if(legacyItemBlockers(saved.itemId,current,legacyDrafts).length)fail('Existing Items work must be preserved before publishing.',409);
 for(const kind of ['ammo','armour','weapons'])if(documents['data/'+kind+'.json']?.data.some(r=>r.id===saved.itemId))fail('This item has specialist links. Review before reclassifying.',409);
 const allKeys=new Set([...Object.keys(saved.before),...Object.keys(saved.record)]);
 const changed=[...allKeys].filter(key=>!same(own(saved.before,key),own(saved.record,key)));
 if(changed.some(key=>!fields.includes(key)))fail('Protected Attachment facts changed. Review the saved draft.');
 if(!same(own(current,'archived'),own(saved.before,'archived'))||!same(own(current,'hidden'),own(saved.before,'hidden')))fail('Item visibility changed. Reload before publishing.',409);
 const output=structuredClone(source),target=output.data.find(r=>r.id===saved.itemId),conflicts=[];
 for(const key of changed){
  const before=published(saved.before,key),after=published(saved.record,key),now=published(current,key);
  if(!same(now,before)&&!same(now,after)){conflicts.push(key);continue;}
  if(after.present)target[key]=key==='verification'?publicValue({verification:saved.record.verification}).verification:publicValue(saved.record[key]);else delete target[key];
 }
 if(conflicts.length)throw Object.assign(Error('Public changes conflict with the Attachment draft. Nothing was published.'),{status:409,conflicts});
 return {'data/items.json':output};
}
