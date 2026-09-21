// Item tags determine public membership; specialist files supply known details.
(() => {
  const tags={weapons:'weapon',armour:'armour',ammunition:'ammunition',crafting:'crafted-item'};
  function records(kind,items,specialists,{editor=false}={}) {
    const tag=tags[kind];if(!tag)return specialists;
    const registry=new Map(items.map(item=>[item.id,item]));
    const result=specialists.filter(row=>editor||!registry.has(row.id)||registry.get(row.id).classification?.includes(tag)).map(row=>{
      const shared=registry.get(row.id);
      return editor||!shared?row:{...row,name:shared.name,image:shared.image||row.image};
    });
    const ids=new Set(specialists.map(row=>row.id));
    for(const item of items) {
      if(!item.classification?.includes(tag)||ids.has(item.id))continue;
      const row={id:item.id,name:item.name,image:item.image||null,description:item.description||null,
        source:{file:null,status:'pending-review',note:'Specialist details have not been recorded.'},_catalogOnly:true};
      if(kind==='weapons')Object.assign(row,{category:editor?null:'Details pending',tier:null,ammo:null,damage:null,rpm:null,range:null,accuracy:null,recoil:null,handling:null,ergonomics:null,reload:null});
      if(kind==='armour')Object.assign(row,{category:editor?null:'Details pending',price:item.estimatedPrice??null,vendorRank:item.rank==null?null:String(item.rank),repairClass:null,ballistic:null,slash:null,radiation:null,durability:null});
      if(kind==='ammunition')Object.assign(row,{category:editor?null:'Details pending',estimatedPrice:item.estimatedPrice??null,maxStack:item.maxStack??null,damage:null,penetrationPercent:null});
      if(kind==='crafting')Object.assign(row,{workbench:editor?null:'pending',ingredients:[]});
      result.push(row);ids.add(item.id);
    }
    return result;
  }
  globalThis.ScavCatalog={records};
})();
