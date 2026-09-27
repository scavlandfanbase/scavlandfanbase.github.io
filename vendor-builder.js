// Private local vendor drafts and isolated listings.
(() => {
 const $=id=>document.getElementById(id),E=ScavEditor;
 const cloud=ScavProductionEditor.enabled?ScavProductionEditor.create('vendors'):null;
 let state=null,session='',factions=[],inventory=null,busy=false;
 const picker=E.selectField($('selection'),'Selected Vendor','vendor',[],'');
 const selected=()=>state?.data.find(v=>v.id===picker.value);
 const listings=ScavVendorInventory({state:()=>state,vendor:selected,session:()=>session,catalogSource:cloud?()=>cloud.source():null,change:(operation,extra)=>change('inventory',{operation,...extra})});
 const visible=()=>state.data.filter(v=>$('show-archived').checked||!v.archived);
 async function api(body){
  if(cloud)return body?cloud.change(body):(await cloud.source()).catalogue;
  const response=await fetch('/api/vendors',{method:body?'POST':'GET',headers:{'X-Scav-Session':session,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json();}catch{throw new Error('Private storage is unavailable. Keep your entries and try again.');}
  if(!response.ok)throw new Error(result.error||'Could not save vendor changes.');return result;
 }
 function paint(id=picker.value){
  if(!state)return;
  E.options(picker,visible().map(v=>[v.id,(v.archived?'Archived · ':v.hidden?'Hidden · ':'')+v.name]),id);
  const v=selected(),active=state.data.filter(r=>!r.archived),index=active.indexOf(v);
  $('inventory-workspace').inert=busy;
  listings.paint();
  $('workspace').querySelectorAll('button,select,input').forEach(el=>el.disabled=busy);
  picker.disabled=busy||!visible().length;
  ['vendor-edit','vendor-image','vendor-inventory'].forEach(id=>$(id).disabled=busy||!v||!!v.archived);
  $('vendor-more').disabled=busy||!v;
  $('vendor-up').disabled=busy||!v||v.archived||index<=0;
  $('vendor-down').disabled=busy||!v||v.archived||index===active.length-1;
  $('retry').disabled=busy;$('vendor-preview').hidden=!v;
  if(!v){$('status').textContent='No vendors in this view. Add a vendor or include archived vendors.';return;}
  $('vendor-name').textContent=v.name;$('vendor-location').textContent='Location: '+(v.location||'Not recorded');
  $('vendor-faction').textContent='Faction: '+(factions.find(f=>f.id===v.factionId)?.name||v.factionId||'Not recorded');
  $('vendor-state').textContent=v.archived?'Archived draft':v.hidden?'Hidden draft':'Visible draft';
  const image=$('vendor-portrait');image.hidden=!v.portrait?.file;if(v.portrait?.file)image.src=v.portrait.file;else image.removeAttribute('src');image.alt=v.name+' portrait';
 }
 async function change(action,extra={}){
  if(busy)return;
  busy=true;paint();E.status($('status'),'saving','Private vendor draft');
  try{const result=await api({action,id:picker.value,revision:state.revision,...extra});state=result.record.state;paint(result.record.selectedId);E.status($('status'),'saved',cloud?'Durable private draft':'Private draft on this computer');}
  catch(error){E.status($('status'),'error',error.message);$('retry').hidden=false;throw error;}
  finally{busy=false;paint();}
 }
 function details(add=false){
  const v=add?null:selected();
  scavEditorDialog({title:add?'Add Vendor':'Vendor details',submit:'Save private draft',build:({body})=>{
   E.field(body,'Vendor name','name',v?.name||'',160,true);E.field(body,'Location','location',v?.location||'',300);
   const options=[['','Not recorded'],...factions.map(f=>[f.id,f.name])];if(v?.factionId&&!options.some(([id])=>id===v.factionId))options.push([v.factionId,v.factionId]);
   E.selectField(body,'Faction','factionId',options,v?.factionId||'');
  },onSubmit:({form})=>change(add?'add':'edit',{details:Object.fromEntries(new FormData(form))})});
 }
 function confirm(action,title,message,extra={}){E.confirm({title,message,submit:'Save private draft',onConfirm:()=>change(action,extra)});}
 function more(){
  const v=selected();
  scavEditorDialog({title:'More vendor actions',submit:'Close',build:api=>{
   function option(label,action){E.button('',label,()=>{api.close();action();},api.body);}
   if(v.archived){option('Restore',()=>confirm('restore','Restore '+v.name,'Return this vendor to the active draft list.'));return;}
   option('Duplicate',()=>confirm('duplicate','Duplicate '+v.name,'Copy details and portrait to a new hidden vendor. Inventory will be empty and verification will start as pending review.'));
   option(v.hidden?'Show':'Hide',()=>confirm('visibility',(v.hidden?'Show ':'Hide ')+v.name,'Change visibility in this private draft only.'));
   option('Archive',()=>confirm('archive','Archive '+v.name,'Remove this vendor from the active draft list. Its data and inventory are retained. Include archived vendors to restore it.',{confirmId:v.id}));
  },onSubmit:()=>{}});
 }
 E.button('vendor-up','↑',()=>change('move',{direction:-1}).catch(()=>{}),$('selection'),'Move vendor up');
 E.button('vendor-down','↓',()=>change('move',{direction:1}).catch(()=>{}),$('selection'),'Move vendor down');
 E.button('vendor-edit','Edit',()=>details(),$('actions'));
 E.button('vendor-image','Image',()=>E.imagePicker({inventory,current:selected().portrait?.file||null,title:'Vendor image',onSubmit:image=>change('image',{image})}),$('actions'));
 E.button('vendor-inventory','Inventory',()=>listings.open(),$('actions'));
 E.button('vendor-more','•••',more,$('actions'),'More vendor actions');
 E.button('vendor-add','+ Add Vendor',()=>details(true),$('add-actions'));
 picker.onchange=()=>paint();$('show-archived').onchange=()=>paint();
 async function load(){
  $('retry').hidden=true;$('local-link').hidden=true;$('workspace').hidden=true;$('inventory-workspace').hidden=true;$('status').textContent='Loading private vendor drafts…';
  try{
   if(cloud){const saved=await cloud.load();factions=saved.factions;inventory=saved.images;state=saved.catalogue;E.catalog(state.data);paint();$('workspace').hidden=false;E.status($('status'),'ready','Durable private draft');return;}
   const response=await fetch('/api/session');if(!response.ok)throw new Error('Local storage is unavailable.');
   const auth=await response.json();if(auth.mode!=='local'||!auth.token)throw new Error('Open the local Vendor Editor.');session=auth.token;
   const [saved,factionResponse,imageResponse]=await Promise.all([api(),fetch('data/factions.json'),fetch('data/site-images.json')]);
   if(!factionResponse.ok||!imageResponse.ok)throw new Error('Could not load factions or the image library.');
   factions=(await factionResponse.json()).data;inventory=await imageResponse.json();state=saved;
   E.catalog(state.data);paint();$('workspace').hidden=false;E.status($('status'),'ready','Private draft — changes save after each action');
  }catch(error){$('status').textContent='Could not load private vendor drafts. '+error.message;$('retry').hidden=false;$('local-link').hidden=!['127.0.0.1','localhost'].includes(location.hostname);}
 }
 if(cloud)cloud.onSaved=result=>{state=result.record.state;paint(result.record.selectedId);};
 $('retry').onclick=()=>{if(cloud?.hasPending())E.confirm({title:'Reload saved Vendors?',message:'Download pending entries first if you need them. Reloading discards this pending action and loads the saved draft.',submit:'Reload saved Vendors',onConfirm:load});else load();};load();
})();
