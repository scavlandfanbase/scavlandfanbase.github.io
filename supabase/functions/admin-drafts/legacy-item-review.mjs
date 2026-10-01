// Read-only selected-identity review. Trusted source/draft inputs only; no migration.
import {snapshotItem,categoryView,reconcilePublishedItem,editItem} from './item-draft.mjs';
import {project,publicValue,same,fail} from './core.mjs';
const shared=new Set(['name','image','description','notes','estimatedPrice','maxStack','stackable','effects']);
const own=(r,k)=>({present:Object.hasOwn(r,k),...(Object.hasOwn(r,k)?{value:structuredClone(r[k])}:{})});
function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;}
export async function legacyDigest(draft){
 const bytes=new TextEncoder().encode(JSON.stringify(stable(draft)));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function inspectLegacyItem(documents,draft,itemId,category,context){
 const seed=snapshotItem(documents,itemId,category,context),current=seed.records.items;
 if(!draft)return {itemId,name:current.name,status:'no-legacy-draft',fields:[]};
 if(draft.domain!=='items'||draft.entity_id!=='catalogue'||!Number.isSafeInteger(draft.version)||draft.version<1)fail('Invalid legacy draft.',502);
 const baseline=draft.payload?.source?.data?.find(r=>r.id===itemId),privateRecord=draft.payload?.catalogue?.data?.find(r=>r.id===itemId);
 const desired=project('items',draft.payload).data.find(r=>r.id===itemId);
 if(!baseline||!privateRecord||!desired)fail('This identity requires separate legacy creation or removal review.',409);
 const base=publicValue(baseline),now=publicValue(current),fields=[];
 for(const key of new Set([...Object.keys(base),...Object.keys(desired)])){
  const before=own(base,key),after=own(desired,key),published=own(now,key);
  if(same(before,after))continue;
  const status=same(published,after)?'already-public':!shared.has(key)||!after.present?'manual-review':same(published,before)?'ready':'conflict';
  fields.push({field:key,status,baseline:before,private:after,public:published});
 }
 const status=fields.some(f=>f.status==='conflict')?'conflict':fields.some(f=>f.status==='manual-review')?'manual-review':fields.some(f=>f.status==='ready')?'ready-for-reviewed-import':'no-pending-public-fields';
 return {itemId,name:current.name,sourceVersion:draft.version,sourceDigest:await legacyDigest(draft),publicDigest:await legacyDigest({original:seed.original,settings:context.settings}),status,fields,
  // Full selected trusted record retains private facts/history for a future reviewed import.
  preserved:{sourceRecord:structuredClone(baseline),privateRecord:structuredClone(privateRecord)},
  message:'Read-only review. Existing draft remains intact. Ready fields still require an explicit version-bound import; no conflicts or provenance are resolved automatically.'};
}
// Trusted preparation only. Saving/acknowledging this state requires the next API/SQL bridge.
// Browser supplies reviewed intent, never draft payloads, actor or historical facts.
export async function prepareLegacyImport(documents,draft,input,command,context){
 if(!command||Object.keys(command).some(k=>!['action','expectedRevision','confirmId','sourceVersion','sourceDigest','publicDigest'].includes(k))||command.action!=='import-legacy')fail('Invalid legacy import intent.');
 if(command.confirmId!==input.itemId||command.expectedRevision!==input.revision)fail('The selected item draft changed. Review again.',409);
 const report=await inspectLegacyItem(documents,draft,input.itemId,input.category,context);
 if(report.sourceVersion!==command.sourceVersion||report.sourceDigest!==command.sourceDigest||report.publicDigest!==command.publicDigest)fail('Legacy work or public facts changed since review. Review again.',409);
 if(['conflict','manual-review','no-legacy-draft'].includes(report.status))fail('Resolve conflicting or unsupported legacy changes before importing.',409);
 const state=reconcilePublishedItem(categoryView(input,input.category,context),documents),sharedEdits={};
 for(const field of report.fields){
  if(!shared.has(field.field)||!field.private.present)fail('This field requires a separate reviewed migration.',409);
  const desired=field.private.value;
  if(state.changes.items?.[field.field]&&!same(state.records.items[field.field],desired))fail('The per-item draft has a different saved edit. Nothing was imported.',409);
  for(const [kind,changes]of Object.entries(state.changes))if(kind!=='items'&&changes[field.field]&&!same(state.records[kind][field.field],desired))fail('A linked facet has a different saved edit. Nothing was imported.',409);
  sharedEdits[field.field]=structuredClone(desired);
 }
 const changed=editItem(state,{action:'edit',expectedRevision:state.revision,shared:sharedEdits},context);
 changed.legacyTransfer={sourceVersion:report.sourceVersion,sourceDigest:report.sourceDigest,publicDigest:report.publicDigest,
  preserved:structuredClone(report.preserved),importedFields:Object.keys(sharedEdits),actor:context.actor,at:(context.clock||(()=>new Date()))().toISOString()};
 // The transfer context is private; ordinary publication still checks legacy overlap.
 return changed;
}
