// Trusted per-item contract foundation. Not a deployed endpoint or browser save API.
// Auth actor/permissions, documents, images and settings must come from the server.
import {Verification} from './models.generated.mjs';
import {publicValue,same,fail,project as projectCatalogue} from './core.mjs';
import {githubPublisher} from './github-publisher.mjs';
const paths={items:'data/items.json',ammo:'data/ammo.json',armour:'data/armour.json',weapons:'data/weapons.json'};
const tags={ammo:'ammunition',armour:'armour',weapons:'weapon'};
const permissions={ammo:'ammunition_edit',armour:'armour_edit',weapons:'weapons_edit'};
const sharedFields=['name','image','description','notes','estimatedPrice','maxStack','stackable','effects'];
const facetFields={ammo:['category','damage','penetrationPercent'],armour:['category','repairClass','ballistic','slash','radiation','durability'],weapons:['category','tier','ammo','damage','rpm','range','accuracy','recoil','handling','ergonomics','reload']};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('Unsupported item action fields.');}
function rows(doc){if(!object(doc)||!Array.isArray(doc.data))fail('Invalid canonical catalogue.',502);const ids=new Set();for(const r of doc.data){if(!object(r)||typeof r.id!=='string'||ids.has(r.id))fail('Invalid canonical identity.',502);ids.add(r.id);}return doc.data;}
function ownValue(r,key){return {present:Object.hasOwn(r,key),...(Object.hasOwn(r,key)?{value:structuredClone(r[key])}:{})};}
function match(r,key,expected){return same(ownValue(r,key),expected);}
function publicationValue(key,field){
 return key==='verification'&&field.present?{present:true,value:publicValue({verification:field.value}).verification}:field;
}
function authorize(category,item,facet,permissionsFromServer){
 if(!Object.hasOwn(tags,category)||!Array.isArray(permissionsFromServer)||!permissionsFromServer.includes(permissions[category]))fail('Category editing permission is required.',403);
 if(item.contentType!==undefined&&item.contentType!==({ammo:'Ammo',armour:'Armour',weapons:'Weapon'})[category]&&!item.classification?.includes(tags[category]))fail('This item has changed category. Its saved specialist facts are retained.',409);
 if(!facet&&!item.classification?.includes(tags[category]))fail('This item does not belong to that category.',403);
}
export function snapshotItem(documents,itemId,category,{permissions:allowed}={}){
 if(typeof itemId!=='string'||!itemId.trim())fail('Select an existing item.');
 const item=rows(documents[paths.items]).find(r=>r.id===itemId);if(!item)fail('Item not found.',404);
 const facets=Object.fromEntries(Object.keys(tags).map(k=>[k,rows(documents[paths[k]]).find(r=>r.id===itemId)]).filter(([,r])=>r));
 authorize(category,item,facets[category],allowed);
 return {schemaVersion:1,itemId,category,revision:0,original:{items:structuredClone(item),...structuredClone(facets)},records:{items:structuredClone(item),...structuredClone(facets)},changes:{}};
}
export function categoryView(input,category,{permissions:allowed}={}){
 validate(input);authorize(category,input.records.items,input.records[category],allowed);
 return {...structuredClone(input),category};
}
// Reconcile fields that are already exactly public. Keep full private review history.
// A changed public value different from our desired value remains a conflict.
export function reconcilePublishedItem(input,documents){
 validate(input);const state=structuredClone(input);
 for(const kind of Object.keys(state.creation||{})){
  const current=documents[paths[kind]]?.data.find(r=>r.id===state.itemId);
  if(current&&same(publicValue(current),publicValue(state.records[kind]))){
   state.original[kind]=structuredClone(current);delete state.creation[kind];delete state.changes[kind];
  }
 }
 for(const [kind,changes]of Object.entries(state.changes)){
  const current=documents[paths[kind]]?.data.find(r=>r.id===state.itemId);if(!current)continue;
  for(const key of Object.keys(changes))if(same(publicationValue(key,ownValue(current,key)),publicationValue(key,ownValue(state.records[kind],key)))){
   if(Object.hasOwn(current,key))state.original[kind][key]=structuredClone(current[key]);else delete state.original[kind][key];
   delete changes[key];
  }
  if(!Object.keys(changes).length)delete state.changes[kind];
 }
 return state;
}
function validate(state){
 keys(state,['schemaVersion','itemId','category','revision','original','records','changes','creation','legacyTransfer']);
 if(state.legacyTransfer){
  const t=state.legacyTransfer;keys(t,['sourceVersion','sourceDigest','publicDigest','preserved','importedFields','actor','at']);
  if(!Number.isSafeInteger(t.sourceVersion)||t.sourceVersion<1||!Array.isArray(t.importedFields)||
   !/^[0-9a-f]{64}$/.test(t.sourceDigest)||!/^[0-9a-f]{64}$/.test(t.publicDigest)||
   t.preserved?.privateRecord?.id!==state.itemId||t.preserved?.sourceRecord?.id!==state.itemId||typeof t.actor!=='string'||!t.actor||!Number.isFinite(Date.parse(t.at)))fail('Invalid legacy transfer context.');
 }
 if(state.schemaVersion!==1||typeof state.itemId!=='string'||!Object.hasOwn(tags,state.category)||!Number.isSafeInteger(state.revision)||state.revision<0)fail('Invalid per-item draft.');
 keys(state.original,Object.keys(paths));keys(state.records,Object.keys(paths));keys(state.changes,Object.keys(paths));
 if(!state.original.items||!state.records.items)fail('Missing shared identity.');
 if(state.creation!==undefined){
  keys(state.creation,['items',state.category]);
  for(const [kind,created]of Object.entries(state.creation))if(created!==true||!state.records[kind])fail('Invalid new item draft.');
 }
 for(const group of [state.original,state.records])for(const r of Object.values(group))if(r.id!==state.itemId)fail('A draft can contain only its own item.');
 for(const [kind,changes]of Object.entries(state.changes)){
  keys(changes,[...sharedFields,...(facetFields[kind]||[]),'verification',...(kind==='items'?['archived']:[])]);
  for(const key of Object.keys(changes))if(!state.records[kind]||!Object.hasOwn(state.records[kind],key))fail('Invalid changed field.');
 }
 return state;
}
function value(key,v,{images}){
 if(v===undefined)fail('Use null for unknown values.');
 if(key==='name'){if(typeof v!=='string'||!v.trim()||v.length>300)fail('Enter an item name.');}
 else if(key==='image'){if(v!==null&&(typeof v!=='string'||!images.includes(v)))fail('Choose an image from the trusted library.');}
 else if(['description','notes','category','repairClass','tier','ammo'].includes(key)){if(v!==null&&(typeof v!=='string'||v.length>10000))fail('Enter text or an unknown value.');}
 else if(key==='damage'&&typeof v==='string'){if(v.length>300)fail('Damage text is too long.');}
 else if(key==='effects'){if(v!==null&&!object(v))fail('Effects must be recorded values.');}
 else if(key==='stackable'){if(v!==null&&typeof v!=='boolean')fail('Stackable must be Yes, No or unknown.');}
 else if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||(key!=='penetrationPercent'&&v<0)||(key==='maxStack'&&!Number.isSafeInteger(v))))fail('Enter a valid recorded number or unknown value.');
 if(JSON.stringify(v).length>100000)fail('Recorded value is too large.');
}
function set(state,kind,key,v){
 if(match(state.records[kind],key,{present:true,value:v}))return false;
 state.records[kind][key]=structuredClone(v);state.changes[kind]??={};
 state.changes[kind][key]=true;return true;
}
// Server supplies the permanent ID. Browser commands contain only recorded facts.
export function createAmmoItem(documents,itemId,command,context={}){return createCategoryItem(documents,itemId,'ammo',command,context);}
export function createCategoryItem(documents,itemId,category,command,context={}){
 if(!['ammo','armour','weapons'].includes(category))fail('Category creation is not available.');
 keys(command,['action','shared','specialist']);
 if(command.action!=='create'||typeof itemId!=='string'||!/^item-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId))fail('A server-assigned item identity is required.');
 for(const path of Object.values(paths))if(rows(documents[path]).some(r=>r.id===itemId))fail('This identity already exists. Reload its saved draft.',409);
 keys(command.shared||{},sharedFields);keys(command.specialist||{},facetFields[category]);
 if(!command.shared?.name)fail('Enter an item name.');
 value('name',command.shared?.name,{images:context.images||[]});
 const item={id:itemId,name:command.shared.name,classification:[tags[category]],image:null,description:null,notes:null,estimatedPrice:null,maxStack:null,source:{status:'pending-review'},hidden:false,archived:false};
 const facet={id:itemId,name:item.name,image:null,description:null,estimatedPrice:null,maxStack:null,...Object.fromEntries(facetFields[category].map(k=>[k,null])),source:{status:'pending-review'}};
 const state={schemaVersion:1,itemId,category,revision:0,original:{items:structuredClone(item),[category]:structuredClone(facet)},records:{items:item,[category]:facet},changes:{},creation:{items:true,[category]:true}};
 return editItem(state,{action:'edit',expectedRevision:0,shared:command.shared,specialist:command.specialist},context);
}
// Explicitly add a missing facet only to an already classified Ammo identity.
export function addAmmoFacet(input,command,context={}){return addCategoryFacet(input,command,context);}
export function addCategoryFacet(input,command,context={}){
 const category=input.category;
 validate(input);keys(command,['action','expectedRevision','confirmId','specialist']);
 if(!['ammo','armour','weapons'].includes(category)||command.action!=='add-facet'||command.expectedRevision!==input.revision)fail('Reload the category item before adding its details.',409);
 authorize(category,input.records.items,null,context.permissions);
 if(command.confirmId!==input.itemId)fail('Confirm the existing item identity.');
 if(input.records[category])fail('This item already has category details.',409);
 const state=structuredClone(input),item=state.records.items;
 const facet={id:input.itemId,name:item.name,image:item.image??null,description:item.description??null,estimatedPrice:item.estimatedPrice??null,maxStack:item.maxStack??null,...Object.fromEntries(facetFields[category].map(key=>[key,null])),source:{status:'pending-review'}};
 state.original[category]=structuredClone(facet);state.records[category]=facet;state.creation={...(state.creation||{}),[category]:true};
 return editItem(state,{action:'edit',expectedRevision:input.revision,specialist:command.specialist},context);
}
export function editItem(input,command,{actor,permissions:allowed,settings,images=[],clock=()=>new Date()}={}){
 if(input.records?.items.archived)fail('Restore the item before editing.');
 validate(input);keys(command,['action','expectedRevision','shared','specialist']);
 if(command.action!=='edit'||command.expectedRevision!==input.revision)fail('The item draft changed. Reload and review.',409);
 if(typeof actor!=='string'||!actor.trim())fail('Authenticated identity is required.',401);
 authorize(input.category,input.records.items,input.records[input.category],allowed);
 keys(command.shared||{},sharedFields);keys(command.specialist||{},facetFields[input.category]);
 if(Object.keys(command.specialist||{}).length&&!input.records[input.category])fail('Specialist creation requires a separate reviewed add action.');
 const state=structuredClone(input),changed=new Set();
 for(const [key,v]of Object.entries(command.shared||{})){
  value(key,v,{images});
  // A deliberate shared edit reconciles that field, not other conflicting values.
  for(const [kind,r]of Object.entries(state.records))if(kind==='items'||sharedOutputField(kind,key,r))
   if(set(state,kind,key,v))changed.add(kind);
 }
 for(const [key,v]of Object.entries(command.specialist||{})){value(key,v,{images});if(set(state,state.category,key,v))changed.add(state.category);}
 for(const kind of changed){
  const r=state.records[kind];
  if(r.verification?.decision==='verified'||Verification.inspect(r,settings).status!=='unverified')
   set(state,kind,'verification',Verification.decide(r,'unverified',settings,actor,clock).verification);
 }
 state.revision++;return validate(state);
}
// Review attests only to this category's saved facts, never unrelated facets.
export function reviewItem(input,command,{actor,permissions:allowed,settings,clock=()=>new Date()}={}){
 if(input.records?.items.archived)fail('Restore the item before reviewing.');
 validate(input);keys(command,['action','expectedRevision','confirmId','patchId','decision']);
 if(command.action!=='review'||command.expectedRevision!==input.revision)fail('The item draft changed. Reload and review.',409);
 authorize(input.category,input.records.items,input.records[input.category],allowed);
 if(typeof actor!=='string'||!actor.trim())fail('Authenticated identity is required.',401);
 if(command.confirmId!==input.itemId)fail('Confirm the item you reviewed.');
 if(command.patchId!==Verification.patchId(settings))fail('The current patch changed. Reload before reviewing.',409);
 if(!['verified','unverified'].includes(command.decision))fail('Choose Verified or Unverified.');
 if(command.decision==='verified'&&!Verification.patchId(settings))fail('Set the current patch before verifying.');
 if(!input.records[input.category])fail('Add the category record before reviewing.');
 const state=structuredClone(input);
 set(state,state.category,'verification',Verification.decide(state.records[state.category],command.decision,settings,actor,clock).verification);
 state.revision++;return validate(state);
}
export function lifecycleItem(input,command,{actor,permissions:allowed}={}){
 validate(input);keys(command,['action','expectedRevision','confirmId']);
 if(!['archive','restore'].includes(command.action)||command.expectedRevision!==input.revision)fail('The item draft changed. Reload and review.',409);
 authorize(input.category,input.records.items,input.records[input.category],allowed);
 if(typeof actor!=='string'||!actor.trim())fail('Authenticated identity is required.',401);
 if(command.confirmId!==input.itemId)fail('Confirm the item identity.');
 const archived=command.action==='archive';
 if(!!input.records.items.archived===archived)fail(archived?'Item is already archived.':'Item is already active.');
 const state=structuredClone(input);set(state,'items','archived',archived);state.revision++;return validate(state);
}
function sharedOutputField(kind,key,record){
 if(['name','image','description'].includes(key))return true;
 // Existing compatibility fields stay linked; do not invent unsuitable specialist fields.
 return Object.hasOwn(record,key)||kind==='ammo'&&['estimatedPrice','maxStack'].includes(key);
}
export function legacyItemBlockers(itemId,currentItem,legacyDrafts=[]){
 const blockers=[];
 for(const draft of legacyDrafts){
  if(draft.domain!=='items'||draft.entity_id!=='catalogue')continue;
  const projected=projectCatalogue('items',draft.payload).data.find(r=>r.id===itemId);
  const baseline=draft.payload.source.data.find(r=>r.id===itemId);
  if(!same(projected,baseline)&&!same(projected,currentItem))blockers.push({domain:'items',entityId:'catalogue',version:draft.version,itemId});
 }
 return blockers;
}
export function planItem(input,documents,{legacyDrafts=[]}={}){
 validate(input);
 const currentItem=rows(documents[paths.items]).find(r=>r.id===input.itemId);
 if(input.creation?.items)for(const kind of ['armour','weapons'])if(documents[paths[kind]]&&rows(documents[paths[kind]]).some(r=>r.id===input.itemId))fail('This identity is already used in another category. Review before publishing.',409);
 if(!currentItem&&!input.creation?.items)fail('The item was removed from public data. Review before publishing.',409);
 if(legacyItemBlockers(input.itemId,currentItem,legacyDrafts).length)fail('This item has pending work in the existing Items draft. Review and preserve it before continuing.',409);
 if(currentItem&&(!same(ownValue(currentItem,'classification'),ownValue(input.original.items,'classification'))||
  !input.changes.items?.archived&&!match(currentItem,'archived',ownValue(input.original.items,'archived'))))fail('Item membership or archive state changed. Reload and review before publishing.',409);
 const result={[paths.items]:structuredClone(documents[paths.items])},conflicts=[];
 for(const kind of Object.keys(input.creation||{})){
  const doc=structuredClone(documents[paths[kind]]),existing=rows(doc).find(r=>r.id===input.itemId),desired=publicValue(input.records[kind]);
  if(existing&&!same(publicValue(existing),desired))fail('A record now exists for this identity. Review before publishing.',409);
  if(!existing)doc.data.push(desired);
  result[paths[kind]]=doc;
 }
 for(const [kind,changes]of Object.entries(input.changes)){
  if(input.creation?.[kind])continue;
  const doc=structuredClone(documents[paths[kind]]),r=rows(doc).find(r=>r.id===input.itemId);
  if(!r)fail('A linked record was removed. Review before publishing.',409);
  for(const key of Object.keys(changes)){
   const before=ownValue(input.original[kind],key),after=ownValue(input.records[kind],key);
   const current=publicationValue(key,ownValue(r,key));
   if(!same(current,publicationValue(key,before))&&!same(current,publicationValue(key,after)))conflicts.push({kind,field:key});
   else r[key]=key==='verification'?publicValue({verification:input.records[kind][key]}).verification:publicValue(input.records[kind][key]);
  }
  result[paths[kind]]=doc;
 }
 if(conflicts.length)throw Object.assign(Error('Public changes conflict with this item draft. Nothing was published.'),{status:409,conflicts});
 return result;
}
export function createItemPublisher({state,base,repository,token,fetcher,legacyDrafts=[],beforePublish}){
 validate(state);
 const changed=[...new Set([...Object.keys(state.changes),...Object.keys(state.creation||{})])];if(!changed.length)fail('There are no changed item fields to publish.');
 const touched=[...new Set([paths.items,...changed.map(k=>paths[k])])];
 const payload={domain:'shared-item',entity_id:state.itemId,version:state.revision,payload:structuredClone(state),base:Object.fromEntries(touched.map(p=>[p,base[p]]))};
 const adapter=githubPublisher({repository,token,fetcher,paths:touched,allowUnrelatedChanges:true,beforePublish,
  validate:d=>{if(d.entity_id!==state.itemId)fail('Incorrect item identity.');validate(d.payload);},
  project:(d,documents)=>planItem(d.payload,documents,{legacyDrafts})});
 return {preview:()=>adapter.preview(payload),publish:()=>adapter.publish(payload)};
}
