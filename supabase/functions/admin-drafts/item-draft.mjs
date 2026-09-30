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
function validate(state){
 keys(state,['schemaVersion','itemId','category','revision','original','records','changes']);
 if(state.schemaVersion!==1||typeof state.itemId!=='string'||!Object.hasOwn(tags,state.category)||!Number.isSafeInteger(state.revision)||state.revision<0)fail('Invalid per-item draft.');
 keys(state.original,Object.keys(paths));keys(state.records,Object.keys(paths));keys(state.changes,Object.keys(paths));
 if(!state.original.items||!state.records.items)fail('Missing shared identity.');
 for(const group of [state.original,state.records])for(const r of Object.values(group))if(r.id!==state.itemId)fail('A draft can contain only its own item.');
 for(const [kind,changes]of Object.entries(state.changes)){
  keys(changes,[...sharedFields,...(facetFields[kind]||[]),'verification']);
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
export function editItem(input,command,{actor,permissions:allowed,settings,images=[],clock=()=>new Date()}={}){
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
 if(!currentItem)fail('The item was removed from public data. Review before publishing.',409);
 if(legacyItemBlockers(input.itemId,currentItem,legacyDrafts).length)fail('This item has pending work in the existing Items draft. Review and preserve it before continuing.',409);
 if(currentItem.archived||!same(ownValue(currentItem,'classification'),ownValue(input.original.items,'classification')))fail('Item membership changed. Reload and review before publishing.',409);
 const result={[paths.items]:structuredClone(documents[paths.items])},conflicts=[];
 for(const [kind,changes]of Object.entries(input.changes)){
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
 const changed=Object.keys(state.changes);if(!changed.length)fail('There are no changed item fields to publish.');
 const touched=[...new Set([paths.items,...changed.map(k=>paths[k])])];
 const payload={domain:'shared-item',entity_id:state.itemId,version:state.revision,payload:structuredClone(state),base:Object.fromEntries(touched.map(p=>[p,base[p]]))};
 const adapter=githubPublisher({repository,token,fetcher,paths:touched,allowUnrelatedChanges:true,beforePublish,
  validate:d=>{if(d.entity_id!==state.itemId)fail('Incorrect item identity.');validate(d.payload);},
  project:(d,documents)=>planItem(d.payload,documents,{legacyDrafts})});
 return {preview:()=>adapter.preview(payload),publish:()=>adapter.publish(payload)};
}
