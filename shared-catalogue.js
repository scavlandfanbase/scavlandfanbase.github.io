// Read-only foundation for category editors. Join by exact identity, never names.
// Source disagreements are reported; callers must not treat this view as a save payload.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavSharedCatalogue=api;
})(globalThis,function(){
 'use strict';
 const sharedFields=Object.freeze(['name','image','description','notes','estimatedPrice','maxStack','stackable','effects']);
 const categories=Object.freeze({ammo:'ammunition',armour:'armour',weapons:'weapon'});
 const copy=v=>structuredClone(v);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function index(rows,label){
  if(!Array.isArray(rows))throw Error('Supply '+label+' records.');
  const result=new Map();
  for(const row of rows){
   if(!row||typeof row.id!=='string'||!row.id.trim()||result.has(row.id))throw Error('Invalid or duplicate '+label+' identity.');
   result.set(row.id,row);
  }
  return result;
 }
 function create({items,ammo=[],armour=[],weapons=[]}){
  const master=index(items,'Items'),facets={ammo:index(ammo,'Ammo'),armour:index(armour,'Armour'),weapons:index(weapons,'Weapons')};
  // Capture a snapshot so callers cannot mutate the resolver's authority in place.
  const sources=Object.fromEntries(Object.entries(facets).map(([kind,records])=>[kind,new Map([...records].map(([id,r])=>[id,copy(r)]))]));
  const canonical=new Map([...master].map(([id,r])=>[id,copy(r)]));
  function item(id){
   const record=canonical.get(id);if(!record)return null;
   const shared={},specialists={},conflicts=[],missing=[];
   for(const key of sharedFields){if(Object.hasOwn(record,key))shared[key]=copy(record[key]);else missing.push(key);}
   for(const [kind,records]of Object.entries(sources)){
    const row=records.get(id);if(!row)continue;
    specialists[kind]=copy(row);
    for(const key of sharedFields)if(Object.hasOwn(record,key)&&Object.hasOwn(row,key)&&!same(record[key],row[key]))
     conflicts.push({kind,field:key,canonical:copy(record[key]),specialist:copy(row[key])});
   }
   return {id,shared,missingSharedFields:missing,specialists,canonical:copy(record),conflicts};
  }
  function category(kind,{includeInactive=false}={}){
   if(!Object.hasOwn(categories,kind))throw Error('Unsupported specialist category.');
   return [...canonical.values()].filter(r=>(includeInactive||!r.hidden&&!r.archived)&&
    (sources[kind].has(r.id)||r.classification?.includes(categories[kind]))).map(r=>item(r.id));
  }
  function report(){
   return {items:canonical.size,categories:Object.fromEntries(Object.keys(categories).map(kind=>[kind,{
    records:sources[kind].size,linked:[...sources[kind].keys()].filter(id=>canonical.has(id)).length,
    unlinked:[...sources[kind].keys()].filter(id=>!canonical.has(id)),
    conflicts:[...sources[kind].keys()].flatMap(id=>item(id)?.conflicts.filter(c=>c.kind===kind).map(c=>({id,...c}))||[])
   }]))};
  }
  return Object.freeze({item,category,report});
 }
 return Object.freeze({sharedFields,categories,create});
});
