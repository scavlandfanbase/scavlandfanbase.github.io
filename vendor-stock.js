// Suggestions only: item stats or another shop never verify this vendor's stock.
(() => {
  const known=value=>value!==undefined&&value!==null&&value!=='';
  function priceNumber(value){
    if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
    if(typeof value!=='string')return null;
    const text=value.trim().replace(/₽$/,'').trim();
    return /^\d+(?:[ ,]\d{3})*$/.test(text)?Number(text.replace(/[ ,]/g,'')):null;
  }
  function defaults(item,catalog={},vendors=[]) {
    if(!item)return {itemId:'',name:'',rank:'',price:null,details:''};
    const armour=(catalog.armour||[]).find(row=>row.id===item.id);
    const ammo=(catalog.ammo||[]).find(row=>row.id===item.id);
    const weapon=(catalog.weapons||[]).find(row=>row.id===item.id);
    const listings=vendors.flatMap(vendor=>vendor.inventory||[]).filter(row=>row.itemId===item.id);
    const origins=new Set();
    function choose(values,key,normalize=value=>value){
      for(const [value,origin]of values)if(known(value)){const normalized=normalize(value);if(known(normalized)){origins.add(origin);return normalized;}}
      const candidates=[...new Set(listings.map(row=>row[key]).filter(known).map(normalize).filter(known))];
      if(candidates.length===1){origins.add('existing vendor listings');return candidates[0];}
      return null;
    }
    const price=choose([[item.estimatedPrice,'Items'],[armour?.price,'armour data'],[ammo?.estimatedPrice,'ammunition data']],'price',priceNumber);
    const rank=choose([[item.rank,'Items'],[armour?.vendorRank,'armour data']],'rank',String);
    const details=choose([[item.description,'Items'],[armour?.description,'armour data'],[ammo?.description,'ammunition data'],[weapon?.category,'weapon data'],[armour?.category,'armour data']],'details',String)||'';
    const note=(origins.size?'Suggested values from '+[...origins].join(', ')+'. ':'')+'Confirm this vendor’s price and unlock rank. Missing or conflicting values are left blank.';
    return {itemId:item.id,name:item.name,rank:rank??'',price:Number.isFinite(price)?price:null,details,
      source:{file:null,status:'pending-review',note,lastVerified:null}};
  }
  function fillMissing(row,item,catalog,vendors){
    if(!item)return row;
    const suggested=defaults(item,catalog,vendors),result={...row};let filled=false;
    for(const field of ['price','rank','details'])if(!known(result[field])&&known(suggested[field])){result[field]=suggested[field];filled=true;}
    if(filled)result.source={...(row.source||{}),file:row.source?.file||null,status:'pending-review',note:suggested.source.note,lastVerified:null};
    return result;
  }
  globalThis.ScavVendorStock={defaults,fillMissing};
})();
