// Private local Ammo drafts. Public records are only used as the initial seed.
(() => {
 const $=id=>document.getElementById(id),E=ScavEditor;
 const cloud=ScavProductionEditor.enabled?ScavProductionEditor.create("ammo"):null;
 let state=null,selectedId=null,limit=40,session='',inventory=null,busy=false,pending=null;
 const search=E.field($('filters'),'Search ammo','search','',200);
 const category=E.selectField($('filters'),'Ammo class / type','category',[['all','All categories']],'all');
 const visibility=E.selectField($('filters'),'Ammo state','visibility',[['active','Active ammo'],['all','Include archived'],['hidden','Hidden ammo'],['archived','Archived ammo']],'active');
 const label=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,s=>s.toUpperCase());
 const text=value=>value===null||value===undefined?'Not recorded':Array.isArray(value)?(value.length?value.map(text).join('\n'):'None recorded'):typeof value==='object'?(Object.entries(value).map(([key,v])=>label(key)+': '+text(v)).join('\n')||'None recorded'):typeof value==='boolean'?(value?'Yes':'No'):String(value);
 const chosen=()=>state?.catalogue.data.find(r=>r.id===selectedId);
 function paragraph(parent,value){const p=document.createElement('p');p.className='ammo-dialog-text';p.textContent=value;parent.append(p);}
 function inspect(kind){
  const r=chosen();if(!r)return;
  scavEditorDialog({title:kind==='evidence'?'Recorded evidence':'Verification details',submit:'Close',build:({body})=>{
   if(kind==='evidence'){
    paragraph(body,'Recorded evidence belongs to this ammo. Review the original references before making a verification decision.');
    paragraph(body,'Source: '+text(r.source));paragraph(body,'Evidence: '+text(r.evidence));paragraph(body,'File reference: '+text(r.file));
    const paths=new Set();
    function collect(value){if(typeof value==='string'&&safeImage(value))paths.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
    collect(r.source);collect(r.evidence);collect(r.file);
    for(const path of paths){const a=document.createElement('a');a.href='/'+path;a.textContent='Open evidence: '+path;a.target='_blank';a.rel='noopener';a.className='ammo-evidence-link';body.append(a);}
    if(!paths.size)paragraph(body,'No accessible local evidence image is recorded. Evidence uploads remain in the existing evidence workflow.');
   }else{
    E.verificationInfo(body,ScavVerification.inspect(r,state.settings));
    paragraph(body,r.verification?text(r.verification.history):'No dated verification history recorded. Legacy evidence does not imply current-patch verification.');
   }
  },onSubmit:()=>{}});
 }
 E.button('ammo-evidence','View evidence',()=>inspect('evidence'),$('read-actions'));
 E.button('ammo-verification','View verification',()=>inspect('verification'),$('read-actions'));
 const safeImage=value=>typeof value==='string'&&/^(?:images|evidence-inbox)\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|gif|webp)$/i.test(value)&&!value.split('/').some(p=>p==='.'||p==='..')&&!value.includes('//');
 async function api(body){
  if(cloud)return body?cloud.change(body):cloud.source();
  const response=await fetch('/api/ammo',{method:body?'POST':'GET',headers:{'X-Scav-Session':session,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json();}catch{throw new Error('Private storage is unavailable. Keep your entries and retry.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'Could not save ammo changes.'),{status:response.status});return result;
 }
 function categories(){return [...new Set([...state.categories,...state.catalogue.data.map(r=>r.category).filter(v=>v!==null)])];}
 function refreshCategories(){E.options(category,[['all','All categories'],['unknown','Not recorded'],...categories().map(v=>['value:'+v,v])],category.value);}
 async function change(action,extra={},retry=false){
  if(busy)return;
  const content={action,id:selectedId,revision:state.catalogue.revision??0,...extra};
  if(!retry){
   if(pending&&JSON.stringify(pending.content)!==JSON.stringify(content))throw new Error('Retry the pending save or reload saved ammo before changing these entries.');
   if(!pending)pending={content,body:{...content,requestId:crypto.randomUUID()}};
  }
  busy=true;paint();E.status($('status'),'saving','Private ammo draft');
  try{
   const result=await api(pending.body);E.catalog(result.record.state.data);
   state.catalogue=result.record.state;selectedId=result.record.selectedId;pending=null;
   // Reveal the result even when the previous search/filter would hide it.
   search.value='';category.value='all';visibility.value='all';limit=Math.max(40,state.catalogue.data.findIndex(r=>r.id===selectedId)+1);
   refreshCategories();$('retry').hidden=true;E.status($('status'),'saved',cloud?'Durable private draft':'Private draft on this computer');
  }catch(error){if(error.status===400)pending=null;E.status($('status'),'error',error.message);$('retry').textContent='Reload saved ammo';$('retry').hidden=false;throw error;}
  finally{busy=false;paint();}
 }
 // Typed property controls preserve nulls, numbers, lists and nested legacy values.
 let propertySequence=0;
 function propertyEditor(parent,initial,onDirty,title='Ammo properties',root=true){
  function node(parent,value,title,root=false){
   const wrap=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;wrap.append(legend);parent.append(wrap);
   const type=E.selectField(wrap,'Value type','property-type-'+propertySequence++,(root?[['unknown','Not recorded'],['group','Properties'],['list','List']]:[...(value===undefined?[['missing','Not supplied (leave absent)']]:[]),['unknown','Not recorded'],['text','Text'],['number','Number'],['boolean','Yes / No'],['group','Properties'],['list','List']]),value===undefined?'missing':value===null?'unknown':Array.isArray(value)?'list':typeof value==='object'?'group':typeof value==='string'?'text':typeof value);
   const content=document.createElement('div');content.className='ammo-property-content';wrap.append(content);let get;
   function show(v){
    content.replaceChildren();
    if(type.value==='missing'){get=()=>undefined;return;}
    if(type.value==='unknown'){get=()=>null;return;}
    if(type.value==='group'||type.value==='list'){
     const list=type.value==='list',rows=[];
     function add(key,value){
      const row=document.createElement('div');row.className='ammo-property-row';content.insertBefore(row,addButton);let removed=false;
      const keyField=list?null:E.field(row,'Property name','property-name-'+propertySequence++,key,300,true);
      const read=node(row,value,list?'List entry':'Property value');
      const remove=E.button('','Remove property',()=>{removed=!removed;row.classList.toggle('ammo-property-removed',removed);remove.textContent=removed?'Undo removal':'Remove property';for(const el of row.querySelectorAll('input,select,textarea,button'))if(el!==remove)el.disabled=removed;onDirty();},row);
      rows.push(()=>removed?null:[keyField?.value,read()]);
     }
     const addButton=E.button('',list?'Add list entry':'Add property',()=>{add('',null);onDirty();},content);
     for(const [key,ammo] of Object.entries(v||{}))add(key,ammo);
     get=()=>{const entries=rows.map(read=>read()).filter(Boolean);if(list)return entries.map(([,v])=>v);const names=entries.map(([k])=>k);if(names.some(k=>!k.trim())||new Set(names).size!==names.length)throw new Error('Give each property a unique name.');return Object.fromEntries(entries);};
    }else if(type.value==='boolean'){
     const field=E.selectField(content,'Value','property-value-'+propertySequence++,[['','Not recorded'],['true','Yes'],['false','No']],v===null?'':String(v));get=()=>field.value===''?null:field.value==='true';
    }else{
     const field=E.field(content,'Value','property-value-'+propertySequence++,v??'',10000,false,type.value==='text');
     if(type.value==='number'){field.type='number';field.step='any';}
     get=()=>{if(type.value==='text')return field.value;if(field.value==='')return null;const n=Number(field.value);if(!Number.isFinite(n))throw new Error('Enter a valid property number.');return n;};
    }
   }
   type.onchange=()=>{show(null);onDirty();};show(value);return ()=>get();
  }
  return node(parent,initial,title,root);
 }
 function edit(add=false){
  const r=add?null:chosen();let categoryField,custom,description,name;const facts=[];
  scavEditorDialog({title:add?'Add Ammo':'Edit Ammo',submit:'Save private draft',build:({body,setDirty})=>{
   name=E.field(body,'Ammo name','name',r?.name||'',300,true);
   categoryField=E.selectField(body,'Ammo class / type','ammo-category',[['unknown','Not recorded'],...categories().map(v=>['value:'+v,v]),['custom','New category']],r?.category===null||!r?'unknown':'value:'+r.category);
   custom=E.field(body,'New category name','new-category','',300);custom.parentElement.hidden=true;
   categoryField.onchange=()=>{custom.parentElement.hidden=categoryField.value!=='custom';custom.required=categoryField.value==='custom';};
   description=E.field(body,'Description','description',r?.description??'',10000,false,true);
   paragraph(body,'Keep source values as recorded. Damage may be text such as 6 x 5 = 30; negative penetration and zero are valid. Not supplied leaves a missing fact absent; Not recorded stores an unknown value.');
   for(const key of state.factFields||[])facts.push([key,propertyEditor(body,r?.[key],setDirty,label(key),false)]);
  },onSubmit:()=>change(add?'add':'edit',{details:{name:name.value,category:categoryField.value==='unknown'?null:categoryField.value==='custom'?custom.value:categoryField.value.slice(6),description:description.value===''?(r?.description===''?'':null):description.value,facts:Object.fromEntries(facts.map(([key,read])=>[key,read()]).filter(([,value])=>value!==undefined))}})});
 }
 function confirm(action,title,message,extra={}){E.confirm({title,message,submit:'Save private draft',onConfirm:()=>change(action,extra)});}
 function review(){
  const r=chosen();let decision;
  scavEditorDialog({title:'Review Ammo verification',submit:'Record review',build:({body})=>{
   E.verificationInfo(body,ScavVerification.inspect(r,state.settings));
   paragraph(body,'Record your explicit review of '+r.name+' for patch '+(state.settings.current_patch_id||'not configured')+'. The server records your identity and time. This saves privately and does not publish. Editing facts or the image requires a new review.');
   decision=E.selectField(body,'Review decision','decision',[['unverified','Unverified'],...(state.settings.current_patch_id?[['verified','Verified for current patch']]:[])],'unverified');
  },onSubmit:()=>change('verify',{decision:decision.value,patchId:state.settings.current_patch_id,confirmId:r.id})});
 }
 E.button('ammo-add','+ Add Ammo',()=>edit(true),$('add-actions'));
 E.button('ammo-edit','Edit',()=>edit(),$('ammo-actions'));
 E.button('ammo-image-action','Image',()=>E.imagePicker({inventory,current:safeImage(chosen().image)?chosen().image:null,title:'Ammo image',onSubmit:image=>change('image',{image})}),$('ammo-actions'));
 E.button('ammo-duplicate','Duplicate',()=>confirm('duplicate','Duplicate '+chosen().name,'Create a hidden copy with a fresh ammo reference. Evidence remains provenance only; verification history starts empty.'),$('ammo-actions'));
 E.button('ammo-visibility','Hide',()=>confirm('visibility',(chosen().hidden?'Show ':'Hide ')+chosen().name,'Change visibility in this private draft only. The ammo is retained.'),$('ammo-actions'));
 E.button('ammo-archive','Archive',()=>{const r=chosen();confirm(r.archived?'restore':'archive',(r.archived?'Restore ':'Archive ')+r.name,r.archived?'Return this ammo to the active draft list.':'Archive this ammo in the private draft? All its information is retained and you can restore it.',{confirmId:r.id});},$('ammo-actions'));
 E.button('ammo-review','Record verification',review,$('ammo-actions'));
 E.button('retry-save','Retry pending save',()=>change(null,{},true).catch(()=>{}),$('add-actions')).hidden=true;
 function details(){
  const r=chosen();$('detail').hidden=!r;if(!r)return;
  $('ammo-name').textContent=r.name;$('ammo-state').textContent=r.archived?'Archived ammo':r.hidden?'Hidden ammo':'Active ammo';
  const img=$('ammo-image');img.hidden=true;img.removeAttribute('src');img.alt=r.name;
  $('image-note').textContent=r.image?'Image reference: '+r.image:'No image recorded.';
  // Only same-origin relative image references; never load external URLs from records.
  if(typeof r.image==='string'&&/^(?:images|evidence-inbox)\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|gif|webp)$/i.test(r.image)&&!r.image.split('/').some(p=>p==='.'||p==='..')&&!r.image.includes('//')){
   img.onload=()=>{img.hidden=false;$('image-note').textContent='';};img.onerror=()=>{img.hidden=true;$('image-note').textContent='Image unavailable. Recorded reference: '+r.image;};img.src=r.image;
  }
  $('facts').replaceChildren();
  const fields=[['Ammo reference',r.id],['Category',r.category],['Description',r.description],['Damage',r.damage],['Penetration (%)',r.penetrationPercent],['Notes',r.notes],['Rank',r.rank],['Estimated price',r.estimatedPrice],['Maximum stack',r.maxStack],['Created',r.createdAt],['Updated',r.updatedAt]];
  for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text(value);$('facts').append(dt,dd);}
  $('verification').replaceChildren();E.verificationInfo($('verification'),ScavVerification.inspect(r,state.settings));
  $('ammo-visibility').textContent=r.hidden?'Show':'Hide';$('ammo-archive').textContent=r.archived?'Restore':'Archive';
 }
 function paint(){
  if(!state)return;
  const records=state.catalogue.data.filter(r=>E.matches(r.name+' '+r.id,search.value)&&(category.value==='all'||category.value==='unknown'&&r.category===null||category.value==='value:'+r.category)&&(visibility.value==='all'||visibility.value==='active'&&!r.archived||visibility.value==='hidden'&&r.hidden&&!r.archived||visibility.value==='archived'&&r.archived));
  if(!records.some(r=>r.id===selectedId))selectedId=records[0]?.id||null;
  $('count').textContent=records.length?`${records.length} ammo · showing ${Math.min(limit,records.length)}`:'No matching ammo. Change your search or filters.';
  $('ammo-list').replaceChildren();
  for(const r of records.slice(0,limit)){
   const b=E.button('',r.name,()=>{selectedId=r.id;paint();Array.from($('ammo-list').children).find(n=>n.dataset.id===r.id)?.focus();},$('ammo-list'));
   b.className='ammo-choice';b.dataset.id=r.id;b.setAttribute('aria-pressed',String(r.id===selectedId));
   const hint=document.createElement('small');hint.textContent=(r.category||'Category not recorded')+' · '+r.id+(r.archived?' · Archived':r.hidden?' · Hidden':'');b.append(hint);
  }
  $('more').hidden=records.length<=limit;details();
  $('workspace').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy||!!pending);
  const r=chosen();for(const id of ['ammo-edit','ammo-image-action','ammo-duplicate','ammo-visibility','ammo-review'])$(id).disabled=busy||!!pending||!r||r.archived;
  $('ammo-archive').disabled=busy||!!pending||!r;$('retry').disabled=busy;
  $('retry-save').hidden=!pending;$('retry-save').disabled=busy;
 }
 E.search(search,()=>{limit=40;paint();});category.onchange=visibility.onchange=()=>{limit=40;paint();};$('more').onclick=()=>{limit+=40;paint();};
 async function load(){
  state=null;$('workspace').hidden=true;$('retry').hidden=true;$('status').textContent='Loading Ammo catalogue…';$('status').setAttribute('aria-busy','true');
  try{
   if(cloud){const result=await cloud.load();inventory=result.images;state=result;pending=null;refreshCategories();paint();$('workspace').hidden=false;E.status($('status'),'ready','Durable private draft');return;}
   const auth=await fetch('/api/session');if(!auth.ok)throw new Error('Open the private Ammo Editor on this computer.');
   const authResult=await auth.json();if(authResult.mode!=='local'||!authResult.token)throw new Error('Local preview is required.');session=authResult.token;
   const [result,imageResponse]=await Promise.all([api(),fetch('data/site-images.json')]);if(!imageResponse.ok)throw new Error('Could not load the image library.');inventory=await imageResponse.json();
   E.catalog(result.catalogue.data);ScavVerification.patchId(result.settings);result.catalogue.data.forEach(r=>ScavVerification.inspect(r,result.settings));state=result;pending=null;
   refreshCategories();paint();$('workspace').hidden=false;E.status($('status'),'ready','Private draft · changes save after each action');
  }catch(error){state=null;$('status').textContent='Could not load ammo. '+error.message;$('retry').hidden=false;}
  finally{$('status').setAttribute('aria-busy','false');}
 }
 $('retry').onclick=()=>{if(pending)E.confirm({title:'Reload saved ammo?',message:'The pending entries will be discarded. If a save reached storage, the saved result will be loaded. Copy any text you need before continuing.',submit:'Reload saved ammo',onConfirm:load});else load();};
 if(cloud)cloud.onSaved=result=>{if(!state)return;state.catalogue=result.record.state;state.settings=result.settings||state.settings;selectedId=result.record.selectedId;pending=null;refreshCategories();paint();};
 window.addEventListener('beforeunload',event=>{if(pending||busy){event.preventDefault();event.returnValue='';}});load();
})();
