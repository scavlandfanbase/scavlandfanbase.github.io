// Read-only selected-identity review. Trusted source/draft inputs only; no migration.
import {snapshotItem} from './item-draft.mjs';
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
 return {itemId,name:current.name,sourceVersion:draft.version,sourceDigest:await legacyDigest(draft),status,fields,
  // Full selected trusted record retains private facts/history for a future reviewed import.
  preserved:{sourceRecord:structuredClone(baseline),privateRecord:structuredClone(privateRecord)},
  message:'Read-only review. Existing draft remains intact. Ready fields still require an explicit version-bound import; no conflicts or provenance are resolved automatically.'};
}
