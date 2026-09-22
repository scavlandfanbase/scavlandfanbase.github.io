import '../../../vendor-stock.js';
// All database editors publish one Git commit, including images and linked records.
export const paths = {items:'data/items.json',weapons:'data/weapons.json',armour:'data/armour.json',ammunition:'data/ammo.json',crafting:'data/crafting.json',vendors:'data/vendors.json'};
const sharedFields = ['name','image','description','estimatedPrice','maxStack','stackable','notes'];
const fields = {
  items:[...sharedFields,'classification','rank','effects','source'],
  weapons:['name','category','tier','ammo','damage','rpm','range','accuracy','recoil','handling','ergonomics','reload','image','source'],
  armour:['name','category','vendorRank','price','durability','ballistic','slash','radiation','repairClass','image','stackable','description','source'],
  ammunition:['name','category','estimatedPrice','description','damage','penetrationPercent','maxStack','image','source'],
  crafting:['name','workbench','ingredients','image','source'],
  vendors:['name','location','factionId','inventoryDocumented','inventory','portrait','shopEvidence','source'],
};
const classifications = {weapons:'weapon',armour:'armour',ammunition:'ammunition',crafting:'crafted-item'};
const classes = ['weapon','armour','ammunition','crafted-item','crafting-resource','vendor-item','junk-item'];
const statuses = ['screenshot-verified','unverified','user-provided','pending-review','not-verified','existing-site-data'];
export const slug = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const rows = doc => Array.isArray(doc) ? doc : doc.data;
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
export const imagePath = value => typeof value === 'string' && /^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes('..');
function sourceCheck(source, original, kind, record, files) {
  if (same(source, original)) return;
  if (source === null) return;
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('Evidence details are invalid.');
  if (!statuses.includes(source.status)) fail('Choose an evidence status.');
  if (source.note != null && typeof source.note !== 'string') fail('Evidence notes must be text.');
  if (source.lastVerified != null && !/^\d{4}-\d{2}-\d{2}$/.test(source.lastVerified)) fail('Choose a valid verification date.');
  if (source.file && source.file !== original?.file) { if (!imagePath(source.file)) fail('Choose an evidence image.'); files.add(source.file); }
  if (source.status === 'screenshot-verified') {
    if (!imagePath(source.file)) fail('Screenshot verification needs a supporting screenshot.');
    files.add(source.file);
    if (kind === 'armour' && record.durability !== 100) fail('Armour verification requires evidence at 100% durability.');
  }
}
export function prepare(body, docs) {
  const kind=body.kind, changes=body.changes;
  if (!Object.hasOwn(paths,kind) || !changes || typeof changes !== 'object' || Array.isArray(changes)) fail('Invalid record request.');
  if (!Object.keys(changes).length || Object.keys(changes).some(k=>!fields[kind].includes(k))) fail('Unsupported or empty changes.');
  const list=rows(docs[paths[kind]]), items=rows(docs[paths.items]);
  const create=body.create === true;
  let id=body.id || body.itemId || body.vendorId;
  const matchingItem=items.find(x=>slug(x.name)===slug(changes.name));
  if (create) {
    const linkedItem = classifications[kind] ? items.find(item=>item.id===id) || matchingItem : null;
    if (linkedItem && matchingItem && linkedItem.id!==matchingItem.id) fail('Another item already uses this name.',409);
    id = linkedItem ? linkedItem.id : slug(changes.name);
  }
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) fail('Enter a name containing letters or numbers.');
  let previous=list.find(x=>x.id===id);
  if (create && previous) fail('This record already exists. Search for it and edit it instead.',409);
  if (!create && !previous) fail('The record could not be found. Reload the editor.',404);
  if (!create && body.original && !same(previous,body.original)) fail('This record changed since you opened it. Reload it before saving.',409);
  const defaults = kind==='vendors' ? {location:'',inventoryDocumented:false,inventory:[],portrait:null} : kind==='items' ? {classification:[],image:null,notes:null,effects:null} : {};
  const record={...(previous || {id,...defaults,source:{file:null,status:'pending-review',note:null}}),...changes,id};
  if (typeof record.name !== 'string' || !record.name.trim() || record.name.length>160) fail('Enter a name of 160 characters or fewer.');
  record.name=record.name.trim();
  if (list.some(x=>x.id!==id && slug(x.name)===slug(record.name))) fail('A record with this name already exists.',409);
  for (const key of ['category','tier','ammo','vendorRank','repairClass','description','notes','workbench','location','factionId']) if (key in changes && changes[key]!==null && typeof changes[key]!=='string') fail(key+' must be text.');
  for (const key of ['damage','rpm','range','accuracy','recoil','handling','ergonomics','reload','price','durability','ballistic','slash','radiation','estimatedPrice','penetrationPercent','maxStack','rank']) {
    if (!(key in changes) || changes[key]===null) continue;
    const value=changes[key];
    // Ammo damage is text in the canonical data (including multi-projectile values).
    if (kind==='ammunition' && key==='damage') { if (typeof value!=='string' || !/^\d+(?:\.\d+)?(?:\s*[x×]\s*\d+)?$/.test(value)) fail('Ammo damage must be a number or a value such as 8x12.'); continue; }
    if (typeof value!=='number' || !Number.isFinite(value) || (key!=='penetrationPercent' && value<0)) fail(key+' has an invalid number.');
    if (['price','estimatedPrice','maxStack','rank'].includes(key) && !Number.isInteger(value)) fail(key+' must be a whole number.');
  }
  if ('stackable' in changes && changes.stackable!==null && typeof changes.stackable!=='boolean') fail('Choose whether the item stacks.');
  if ('effects' in changes && record.effects!==null) {
    if (!record.effects || typeof record.effects!=='object' || Array.isArray(record.effects)) fail('Item effects are invalid.');
    const allowedEffects=['health','bleed','radiation','hunger','thirst'];
    if (Object.keys(record.effects).some(key=>!allowedEffects.includes(key))) fail('Item effects contain an unsupported field.');
    for (const value of Object.values(record.effects)) if (typeof value!=='number'||!Number.isFinite(value)) fail('Item effects must be numbers.');
  }
  if (kind==='items' && (!Array.isArray(record.classification)||!record.classification.length||record.classification.some(x=>!classes.includes(x)))) fail('Choose at least one item type.');
  if (kind==='crafting' && !['medical','weapon','armour'].includes(record.workbench)) fail('Choose a workbench.');
  if (['weapons','armour'].includes(kind) && !list.some(x=>x.category===record.category)) fail('Choose an existing category.');
  // Changed facts need fresh review; a picture edit alone does not verify stats.
  const factKeys=Object.keys(changes).filter(k=>!['image','notes','source','portrait','shopEvidence'].includes(k));
  if (previous?.source?.status==='screenshot-verified' && !('source' in changes) && factKeys.length) record.source={...record.source,status:'pending-review',lastVerified:null};
  const files=new Set();
  if ('image' in changes && record.image!==null) { if(!imagePath(record.image)) fail('Choose or upload a picture.'); files.add(record.image); }
  if ('source' in changes || create) sourceCheck(record.source,previous?.source,kind,record,files);
  if (kind==='armour' && record.source?.status==='screenshot-verified' && ['ballistic','slash','radiation','durability'].some(k=>k in changes) && record.durability!==100) fail('Verified armour resistance requires 100% durability.');
  if (kind==='crafting') {
    if (!Array.isArray(record.ingredients) || !record.ingredients.length) fail('Add at least one ingredient.');
    for (const row of record.ingredients) {
      const item=items.find(x=>x.id===row.itemId);
      if (!item || !Number.isInteger(row.quantity) || row.quantity<1) fail('Choose an existing ingredient and a positive whole-number quantity.');
      row.name=item.name;
    }
  }
  if (kind==='vendors') {
    if (!rows(docs['data/factions.json']).some(x=>x.id===record.factionId)) fail('Choose a faction.');
    if(typeof record.inventoryDocumented!=='boolean'||!Array.isArray(record.inventory)) fail('Vendor stock is invalid.');
    if ('inventory' in changes || create) {
      const catalog={armour:rows(docs[paths.armour]),ammo:rows(docs[paths.ammunition]),weapons:rows(docs[paths.weapons])};
      record.inventory=record.inventory.map(row=>globalThis.ScavVendorStock.fillMissing(row,items.find(item=>item.id===row.itemId),catalog,rows(docs[paths.vendors])));
      if(record.inventory.length && !('inventoryDocumented' in changes))record.inventoryDocumented=true;
    }
    for (const row of record.inventory) {
      const item=items.find(x=>x.id===row.itemId);
      if(!item||typeof row.rank!=='string'||(row.price!==null&&(!Number.isInteger(row.price)||row.price<0))||typeof row.details!=='string') fail('Choose an item and valid rank, price and details for each stock row.');
      row.name=item.name;
      const oldRow=previous?.inventory?.find(x=>x.itemId===row.itemId);
      if (oldRow?.source?.status==='screenshot-verified' && !same(row,oldRow) && same(row.source,oldRow.source)) row.source={...row.source,status:'pending-review',lastVerified:null};
      sourceCheck(row.source,previous?.inventory?.find(x=>x.itemId===row.itemId)?.source,kind,row,files);
    }
    if ('portrait' in changes && record.portrait) {
      const p=record.portrait,c=p.crop;
      if(!imagePath(p.file)||!c||![c.x,c.y,c.size,p.sourceWidth].every(Number.isInteger)||c.x<0||c.y<0||c.size<1||p.sourceWidth<1||c.x+c.size>p.sourceWidth) fail('Portrait crop must fit the picture.');
      files.add(p.file);
    }
    if ('shopEvidence' in changes && record.shopEvidence) {
      if (!Array.isArray(record.shopEvidence.screenshots)) fail('Shop evidence must contain screenshots.');
      for(const shot of record.shopEvidence.screenshots) {if(!imagePath(shot.file))fail('Choose shop screenshots.');files.add(shot.file);}
      // A gallery or portrait never verifies individual inventory rows.
      for(const key of ['pricesVerified','unlockRanksVerified']) if(record.shopEvidence[key]===true && previous?.shopEvidence?.[key]!==true) fail('Verify individual inventory rows before claiming shop prices or ranks are verified.');
    }
  }
  if(previous) list[list.indexOf(previous)]=record; else list.push(record);
  if (classifications[kind]) {
    let shared=items.find(x=>x.id===id);
    if(!shared) {shared={id,name:record.name,classification:[],image:null,notes:null,source:{file:null,status:'pending-review',note:'Created with the specialist record; shared item evidence awaits review.'}};items.push(shared);}
    shared.classification=[...new Set([...(shared.classification||[]),classifications[kind]])];
    for(const field of sharedFields) if(field in changes && !(create && record[field]==null && shared[field]!=null)) shared[field]=record[field];
  }
  if(kind==='items') for(const other of Object.keys(classifications)) {
    const linked=rows(docs[paths[other]]).find(x=>x.id===id);
    if(linked) for(const field of sharedFields) if(field in changes && fields[other].includes(field)) linked[field]=record[field];
  }
  if(kind!=='vendors' && 'name' in changes) {
    for(const vendor of rows(docs[paths.vendors])) for(const stock of vendor.inventory||[]) if(stock.itemId===id) stock.name=record.name;
    for(const recipe of rows(docs[paths.crafting])) for(const ingredient of recipe.ingredients||[]) if(ingredient.itemId===id) ingredient.name=record.name;
  }
  return {record,files,create};
}

