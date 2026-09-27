import {Items,Vendors,Listings,Inventory,Verification,Attachments} from './models.generated.mjs';
import {githubPublisher} from './github-publisher.mjs';
export const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const same=(a,b)=>JSON.stringify(sort(a))===JSON.stringify(sort(b));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
const fileFor=domain=>'data/'+domain+'.json';
export function seed(domain,source){return domain==='items'?{...Items.foundation(source),revision:0}:{version:1,revision:0,data:structuredClone(source.data),...(source.vendorListings?{vendorListings:structuredClone(source.vendorListings)}:{})};}
export function validate(domain,catalogue){
 if(domain==='items')Items.validate(catalogue);else {Vendors.validate(catalogue);if(catalogue.vendorListings)Listings.validate(catalogue.vendorListings);}
 if(!Number.isSafeInteger(catalogue.revision)||catalogue.revision<0)fail('Invalid catalogue revision.');
}
export function publicValue(value){
 if(Array.isArray(value))return value.map(publicValue);
 if(!value||typeof value!=='object')return value;
 const result={};
 for(const [key,v] of Object.entries(value)){
  if(['internalNotes','internal_notes','audit','auditHistory','saveReceipts','saved_by','saved_at','verified_by','verified_at','verifierId','verifier_id','last_verified_by','last_verified_at','started_by'].includes(key))continue;
  if(key==='verification'){
   if(v===null){result[key]=null;continue;}
   Verification.validate(v);
   result[key]={schemaVersion:2,decision:v.decision,verified_patch_id:v.verified_patch_id};
  }else result[key]=publicValue(v);
 }
 return result;
}
// Omitted source values stay omitted unless an editor action actually changed them.
export function project(domain,payload){
 const {catalogue,source}=payload;validate(domain,catalogue);
 const original=seed(domain,source),result=structuredClone(source),ids=new Set(catalogue.data.map(r=>r.id));
 if(original.data.some(r=>!ids.has(r.id)))fail('Canonical records cannot be deleted. Use Archive.');
 const originals=new Map(source.data.map(r=>[r.id,r])),defaults=new Map(original.data.map(r=>[r.id,r]));
 result.data=catalogue.data.map(record=>{
  const r=structuredClone(record),old=originals.get(r.id),baseline=defaults.get(r.id);
  if(old)for(const key of Object.keys(r))if(!Object.hasOwn(old,key)&&same(r[key],baseline[key]))delete r[key];
  delete r.createdAt;delete r.updatedAt;
  return r;
 });
 if(domain==='vendors'&&catalogue.vendorListings){
  result.vendorListings=structuredClone(catalogue.vendorListings);
  // Commercial notes are private Admin context, not public Item attributes.
  result.vendorListings.listings.forEach(row=>{row.notes=null;});
 }
 return publicValue(result);
}
export function createCore({env,fetcher=fetch}){
 const repository='scavlandfanbase/scavlandfanbase.github.io',root='https://api.github.com/repos/'+repository;
 async function gh(path){
  const token=env('GITHUB_TOKEN');if(!token)fail('Canonical storage is not configured.',503);
  const r=await fetcher(root+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok)fail('Could not load current canonical records. Retry.',502);return r.json();
 }
 async function read(domain){
  const head=(await gh('/git/ref/heads/main')).object.sha;
  const paths=[fileFor(domain),'data/verification-settings.json','data/site-images.json',...(domain==='vendors'?['data/factions.json','data/items.json']:[])];
  const files=Object.fromEntries(await Promise.all(paths.map(async path=>{
   const f=await gh('/contents/'+path+'?ref='+head);
   if(f.encoding!=='base64'||!f.sha)fail('Invalid canonical response.',502);
   return [path,{sha:f.sha,data:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\n/g,'')),c=>c.charCodeAt(0))))}];
  })));
  const source=files[fileFor(domain)].data,settings=files['data/verification-settings.json'].data;
  Verification.patchId(settings);
  return {source,base:{[fileFor(domain)]:files[fileFor(domain)].sha},settings,
   images:files['data/site-images.json'].data,factions:files['data/factions.json']?.data.data||[],
   entities:{item:files['data/items.json']?.data.data||[],weapon:[],ammo:[],armour:[],attachment:[],blueprint:[]}};
 }
 function context(domain,saved,latest){
  let payload=saved?.payload||{catalogue:seed(domain,latest.source),source:latest.source},base=saved?.base||latest.base;
  if(saved){validate(domain,payload.catalogue);
   // Reconcile a confirmed (or response-lost) publication only by exact public content.
   // Unrelated/external canonical edits are never silently rebased.
   if(!same(base,latest.base)&&same(project(domain,payload),latest.source)){
    payload={...payload,source:latest.source};base=latest.base;
   }
  }
  return {payload:structuredClone(payload),base};
 }
 function mutate(domain,ctx,command,latest,actor){
  const catalogue=ctx.payload.catalogue;
  if(command.revision!==(catalogue.revision??0))fail('Conflict — newer version exists.',409);
  if(Object.keys(command).some(k=>['verification','actorId','verified_by','verified_at','verified_patch_id','history'].includes(k)))fail('Verification identity and history are recorded by the server.');
  const images=[...new Set(Object.values(latest.images.categories||{}).flatMap(c=>c.images||[]))];
  let record;
  try{
   if(domain==='items')record=Items.mutate(catalogue,{...command,...(command.action==='verify'?{patchId:latest.settings.current_patch_id}:{})},{images,settings:latest.settings,actorId:actor});
   else if(command.action==='inventory'){
    if(command.operation==='add'&&command.entity?.type!=='item')fail('Admin 0.1 listings reference canonical Items.');
    record=Inventory.mutate(catalogue,command,latest.entities,latest.settings,actor);
   }else record=Vendors.mutate(structuredClone(catalogue),command,{images,factions:latest.factions.map(f=>f.id)});
  }catch(e){if(!e.status)e.status=400;throw e;}
  validate(domain,record.state);
  return {payload:{catalogue:record.state,source:ctx.payload.source,selectedId:record.selectedId,settings:latest.settings},base:ctx.base};
 }
 function view(domain,saved,latest){
  const ctx=context(domain,saved,latest);
  return {catalogue:ctx.payload.catalogue,settings:latest.settings,images:latest.images,factions:latest.factions,
   categories:domain==='items'?Items.categories:[],factFields:domain==='items'?Items.factFields:[],
   entities:latest.entities,sources:{item:'items',weapon:null,ammo:null,armour:null,attachment:null,blueprint:null}};
 }
 const publishers=Object.fromEntries(['items','vendors'].map(domain=>[domain,githubPublisher({repository,token:env('GITHUB_TOKEN'),paths:[fileFor(domain)],fetcher,
  validate:d=>{if(d.entity_id!=='catalogue')fail('Unknown editor draft.');validate(domain,d.payload.catalogue);},
  project:(draft,documents)=>{
   if(!same(draft.payload.source,documents[fileFor(domain)]))fail('Public source changed. Review before publishing.',409);
   return {[fileFor(domain)]:project(domain,draft.payload)};
  }})]));
 return {read,context,mutate,view,publishers};
}
