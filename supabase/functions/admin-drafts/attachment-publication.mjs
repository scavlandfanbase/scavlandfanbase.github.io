// Selected master-only preview planner. No live publish route in this checkpoint.
import {publicValue,same,fail} from './core.mjs';
import {legacyDigest} from './legacy-item-review.mjs';
import {legacyItemBlockers} from './item-draft.mjs';
import {githubPublisher} from './github-publisher.mjs';
const fields=['name','description','notes','image','estimatedPrice','maxStack','contentType','attachmentType','classification','verification'];
const own=(record,key)=>({present:Object.hasOwn(record,key),...(Object.hasOwn(record,key)?{value:record[key]}:{})});
const published=(record,key)=>({present:Object.hasOwn(record,key),...(Object.hasOwn(record,key)?{value:key==='verification'?publicValue({verification:record[key]}).verification:publicValue(record[key])}:{})});
// Reconcile a confirmed public result before the next private edit. Retain review history.
export async function reconcileAttachment(saved,source,settings){
 if(!saved||saved.itemId!==source?.id||saved.before?.id!==source.id||saved.record?.id!==source.id)fail('Item identity changed. Reload before editing.',409);
 if(saved.sourceDigest!==await legacyDigest({source:saved.before,settings}))fail('The patch changed. Review before editing.',409);
 const result=structuredClone(saved),allKeys=new Set([...Object.keys(saved.before),...Object.keys(saved.record),...Object.keys(source)]);
 for(const key of allKeys){
  const before=published(saved.before,key),desired=published(saved.record,key),current=published(source,key);
  if(same(before,desired)){
   if(current.present)result.record[key]=structuredClone(source[key]);else delete result.record[key];
  }else if(!same(current,before)&&!same(current,desired))fail('Public changes conflict with the Attachment draft. Review before editing.',409);
 }
 if(!same(saved.before,source)){
  result.baselineHistory=[...(saved.baselineHistory||[]),structuredClone(saved.before)];
  result.before=structuredClone(source);result.sourceDigest=await legacyDigest({source,settings});
 }
 return result;
}
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

// All callbacks and credentials are trusted service dependencies. No browser paths.
export function createAttachmentPublisher({saved,version,base,token,fetcher,readCurrent,readIntent,previewId,actor}={}){
 if(!Number.isSafeInteger(version)||version<1||typeof readCurrent!=='function'||typeof actor!=='string'||!actor)fail('Load a saved Attachment version before publishing.');
 const draft={domain:'shared-attachment',entity_id:saved?.itemId,version,payload:structuredClone(saved),base:{'data/items.json':base}};
 async function current(){
  const context=await readCurrent();
  if(context.version!==version||!same(context.savedDraft,saved))fail('The Attachment draft changed. Preview again.',409);
  if(context.actor!==actor||!context.permissions?.includes('items_edit'))fail('Items editing permission is required.',403);
  return context;
 }
 const adapter=githubPublisher({repository:'scavlandfanbase/scavlandfanbase.github.io',token,fetcher,paths:['data/items.json'],allowUnrelatedChanges:true,
  validate:async()=>{await current();},
  project:async(_draft,documents)=>{
   const context=await current();
   return planAttachmentPublication(saved,{...context.documents,...documents},context);
  },
  beforePublish:async plan=>{
   const context=await current();
   await planAttachmentPublication(saved,context.documents,context);
   if(typeof readIntent!=='function'||!previewId)fail('Review a saved preview before publishing.',409);
   const intent=await readIntent({actor,itemId:saved.itemId,version,previewId});
   const files=plan.tree.map(({path,content})=>({path,content}));
   if(!intent||intent.digest!==await legacyDigest(files))fail('The preview changed or expired. Preview again.',409);
  }
 });
 return {preview:()=>adapter.preview(draft),publish:()=>adapter.publish(draft)};
}