const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const decode = content => new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\n/g,'')),c=>c.charCodeAt(0)));
export function createHandler(endpoint, env, fetcher=fetch) {
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
  const root='https://api.github.com/repos/scavlandfanbase/scavlandfanbase.github.io';
  return async request => {
    if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
    if(request.method!=='POST')return reply({error:'POST is required.'},405);
    try {
      const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),token=env('GITHUB_TOKEN');
      if(!sb||!key||!token)fail('Publish service is not configured.',503);
      const auth=request.headers.get('Authorization')||'';
      if(!auth.startsWith('Bearer '))fail('Sign in to save changes.',403);
      const headers={apikey:key,Authorization:auth,'Content-Type':'application/json'};
      const user=await fetcher(sb+'/auth/v1/user',{headers});
      if(!user.ok)fail('Your session expired. Sign in again; your changes have not been saved.',403);
      let body;try{body=await request.json();}catch{fail('Invalid save request.');}
      if(endpoint==='items'||endpoint==='vendors')body.kind=endpoint;
      else if(!Object.hasOwn(classifications,body.kind))fail('Unknown editor.');
      const permission={items:'items_edit',vendors:'vendors_edit',weapons:'weapons_edit',armour:'armour_edit',ammunition:'ammunition_edit',crafting:'crafting_edit'}[body.kind];
      const admin=await fetcher(sb+'/rest/v1/rpc/has_scavland_permission',{method:'POST',headers,body:JSON.stringify({required_permission:permission})});
      if(!permission||!admin.ok||await admin.json()!==true)fail('You do not have permission to publish from this editor.',403);
      const ghHeaders={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
      async function gh(path,method='GET',data) {
        const r=await fetcher(root+path,{method,headers:ghHeaders,...(data?{body:JSON.stringify(data)}:{})});
        if(!r.ok)fail(method==='PATCH'?'The website changed while saving. Your entries are still here; retry saving.':'Could not save to GitHub. Your entries are still here; please retry.',r.status===409||r.status===422?409:502);
        return r.json();
      }
      const head=await gh('/git/ref/heads/main');
      const base=head.object.sha, commit=await gh('/git/commits/'+base);
      const docs={}, before={};
      await Promise.all([...Object.values(paths),'data/factions.json'].map(async path=>{
        const f=await gh('/contents/'+path+'?ref='+base);
        docs[path]=JSON.parse(decode(f.content));before[path]=JSON.stringify(docs[path]);
      }));
      const result=prepare(body,docs);
      const uploads=body.uploads||[];
      if(!Array.isArray(uploads)||uploads.length>6)fail('Upload at most six pictures per save.');
      const uploadPaths=new Set();let total=0;
      for(const upload of uploads){
        if(!imagePath(upload.path)||!/^evidence-inbox\/admin\/[a-z0-9-]+\.(png|jpg|webp)$/.test(upload.path)||typeof upload.content!=='string'||!result.files.has(upload.path)||uploadPaths.has(upload.path))fail('Invalid picture upload.');
        let bytes;try{bytes=Uint8Array.from(atob(upload.content),c=>c.charCodeAt(0));}catch{fail('Invalid picture encoding.');}
        total+=bytes.length;
        const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
        const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
        if(!bytes.length||bytes.length>5*1024*1024||total>12*1024*1024||!(upload.path.endsWith('.png')?png:upload.path.endsWith('.jpg')?jpg:webp))fail('Use PNG, JPG or WebP pictures up to 5 MB each (12 MB total).');
        uploadPaths.add(upload.path);
      }
      const tree=await gh('/git/trees/'+commit.tree.sha+'?recursive=1');
      if(tree.truncated)fail('Picture index could not be checked completely.',502);
      const existing=new Set(tree.tree.filter(x=>x.type==='blob').map(x=>x.path));
      for(const path of result.files) if(!uploadPaths.has(path)&&!existing.has(path))fail('The selected picture no longer exists. Choose another picture.');
      for(const path of uploadPaths)if(existing.has(path))fail('That upload already exists. Select it from the picture library.',409);
      const entries=[];
      if(uploads.length)entries.push({path:'data/admin-images.json',mode:'100644',type:'blob',content:JSON.stringify([...new Set([...existing].filter(imagePath).concat([...uploadPaths]))].sort(),null,2)+'\n'});
      for(const [path,doc]of Object.entries(docs))if(JSON.stringify(doc)!==before[path])entries.push({path,mode:'100644',type:'blob',content:JSON.stringify(doc,null,2)+'\n'});
      if(!entries.length&&!uploads.length)return reply({record:result.record,unchanged:true});
      for(const upload of uploads){const blob=await gh('/git/blobs','POST',{content:upload.content,encoding:'base64'});entries.push({path:upload.path,mode:'100644',type:'blob',sha:blob.sha});}
      const newTree=await gh('/git/trees','POST',{base_tree:commit.tree.sha,tree:entries});
      const newCommit=await gh('/git/commits','POST',{message:`${result.create?'Add':'Update'} ${body.kind}: ${result.record.name}`,tree:newTree.sha,parents:[base]});
      // Never force: a competing commit leaves all public files untouched.
      await gh('/git/refs/heads/main','PATCH',{sha:newCommit.sha,force:false});
      return reply({record:result.record,sha:newCommit.sha,commitUrl:'https://github.com/scavlandfanbase/scavlandfanbase.github.io/commit/'+newCommit.sha});
    }catch(error){return reply({error:error.status?error.message:'Saving could not finish. Keep this form open and retry; if it already saved, reload the record.'},error.status||502);}
  };
}
