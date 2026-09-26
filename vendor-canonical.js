// Public join: names and verification are resolved from Items on every load.
// No denormalized Item attributes are stored on Vendor Listings.
(function(root){
 function rows(vendorId,listings,items){
  const byId=new Map(items.map(item=>[item.id,item]));
  return (listings?.listings||[]).filter(row=>row.vendorId===vendorId&&!row.archived&&row.entity?.type==='item')
   .map(row=>({listing:row,item:byId.get(row.entity.id)})).filter(({item})=>item&&!item.hidden&&!item.archived)
   .sort((a,b)=>(a.listing.displayOrder??Infinity)-(b.listing.displayOrder??Infinity)||a.listing.id.localeCompare(b.listing.id));
 }
 const api={rows};if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavVendorCanonical=api;
})(globalThis);
