/* Shared, form-based editor. No repository paths or JSON are required to add a record. */
(() => {
  const SB='https://demtoqsafufzmnhvaykj.supabase.co',KEY='sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH';
  const params=new URLSearchParams(location.search);
  const kind=location.pathname.endsWith('items-admin.html')?'items':location.pathname.endsWith('vendors-admin.html')?'vendors':params.get('type')||'weapons';
  const config={
    items:{label:'item',file:'items',fields:[['estimatedPrice','Estimated price','integer'],['rank','Rank','integer'],['maxStack','Maximum stack','integer'],['stackable','Can stack','boolean'],['description','Description','textarea'],['notes','Notes','textarea']]},
    weapons:{label:'weapon',file:'weapons',fields:[['category','Category','suggest'],['tier','Tier','suggest'],['ammo','Ammunition type','suggest'],['damage','Damage','number'],['rpm','Rounds per minute','number'],['range','Range','number'],['accuracy','Accuracy','number'],['recoil','Recoil','number'],['handling','Handling','number'],['ergonomics','Ergonomics','number'],['reload','Reload time','number']]},
    armour:{label:'armour piece',file:'armour',fields:[['category','Category','suggest'],['vendorRank','Vendor rank','text'],['price','Price','integer'],['durability','Durability (%)','number'],['ballistic','Ballistic resistance','number'],['slash','Slash resistance','number'],['radiation','Radiation resistance','number'],['repairClass','Repair class','suggest'],['stackable','Can stack','boolean'],['description','Description','textarea']]},
    ammunition:{label:'ammunition',file:'ammo',fields:[['category','Category','suggest'],['estimatedPrice','Estimated price','integer'],['damage','Damage (for example 30 or 8x12)','text'],['penetrationPercent','Penetration modifier (%)','signed'],['maxStack','Maximum stack','integer'],['description','Description','textarea']]},
    crafting:{label:'recipe',file:'crafting',fields:[['workbench','Workbench','workbench']]},
    vendors:{label:'vendor',file:'vendors',fields:[['location','Location','suggest'],['factionId','Faction','faction'],['inventoryDocumented','Stock list documented','boolean']]},
  }[kind];
  if(!config)return;
  const $=id=>document.getElementById(id), esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const clone=x=>structuredClone(x), equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  let token='',records=[],items=[],factions=[],pictures=[],selected=null,original=null,baseline=null,busy=false,dirty=false,initializing=false,reading=0;
  let stockCatalog={};
  const uploads=new Map(),committedUploads=new Set(),pictureControls=new Map();let ingredients=[],stock=[],shots=[];
  const app=document.querySelector('main');app.className='record-main';
  app.innerHTML='<p id="session-status" class="status" role="status">Open this editor from the <a href="admin.html">Admin Hub</a>.</p><div class="record-layout" id="workspace" hidden><aside class="record-panel"><button id="new-record" type="button" class="primary">Add new '+esc(config.label)+'</button><p><label for="search">Find an existing record</label><input id="search" type="search" placeholder="Search by name"></p><button id="reload-list" type="button">Refresh list</button><p id="count" class="help"></p><div id="record-list" class="record-list"></div></aside><section class="record-panel"><h1 id="title">Choose a record or add a new one</h1><form id="record-form" hidden><div id="form-fields" class="record-grid"></div><div class="actions"><button type="button" id="preview">Preview</button><button type="submit" id="save" class="primary">Save and publish</button></div><p id="message" class="status" role="status" aria-live="polite"></p><section id="preview-panel" class="preview" hidden aria-label="Record preview"></section></form></section></div>';
  if(params.has('embed'))document.body.classList.add('embed');
  async function json(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not load the editor. Please try again.');return d;}
  async function load(){
    const [data,registry,groups,library]=await Promise.all([json('data/'+config.file+'.json',{cache:'no-store'}),json('data/items.json',{cache:'no-store'}),json('data/factions.json'),json('data/admin-images.json')]);
    items=registry.data||registry;records=globalThis.ScavCatalog?ScavCatalog.records(kind,items,data.data||data,{editor:true}):data.data||data;factions=groups.data||groups;pictures=library;
    if(kind==='vendors'){const names=['weapons','armour','ammo'];const datasets=await Promise.all(names.map(name=>json('data/'+name+'.json',{cache:'no-store'}).catch(()=>({data:[]}))));stockCatalog=Object.fromEntries(names.map((name,i)=>[name,datasets[i].data||[]]));}
    renderList();
  }
  async function enter(candidate){
    if(initializing)return;initializing=true;
    try{const ok=await json(SB+'/rest/v1/rpc/is_scavland_admin',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+candidate,'Content-Type':'application/json'},body:'{}'});if(ok!==true)throw new Error('This account cannot edit the website.');token=candidate;if(!$('workspace').hidden)return;await load();$('workspace').hidden=false;$('session-status').textContent='Choose a record to edit, or add a new one. Blank optional fields mean unknown.';}
    catch(error){$('session-status').textContent=error.message;}finally{initializing=false;}
  }
  function renderList(){const q=$('search').value.trim().toLowerCase(),list=records.filter(r=>r.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));$('count').textContent=list.length+' records';$('record-list').innerHTML=list.map(r=>'<button type="button" class="choice '+(selected?.id===r.id?'active':'')+'" data-id="'+esc(r.id)+'">'+esc(r.name)+'</button>').join('');$('record-list').querySelectorAll('button').forEach(b=>b.onclick=()=>open(records.find(r=>r.id===b.dataset.id)));}
  function canLeave(){return !busy&&!reading&&(!dirty||confirm('Discard the changes in this form?'));}
  function options(values,value){return '<option value="">Choose…</option>'+[...new Set(values)].map(v=>'<option value="'+esc(v)+'"'+(String(value)===String(v)?' selected':'')+'>'+esc(String(v).replaceAll('-',' '))+'</option>').join('');}
  function field(key,label,type,value){
    let control;const attrs=' id="f-'+key+'"';
    if(type==='boolean')control='<select'+attrs+'>'+[['','Unknown'],['true','Yes'],['false','No']].map(([v,l])=>'<option value="'+v+'"'+(String(value??'')===v?' selected':'')+'>'+l+'</option>').join('')+'</select>';
    else if(type==='faction')control='<select'+attrs+' required><option value="">Choose a faction</option>'+factions.map(f=>'<option value="'+esc(f.id)+'"'+(value===f.id?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select>';
    else if(type==='suggest' && ['category','tier'].includes(key))control='<select'+attrs+' required>'+options(records.map(r=>r[key]).filter(Boolean),value)+'</select>';
    else if(type==='workbench')control='<select'+attrs+' required>'+options(records.map(r=>r.workbench).filter(Boolean),value)+'</select>';
    else if(type==='textarea')control='<textarea'+attrs+' rows="3">'+esc(value)+'</textarea>';
    else {const number=['integer','number','signed'].includes(type);control='<input'+attrs+' type="'+(number?'number':'text')+'"'+(number?' step="'+(type==='integer'?'1':'any')+'"'+(type!=='signed'?' min="0"':''):'')+' value="'+esc(value)+'"'+(type==='suggest'?' list="suggest-'+key+'"':'')+'>';if(type==='suggest')control+='<datalist id="suggest-'+key+'">'+options(records.map(r=>r[key]).filter(Boolean),value)+'</datalist>';}
    return '<label class="record-field '+(type==='textarea'?'record-wide':'')+'" for="f-'+key+'">'+esc(label)+control+'</label>';
  }
  function sourceForm(source){return '<details class="record-wide" id="evidence-details"><summary>Evidence and verification</summary><p class="help">A picture alone does not verify its stats. Only mark verified when the screenshot supports the values you entered.'+(kind==='armour'?' Armour evidence must show 100% durability.':'')+'</p><div class="record-grid"><label class="record-field">Verification<select id="evidence-status">'+options(['pending-review','unverified','user-provided','screenshot-verified','not-verified','existing-site-data',source?.status].filter(Boolean),source?.status||'pending-review')+'</select></label><label class="record-field">Date checked<input id="evidence-date" type="date" value="'+esc(source?.lastVerified)+'"></label><label class="record-field record-wide">Evidence notes<textarea id="evidence-note" rows="3">'+esc(source?.note)+'</textarea></label><div class="record-wide" id="evidence-picture"></div></div></details>';}
  function open(record){
    if(!canLeave())return;
    selected=record?clone(record):{name:'',source:{file:null,status:'pending-review',note:null},...(kind==='vendors'?{inventory:[],inventoryDocumented:false,portrait:null}:{})};original=record&&!record._catalogOnly?clone(record):null;uploads.clear();committedUploads.clear();pictureControls.clear();dirty=false;
    ingredients=clone(selected.ingredients||[]);stock=clone(selected.inventory||[]);shots=clone(selected.shopEvidence?.screenshots||[]);
    $('title').textContent=record?'Edit '+record.name:'Add new '+config.label;
    let html='<label class="record-field record-wide">Name<input id="f-name" required maxlength="160" value="'+esc(selected.name)+'"></label>';
    if(!record&&['weapons','armour','ammunition','crafting'].includes(kind))html+='<p class="help record-wide">A matching Items entry is created automatically. If this name already exists in Items, it will be linked.</p>';
    if(kind==='items')html+='<fieldset class="record-wide"><legend>Item type</legend><p class="help">Tags control where this item appears: weapon → Weapons; armour → Armour; ammunition → Ammo; crafted item → Crafting; crafting resource → Crafting materials; vendor item → Vendor items; junk item → Junk loot. Add specialist stats or a recipe later in its editor. A vendor item is stock, not a new vendor.</p><div class="checks">'+['weapon','armour','ammunition','crafted-item','crafting-resource','vendor-item','junk-item'].map(c=>'<label><input type="checkbox" name="classification" value="'+c+'"'+(selected.classification?.includes(c)?' checked':'')+'> '+esc(c.replaceAll('-',' '))+'</label>').join('')+'</div></fieldset>';
    html+=config.fields.map(([k,l,t])=>field(k,l,t,selected[k]??(k==='inventoryDocumented'?false:null))).join('');
    html+='<fieldset class="record-wide"><legend>'+(kind==='vendors'?'Portrait':'Picture')+'</legend><div id="main-picture"></div>'+(kind==='vendors'?'<details><summary>Adjust portrait crop</summary><div class="record-grid">'+[['x','Left edge'],['y','Top edge'],['size','Square size'],['sourceWidth','Picture width']].map(([k,l])=>field('crop-'+k,l+' (pixels)','integer',k==='sourceWidth'?selected.portrait?.sourceWidth:selected.portrait?.crop?.[k])).join('')+'</div></details><div id="crop-preview" class="crop-preview" hidden><img alt="Portrait preview"></div>':'')+'</fieldset>';
    if(kind==='crafting')html+='<fieldset class="record-wide"><legend>Ingredients</legend><div id="ingredients"></div><button id="add-ingredient" type="button">Add ingredient</button></fieldset>';
    if(kind==='vendors')html+='<fieldset class="record-wide"><legend>Stock list</legend><p class="help">Search all items, weapons, attachments and armour. Selecting one fills its recorded name, price, rank and details; you can adjust the values for this vendor. Adding a portrait or shop picture does not verify these stock rows.</p><div id="stock"></div><button id="add-stock" type="button">Add stock item</button></fieldset><details class="record-wide"><summary>Shop screenshots</summary><p class="help">Existing review details are preserved. New screenshots are added as pending review.</p><div id="shots"></div><button id="add-shot" type="button">Add shop screenshot</button></details>';
    html+=sourceForm(selected.source);
    $('form-fields').innerHTML=html;$('record-form').hidden=false;$('message').textContent='';$('preview-panel').hidden=true;
    picture('main-picture',kind==='vendors'?selected.portrait?.file:selected.image,'Choose picture',kind==='vendors');picture('evidence-picture',selected.source?.file,'Supporting screenshot');
    if(kind==='crafting'){renderIngredients();$('add-ingredient').onclick=()=>{readIngredients();ingredients.push({itemId:'',name:'',quantity:1});renderIngredients();changed();};}
    if(kind==='vendors'){renderStock();renderShots();$('add-stock').onclick=()=>{readStock();stock.push({itemId:'',name:'',rank:'',price:null,details:''});renderStock();changed();};$('add-shot').onclick=()=>{readShots();shots.push({file:null,association:'pending-review'});renderShots();changed();};}
    baseline=collect();renderList();cropPreview();if(kind==='vendors')fillMissingStock();
  }
  function picture(id,value,label,portrait=false){
    const holder=$(id),state={value:value||null};pictureControls.set(id,state);
    const list=[...new Set([...pictures,value,...uploads.keys()].filter(Boolean))].sort();
    holder.className='picture';holder.innerHTML='<label>'+esc(label)+'<select aria-label="'+esc(label)+'"><option value="">No picture</option>'+list.map(p=>'<option value="'+esc(p)+'"'+(p===value?' selected':'')+'>'+esc(p.split('/').pop().replaceAll('__',' · ').replaceAll('-',' '))+'</option>').join('')+'</select></label><label>Or paste a GitHub picture path<input class="picture-path" type="text" placeholder="images/items/example.png" value="'+esc(value)+'" spellcheck="false"></label><span class="help">Use a path starting with images/ or evidence-inbox/. You can also paste a GitHub file link from this repository.</span><span class="path-status help" role="status"></span><label>Or upload from your device<input type="file" accept="image/png,image/jpeg,image/webp"></label><span class="help">PNG, JPG or WebP, up to 5 MB. Uploaded when you save.</span><img alt="Selected picture"'+(!value?' hidden':'')+'>';
    const select=holder.querySelector('select'),img=holder.querySelector('img'),pathInput=holder.querySelector('.picture-path'),pathStatus=holder.querySelector('.path-status');state.select=select;
    function show(){pathInput.value=state.value||'';pathInput.setCustomValidity('');pathStatus.textContent='';img.hidden=!state.value;if(state.value)img.src=uploads.get(state.value)?.url||state.value;else img.removeAttribute('src');}
    img.onload=()=>{pathStatus.textContent='Picture preview loaded.';};
    img.onerror=()=>{if(state.value)pathStatus.textContent='Preview unavailable. Check the path, or wait for a recent GitHub upload to publish. The file will also be checked when saving.';};
    pathInput.oninput=()=>{
      let path=pathInput.value.trim();
      try{
        if(/^https?:/i.test(path)){
          const url=new URL(path),prefix=url.hostname==='github.com'?'/scavlandfanbase/scavlandfanbase.github.io/blob/main/':url.hostname==='raw.githubusercontent.com'?'/scavlandfanbase/scavlandfanbase.github.io/main/':null;
          if(!prefix||!url.pathname.startsWith(prefix))throw new Error('Use a file link from this repository on the main branch.');
          path=decodeURIComponent(url.pathname.slice(prefix.length));
        }
        if(path&&(!/^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i.test(path)||path.includes('..')))throw new Error('Use an images/ or evidence-inbox/ path ending in .png, .jpg, .jpeg or .webp.');
        if(path&&![...select.options].some(o=>o.value===path))select.add(new Option(path.split('/').pop(),path));
        state.value=path||null;select.value=path;show();sizePortrait();changed();
      }catch(error){pathInput.setCustomValidity(error.message);pathStatus.textContent=error.message;}
    };
    show();
    async function sizePortrait(){if(!portrait||!state.value)return;try{await img.decode();$('f-crop-x').value=0;$('f-crop-y').value=0;$('f-crop-size').value=Math.min(img.naturalWidth,img.naturalHeight);$('f-crop-sourceWidth').value=img.naturalWidth;cropPreview();changed();}catch{$('message').textContent='Could not load this picture. Choose another.';}}
    select.onchange=()=>{state.value=select.value||null;show();sizePortrait();changed();};
    holder.querySelector('input[type=file]').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('message').textContent='Choose a PNG, JPG or WebP picture up to 5 MB.';e.target.value='';return;}reading++;$('save').disabled=true;try{const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const path='evidence-inbox/admin/'+(slug($('f-name').value)||'picture')+'-'+crypto.randomUUID()+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type]);uploads.set(path,{path,content:url.split(',')[1],url});for(const control of pictureControls.values())control.select?.add(new Option(file.name,path));select.value=path;state.value=path;show();await sizePortrait();changed();}catch{$('message').textContent='This picture could not be read. Please choose it again.';}finally{reading--;if(!reading&&!busy)$('save').disabled=false;}};
  }
  function itemSelect(id,query=''){return '<select class="item-select" aria-label="Item" required><option value="">Choose an item</option>'+items.filter(i=>i.id===id||i.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>'<option value="'+esc(i.id)+'"'+(i.id===id?' selected':'')+'>'+esc(i.name)+'</option>').join('')+'</select>';}
  function readIngredients(){if(!$('ingredients'))return;ingredients=[...$('ingredients').children].map((el,i)=>({...ingredients[i],itemId:el.querySelector('select').value,name:items.find(x=>x.id===el.querySelector('select').value)?.name||'',quantity:Number(el.querySelector('input').value)}));}
  function renderIngredients(){$('ingredients').innerHTML=ingredients.map(row=>'<div class="row">'+itemSelect(row.itemId)+'<label>Quantity<input type="number" min="1" step="1" required value="'+esc(row.quantity)+'"></label><button type="button">Remove</button></div>').join('');$('ingredients').querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{readIngredients();ingredients.splice(i,1);renderIngredients();changed();});}
  function readStock(){if(!$('stock'))return;stock=[...$('stock').children].map((el,i)=>({...stock[i],itemId:el.querySelector('select').value,name:items.find(x=>x.id===el.querySelector('select').value)?.name||'',rank:el.querySelector('.rank').value.trim(),price:el.querySelector('.price').value===''?null:Number(el.querySelector('.price').value),details:el.querySelector('.details').value.trim()}));}
  function fillMissingStock(){
    readStock();const before=clone(stock);
    stock=stock.map(row=>ScavVendorStock.fillMissing(row,items.find(item=>item.id===row.itemId),stockCatalog,records));
    if(!equal(before,stock)){if(stock.some(row=>row.itemId))$('f-inventoryDocumented').value='true';renderStock();changed();$('message').textContent='Missing stock values filled from the database. Review them, then save.';}
  }
  function renderStock(){
    $('stock').innerHTML=stock.map(row=>'<div class="row stock-row"><div class="record-field"><label>Find an item<input type="search" class="stock-search" placeholder="Search any item, weapon, attachment or armour"></label>'+itemSelect(row.itemId)+'</div><label>Unlock rank<input class="rank" value="'+esc(row.rank)+'"></label><label>Price<input type="number" min="0" step="1" class="price" value="'+esc(row.price)+'"></label><label class="record-wide">Details<input class="details" value="'+esc(row.details)+'"></label><span class="help record-wide">'+esc(row.source?.status==='screenshot-verified'?'Existing screenshot evidence retained':row.source?.note||'Needs verification')+'</span><button type="button">Remove</button></div>').join('');
    [...$('stock').children].forEach((el,i)=>{
      const select=el.querySelector('select');
      el.querySelector('.stock-search').oninput=e=>{const holder=document.createElement('div');holder.innerHTML=itemSelect(select.value,e.target.value);select.innerHTML=holder.firstElementChild.innerHTML;};
      select.onchange=()=>{readStock();stock[i]=ScavVendorStock.defaults(items.find(item=>item.id===select.value),stockCatalog,records);if(stock[i].itemId)$('f-inventoryDocumented').value='true';renderStock();changed();};
      el.querySelector('button').onclick=()=>{readStock();stock.splice(i,1);renderStock();changed();};
    });
  }
  function readShots(){shots=shots.map((s,i)=>({...s,file:pictureControls.get('shot-'+i)?.value||null}));}
  function renderShots(){for(const key of pictureControls.keys())if(key.startsWith('shot-'))pictureControls.delete(key);$('shots').innerHTML=shots.map((_,i)=>'<div class="record-panel"><div id="shot-'+i+'"></div><button type="button">Remove screenshot</button></div>').join('');shots.forEach((s,i)=>picture('shot-'+i,s.file,'Shop screenshot '+(i+1)));$('shots').querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{readShots();shots.splice(i,1);renderShots();changed();});}
  function collect(){
    const next={name:$('f-name').value.trim()};
    for(const [k,,type]of config.fields){const v=$('f-'+k).value.trim();next[k]=type==='boolean'?(v===''?null:v==='true'):['integer','number','signed'].includes(type)?(v===''?null:Number(v)):(v||(['location','vendorRank'].includes(k)?'':null));}
    if(kind==='items')next.classification=[...document.querySelectorAll('[name=classification]:checked')].map(e=>e.value);
    const img=pictureControls.get('main-picture')?.value||null;
    if(kind==='vendors') {
      readStock();readShots();next.inventory=clone(stock);
      next.portrait=img?{...(selected.portrait||{}),file:img,sourceWidth:Number($('f-crop-sourceWidth').value),crop:{x:Number($('f-crop-x').value),y:Number($('f-crop-y').value),size:Number($('f-crop-size').value)}}:null;
      const existing=selected.shopEvidence;
      next.shopEvidence=equal(shots,existing?.screenshots||[])?existing??null:{...(existing||{}),status:'pending-review',screenshots:clone(shots),pricesVerified:false,unlockRanksVerified:false};
    }else next.image=img;
    if(kind==='crafting'){readIngredients();next.ingredients=clone(ingredients);}
    next.source={...(selected.source||{}),file:pictureControls.get('evidence-picture')?.value||null,status:$('evidence-status').value||'pending-review',note:$('evidence-note').value.trim()||null,lastVerified:$('evidence-date').value||null};
    return next;
  }
  function changed(){if(!selected||busy)return;dirty=!equal(collect(),baseline);$('message').textContent=dirty?'Changes have not been saved.':'';if(!$('preview-panel').hidden)preview();cropPreview();}
  function cropPreview(){if(kind!=='vendors'||!$('crop-preview'))return;const frame=$('crop-preview'),p=collect().portrait;frame.hidden=!p||!p.crop.size||!p.sourceWidth;if(frame.hidden)return;const img=frame.querySelector('img');img.src=uploads.get(p.file)?.url||p.file;img.style.width=180*p.sourceWidth/p.crop.size+'px';img.style.left=-180*p.crop.x/p.crop.size+'px';img.style.top=-180*p.crop.y/p.crop.size+'px';}
  function preview(){const data=collect(),panel=$('preview-panel');panel.hidden=false;const image=kind==='vendors'?data.portrait?.file:data.image;panel.innerHTML='<h2>'+esc(data.name||'Unnamed '+config.label)+'</h2>'+(image?'<img alt="Record picture" src="'+esc(uploads.get(image)?.url||image)+'">':'')+'<dl>'+config.fields.filter(([k])=>data[k]!==null&&data[k]!=='').map(([k,label])=>'<dt>'+esc(label)+'</dt><dd>'+esc(k==='factionId'?factions.find(f=>f.id===data[k])?.name:data[k])+'</dd>').join('')+'</dl>'+(kind==='crafting'?'<h3>Ingredients</h3><ul>'+data.ingredients.map(r=>'<li>'+esc(r.name||'Choose an item')+' × '+esc(r.quantity)+'</li>').join('')+'</ul>':'')+(kind==='vendors'?'<h3>Stock</h3><ul>'+data.inventory.map(r=>'<li>'+esc(r.name||'Choose an item')+' — '+esc(r.price??'Unknown price')+'</li>').join('')+'</ul>':'')+'<p class="help">Evidence: '+esc(data.source.status.replaceAll('-',' '))+'. This preview has not been published.</p>';}
  async function save(event){
    event.preventDefault();if(busy||reading||!token)return;
    const next=collect(),changes=original?Object.fromEntries(Object.entries(next).filter(([k,v])=>!equal(v,baseline[k]))):next;
    if(!Object.keys(changes).length){$('message').textContent='No changes to save.';return;}
    if(!slug(next.name)){$('message').textContent='Enter a name containing letters or numbers.';return;}
    if(!original&&records.some(r=>r.id!==selected.id&&slug(r.name)===slug(next.name))){$('message').textContent='This name already exists. Find it in the list and edit it instead.';return;}
    const refs=new Set();function find(value){if(typeof value==='string')refs.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(find);}find(changes);
    const attachments=[...uploads.values()].filter(u=>refs.has(u.path)&&!committedUploads.has(u.path)).map(({path,content})=>({path,content}));
    const body={kind,id:selected.id,create:!original,original,changes,uploads:attachments};
    busy=true;document.querySelectorAll('#record-form input,#record-form select,#record-form textarea,#record-form button,#new-record,#reload-list').forEach(e=>e.disabled=true);$('message').textContent='Saving your changes…';
    try{
      const endpoint=kind==='items'?'publish-item':kind==='vendors'?'publish-vendor':'publish-specialist';
      const response=await json(SB+'/functions/v1/'+endpoint,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!response.record)throw new Error('The publishing service needs updating. Keep this form open and contact the site maintainer.');
      selected=clone(response.record);original=clone(response.record);if(kind==='vendors'){stock=clone(selected.inventory||[]);renderStock();$('f-inventoryDocumented').value=String(selected.inventoryDocumented);}if(!$('preview-panel').hidden)preview();$('evidence-status').value=selected.source?.status||'pending-review';baseline=collect();dirty=false;
      const index=records.findIndex(r=>r.id===selected.id);if(index<0)records.push(clone(selected));else records[index]=clone(selected);
      for(const attachment of attachments){committedUploads.add(attachment.path);if(!pictures.includes(attachment.path))pictures.push(attachment.path);}
      if(kind==='items'){const i=items.findIndex(r=>r.id===selected.id);if(i<0)items.push(clone(selected));else items[i]=clone(selected);}
      else if(kind!=='vendors'&&!items.some(r=>r.id===selected.id))items.push({id:selected.id,name:selected.name});
      $('title').textContent='Edit '+selected.name;renderList();$('message').textContent=response.unchanged?'Already saved.':'Saved and published. The public website may take a minute or two to update.';
      // A later save uses the saved record ID, never the create path again.
      if(parent!==window)parent.postMessage({type:'scavland-record-saved',kind},location.origin);
    }catch(error){$('message').textContent=error.message;}
    finally{busy=false;document.querySelectorAll('#record-form input,#record-form select,#record-form textarea,#record-form button,#new-record,#reload-list').forEach(e=>e.disabled=false);}
  }
  $('search').oninput=renderList;$('new-record').onclick=()=>open(null);$('preview').onclick=preview;$('record-form').onsubmit=save;
  $('record-form').addEventListener('input',changed);$('record-form').addEventListener('change',changed);
  $('reload-list').onclick=async()=>{if(!canLeave())return;try{await load();dirty=false;if(original)open(records.find(r=>r.id===original.id));$('session-status').textContent='List refreshed. Recent changes may take a minute or two to appear.';}catch(error){$('session-status').textContent=error.message;}};
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='scavland-admin-token'&&typeof e.data.token==='string')enter(e.data.token);});
  if(parent!==window)parent.postMessage({type:'scavland-admin-ready'},location.origin);
})();
