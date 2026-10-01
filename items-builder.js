// Private local Items drafts. Public records are only used as the initial seed.
(() => {
 const $=id=>document.getElementById(id),E=ScavEditor;
 const cloud=ScavProductionEditor.enabled?ScavProductionEditor.create('items'):null;
 let state=null,selectedId=null,limit=40,session='',inventory=null,busy=false,pending=null;
 let visibleRecords=[],queueEnded=false;
 const search=E.field($('filters'),'Search items','search','',200);
 const category=E.selectField($('filters'),'Category','category',[['all','All categories']],'all');
 const visibility=E.selectField($('filters'),'Item state','visibility',[['active','Active items'],['all','Include archived'],['hidden','Hidden items'],['archived','Archived items']],'active');
 const classification=E.selectField($('filters'),'Content filter','content-filter',[['all','All content'],...ScavAttachments.contentTypes.map(t=>[t,t]),['candidates','Potential Attachments (review only)']],'all');
 const attention=E.selectField($('filters'),'Needs attention','attention',[['all','All statuses'],['attention','Needs attention'],['verified','Verified'],['patch-check-needed','Patch Check Needed'],['unverified','Unverified'],['image','Missing image'],['unknown','Missing Information'],['conflict','Classification Conflict']],'all');
 const itemCategories=['Food & Drink','Medical','Repair & Maintenance','Crafting Materials','Tools','Junk','Other'];
 const unknown=v=>v===null||v===undefined||(typeof v==='object'&&Object.values(v).some(unknown));
 const needsInformation=r=>unknown(categoryValue(r))||unknown(r.description)||unknown(r.properties)||(state.factFields||[]).some(k=>Object.hasOwn(r,k)&&unknown(r[k]));
 const categoryValue=r=>ScavAttachments.contentType(r)==='Attachment'?(r.attachmentType==='Unknown'?null:r.attachmentType):r.category;
 const classificationInfo=r=>ScavAttachments.describe(r);
 const specialist=r=>r&&!['Item','Attachment'].includes(ScavAttachments.contentType(r));
 const label=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,s=>s.toUpperCase());
 const text=value=>value===null||value===undefined?'Not recorded':Array.isArray(value)?(value.length?value.map(text).join('\n'):'None recorded'):typeof value==='object'?(Object.entries(value).map(([key,v])=>label(key)+': '+text(v)).join('\n')||'None recorded'):typeof value==='boolean'?(value?'Yes':'No'):String(value);
 const chosen=()=>state?.catalogue.data.find(r=>r.id===selectedId);
 function paragraph(parent,value){const p=document.createElement('p');p.className='item-dialog-text';p.textContent=value;parent.append(p);}
 function inspect(kind){
  const r=chosen();if(!r)return;
  scavEditorDialog({title:kind==='evidence'?'Recorded evidence':'Verification details',submit:'Close',build:({body})=>{
   if(kind==='evidence'){
    paragraph(body,'Recorded evidence belongs to this item. Review the original references before making a verification decision.');
    E.help(body,'Evidence');
    const paths=new Set();
    function collect(value){if(typeof value==='string'&&safeImage(value))paths.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
    collect(r.source);collect(r.evidence);collect(r.file);
    for(const path of paths){const image=document.createElement('img');image.src='/'+path;image.alt='Evidence for '+r.name;image.className='item-evidence-preview';body.append(image);const a=document.createElement('a');a.href='/'+path;a.textContent='Open full-size screenshot';a.target='_blank';a.rel='noopener';a.className='item-evidence-link';body.append(a);}
    const technical=document.createElement('details');technical.className='item-advanced';const summary=document.createElement('summary');summary.textContent='Technical evidence references';technical.append(summary);paragraph(technical,'Source: '+text(r.source));paragraph(technical,'Evidence: '+text(r.evidence));paragraph(technical,'File reference: '+text(r.file));body.append(technical);
    if(!paths.size)paragraph(body,'No accessible local evidence image is recorded. Evidence uploads remain in the existing evidence workflow.');
   }else{
    E.verificationInfo(body,ScavVerification.inspect(r,state.settings));
    paragraph(body,r.verification?text(r.verification.history):'No dated verification history recorded. Legacy evidence does not imply current-patch verification.');
   }
  },onSubmit:()=>{}});
 }
 E.button('item-evidence','View evidence',()=>inspect('evidence'),$('read-actions'));
 E.button('item-verification','View verification',()=>inspect('verification'),$('read-actions'));
 const safeImage=value=>typeof value==='string'&&/^(?:images|evidence-inbox)\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|gif|webp)$/i.test(value)&&!value.split('/').some(p=>p==='.'||p==='..')&&!value.includes('//');
 async function api(body){
  if(cloud)return body?cloud.change(body):cloud.source();
  const response=await fetch('/api/items',{method:body?'POST':'GET',headers:{'X-Scav-Session':session,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json();}catch{throw new Error('Private storage is unavailable. Keep your entries and retry.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'Could not save item changes.'),{status:response.status});return result;
 }
 function categories(record){return [...new Set([...itemCategories,...(record?.category!==null&&record?.category!==undefined?[record.category]:[])])];}
 function refreshCategories(){
  const records=state.catalogue.data.filter(r=>classification.value==='all'||classification.value==='candidates'||classificationInfo(r).type===classification.value);
  const values=[...new Set(records.map(categoryValue).filter(v=>v!==null&&v!==undefined))];
  E.options(category,[['all','All categories'],['unknown','Not recorded'],...values.map(v=>['value:'+v,v])],category.value);
 }
 async function change(action,extra={},retry=false){
  if(busy)return;
  const content={action,id:selectedId,revision:state.catalogue.revision??0,...extra};
  if(!retry){
   if(pending&&JSON.stringify(pending.content)!==JSON.stringify(content))throw new Error('Retry the pending save or reload saved items before changing these entries.');
   if(!pending)pending={content,body:{...content,requestId:crypto.randomUUID()}};
  }
  busy=true;paint();E.status($('status'),'saving','Private item draft');
  try{
   const result=await api(pending.body);E.catalog(result.record.state.data);
   state.catalogue=result.record.state;state.settings=result.settings||state.settings;selectedId=result.record.selectedId;pending=null;queueEnded=false;
   // Reveal the result even when the previous search/filter would hide it.
   search.value='';category.value='all';visibility.value='all';classification.value='all';attention.value='all';limit=Math.max(40,state.catalogue.data.findIndex(r=>r.id===selectedId)+1);
   refreshCategories();$('retry').hidden=true;E.status($('status'),'saved',cloud?'Durable private draft':'Private draft on this computer');
  }catch(error){if(error.status===400&&(!cloud||!cloud.hasPending()))pending=null;E.status($('status'),'error',error.message);$('retry').textContent='Reload saved items';$('retry').hidden=false;throw error;}
  finally{busy=false;paint();}
 }
 // Typed property controls preserve nulls, numbers, lists and nested legacy values.
 function propertyEditor(parent,initial,onDirty,title='Item properties',root=true){
  let sequence=0;
  function node(parent,value,title,root=false){
   const wrap=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;wrap.append(legend);parent.append(wrap);E.help(wrap,title);
   const type=E.selectField(wrap,'Value type','property-type-'+sequence++,(root?[['unknown','Not recorded'],['group','Properties'],['list','List']]:[['unknown','Not recorded'],['text','Text'],['number','Number'],['boolean','Yes / No'],['group','Properties'],['list','List']]),value===null?'unknown':Array.isArray(value)?'list':typeof value==='object'?'group':typeof value==='string'?'text':typeof value);
   const content=document.createElement('div');content.className='item-property-content';wrap.append(content);let get;
   function show(v){
    content.replaceChildren();
    if(type.value==='unknown'){get=()=>null;return;}
    if(type.value==='group'||type.value==='list'){
     const list=type.value==='list',rows=[];
     function add(key,value){
      const row=document.createElement('div');row.className='item-property-row';content.insertBefore(row,addButton);let removed=false;
      const keyField=list?null:E.field(row,'Property name','property-name-'+sequence++,key,300,true);
      const read=node(row,value,list?'List entry':'Property value');
      const remove=E.button('','Remove property',()=>{removed=!removed;row.classList.toggle('item-property-removed',removed);remove.textContent=removed?'Undo removal':'Remove property';for(const el of row.querySelectorAll('input,select,textarea,button'))if(el!==remove)el.disabled=removed;onDirty();},row);
      rows.push(()=>removed?null:[keyField?.value,read()]);
     }
     const addButton=E.button('',list?'Add list entry':'Add property',()=>{add('',null);onDirty();},content);
     for(const [key,item] of Object.entries(v||{}))add(key,item);
     get=()=>{const entries=rows.map(read=>read()).filter(Boolean);if(list)return entries.map(([,v])=>v);const names=entries.map(([k])=>k);if(names.some(k=>!k.trim())||new Set(names).size!==names.length)throw new Error('Give each property a unique name.');return Object.fromEntries(entries);};
    }else if(type.value==='boolean'){
     const field=E.selectField(content,'Value','property-value-'+sequence++,[['','Not recorded'],['true','Yes'],['false','No']],v===null?'':String(v));get=()=>field.value===''?null:field.value==='true';
    }else{
     const field=E.field(content,'Value','property-value-'+sequence++,v??'',10000,false,type.value==='text');
     if(type.value==='number'){field.type='number';field.step='any';}
     get=()=>{if(type.value==='text')return field.value;if(field.value==='')return null;const n=Number(field.value);if(!Number.isFinite(n))throw new Error('Enter a valid property number.');return n;};
    }
   }
   type.onchange=()=>{show(null);onDirty();};show(value);return ()=>get();
  }
  return node(parent,initial,title,root);
 }
 function edit(add=false){
  const r=add?null:chosen();if(specialist(r))return;
  let readProperties,categoryField,custom,description,descriptionState,name,after;const facts=[];const advance=nextAction();
  scavEditorDialog({title:add?'Add Item':'Edit '+r.name,submit:'Save private draft',build:({body,setDirty})=>{
   const content=E.selectField(body,'Content Type','edit-content-type',ScavAttachments.contentTypes.map(t=>[t,t]),r?ScavAttachments.contentType(r):'Item');content.disabled=true;
   if(r&&classificationInfo(r).conflict)paragraph(body,classificationInfo(r).message);
   name=E.field(body,'Item name','name',r?.name||'',300,true);
   if(!r||classificationInfo(r).type==='Item'){
    categoryField=E.selectField(body,'Item category','item-category',[['unknown','Not recorded'],...categories(r).map(v=>['value:'+v,itemCategories.includes(v)?v:v+' (recorded category)']),['custom','Other category…']],r?.category===null||!r?'unknown':'value:'+r.category);
    custom=E.field(body,'New category name','new-category','',300);custom.parentElement.hidden=true;
    categoryField.onchange=()=>{custom.parentElement.hidden=categoryField.value!=='custom';custom.required=categoryField.value==='custom';};
   }else if(classificationInfo(r).type==='Attachment'){
    const type=E.selectField(body,'Attachment Type','recorded-attachment-type',ScavAttachments.types.map(t=>[t,t]),r.attachmentType);type.disabled=true;
    E.help(body,'Category','Attachment Type is this content’s category. Change it with Content Type in the catalogue. Its earlier Item category is retained without modification.');
   }
   if(r&&!['Item','Attachment'].includes(classificationInfo(r).type))paragraph(body,'Category belongs to the '+classificationInfo(r).type+' catalogue. The recorded value is retained here.');
   descriptionState=E.selectField(body,'Description state','description-state',[['unknown','Not recorded'],['text','Written description']],r?.description===null||r?.description===undefined?'unknown':'text');
   description=E.field(body,'Description','description',r?.description??'',10000,false,true);
   descriptionState.onchange=()=>{description.disabled=descriptionState.value==='unknown';};descriptionState.onchange();
   const complex=value=>Array.isArray(value)||(value&&typeof value==='object'&&Object.values(value).some(complex));
   for(const key of state.factFields||[])if(r&&Object.hasOwn(r,key)&&!complex(r[key]))facts.push([key,E.recordedField(body,label(key),key,r[key])]);
   const advanced=document.createElement('details');advanced.className='item-advanced';const summary=document.createElement('summary');summary.textContent='Advanced / Technical details';const fields=document.createElement('div');advanced.append(summary,fields);body.append(advanced);
   E.help(fields,'Properties');
   for(const key of state.factFields||[])if(r&&Object.hasOwn(r,key)&&complex(r[key]))facts.push([key,propertyEditor(fields,r[key],setDirty,label(key),false)]);
   readProperties=propertyEditor(fields,r?.properties??null,setDirty,ScavAttachments.contentType(r||{})==='Attachment'?'Recorded Attachment properties':'Item properties');
   if(r){paragraph(fields,'Permanent reference: '+r.id);paragraph(fields,'Created: '+text(r.createdAt)+' · Updated: '+text(r.updatedAt));}
   after=E.selectField(body,'After saving','after-save',[['stay','Stay here'],['next','Save & Next'],['verify','Edit & Verify — review after saving']],'stay');
  },onSubmit:async()=>{
   const details={name:name.value,category:categoryField?(categoryField.value==='unknown'?null:categoryField.value==='custom'?custom.value:categoryField.value.slice(6)):r.category,description:descriptionState.value==='unknown'?null:description.value,properties:readProperties()};
   if(!add)details.facts=Object.fromEntries(facts.map(([key,read])=>[key,read()]));
   await change(add?'add':'edit',{details});
   if(after.value==='next')advance();else if(after.value==='verify')setTimeout(()=>review(),0);
  }});
 }
 function nextAction(){
  const ids=visibleRecords.map(r=>r.id),index=ids.indexOf(selectedId),filters=[search.value,category.value,visibility.value,classification.value,attention.value];
  return ()=>{[search.value,category.value,visibility.value,classification.value,attention.value]=filters;refreshCategories();const next=ids.slice(index+1).find(id=>state.catalogue.data.some(r=>r.id===id&&!r.archived));queueEnded=!next;if(next){selectedId=next;limit=Math.max(limit,ids.indexOf(next)+1);paint();$('item-name').tabIndex=-1;$('item-name').focus();}else{selectedId=null;paint();E.status($('status'),'ready','End of this review list. Change filters to continue.');}};
 }
 function confirm(action,title,message,extra={}){E.confirm({title,message,submit:'Save private draft',onConfirm:()=>change(action,extra)});}
 function review(){
  if(cloud){const r=chosen();return E.confirm({title:'Verify '+r.name+'?',message:'Verify this Item against the current game patch. The server records your identity and the time. Evidence is optional.',submit:'Verify',onConfirm:()=>change('verify',{decision:'verified',confirmId:r.id})});}
  const r=chosen();let decision;
  scavEditorDialog({title:'Review Item verification',submit:'Record review',build:({body})=>{
   E.verificationInfo(body,ScavVerification.inspect(r,state.settings));
   paragraph(body,cloud?'Verify this Item against the current patch. The server records your identity, the time and the current patch. Evidence is optional.':'Record your explicit review of '+r.name+' for patch '+(state.settings.current_patch_id||'not configured')+'. This is a private local review by the local operator. Editing facts or the image requires a new review.');
   decision=E.selectField(body,'Review decision','decision',[['unverified','Unverified'],...(state.settings.current_patch_id?[['verified','Verified for current patch']]:[])],'unverified');
  },onSubmit:()=>change('verify',{decision:decision.value,patchId:state.settings.current_patch_id,confirmId:r.id})});
 }
 function classify(){
  const r=chosen();let content,type,confirmation;
  scavEditorDialog({title:'Content Type · '+r.name,submit:'Save private draft',build:({body,save})=>{
   if(classificationInfo(r).conflict)paragraph(body,classificationInfo(r).message);
   content=E.selectField(body,'Content Type','content-type',ScavAttachments.contentTypes.map(t=>[t,t]),ScavAttachments.contentType(r));
   type=E.selectField(body,'Attachment Type','attachment-type',ScavAttachments.types.map(v=>[v,v]),r.attachmentType??'Unknown');
   confirmation=E.selectField(body,'Confirm return to Item','confirm-return',[['','Choose a decision'],['yes','Return to Item and retain all recorded information']],'');
   const boundary=document.createElement('p');boundary.className='item-type-boundary';boundary.setAttribute('role','status');body.append(boundary);
   function show(){const blocked=!['Item','Attachment'].includes(content.value)||specialist(r);save.disabled=blocked;
    type.parentElement.hidden=content.value!=='Attachment'||blocked;confirmation.parentElement.hidden=!(ScavAttachments.contentType(r)==='Attachment'&&content.value==='Item')||blocked;
    boundary.hidden=!blocked;boundary.textContent=blocked?'This content belongs in its dedicated catalogue. Moving an existing record needs an explicit reviewed migration so references and facts stay intact. No record will be moved or copied here.':'';
   }
   content.onchange=show;show();
  },onSubmit:()=>{
   if(!['Item','Attachment'].includes(content.value)||specialist(r))throw new Error('Use the dedicated catalogue. A reviewed migration is required to move this record.');
   if(ScavAttachments.contentType(r)==='Attachment'&&content.value==='Item'&&confirmation.value!=='yes')throw new Error('Confirm returning to Item. All recorded information will be retained.');
   return change('classify',{contentType:content.value,attachmentType:type.value,...(confirmation.value==='yes'?{confirmId:r.id}:{})});
  }});
 }
 E.button('item-classify','Content Type / Attachment Type',classify,$('item-actions'));
 E.button('review-attachments','Review potential Attachments',()=>{classification.value='candidates';attention.value='all';search.value='';category.value='all';visibility.value='all';limit=40;paint();},$('add-actions'));
 E.button('item-add','+ Add Item',()=>edit(true),$('add-actions'));
 E.button('item-edit','Edit',()=>edit(),$('item-actions'));
 E.button('item-image-action','Image',()=>E.imagePicker({inventory,current:safeImage(chosen().image)?chosen().image:null,title:'Item image',recordName:chosen().name,onSubmit:image=>change('image',{image})}),$('item-actions'));
 E.button('item-evidence-action','Evidence',()=>E.imagePicker({
 inventory,
 current:safeImage(chosen().evidence)?chosen().evidence:null,
 title:'Item evidence',
 recordName:chosen().name,
 onSubmit:evidence=>change('evidence',{evidence})
}),$('item-actions'));
 E.button('item-duplicate','Duplicate',()=>confirm('duplicate','Duplicate '+chosen().name,'Create a hidden copy with a fresh item reference. Evidence remains provenance only; verification history starts empty.'),$('item-actions'));
 E.button('item-visibility','Hide',()=>confirm('visibility',(chosen().hidden?'Show ':'Hide ')+chosen().name,'Change visibility in this private draft only. The item is retained.'),$('item-actions'));
 E.button('item-archive','Archive',()=>{const r=chosen();confirm(r.archived?'restore':'archive',(r.archived?'Restore ':'Archive ')+r.name,r.archived?'Return this item to the active draft list.':'Archive this item in the private draft? All its information is retained and you can restore it.',{confirmId:r.id});},$('item-actions'));
 E.button('item-review',cloud?'Verify':'Record verification',review,$('item-actions'));
 E.button('item-next','Skip / Next',()=>nextAction()(),$('item-actions'));
 const moreActions=document.createElement('details');moreActions.id='item-more';moreActions.className='item-advanced';const moreTitle=document.createElement('summary');moreTitle.textContent='••• More actions';moreActions.append(moreTitle);$('item-actions').after(moreActions);for(const id of ['item-duplicate','item-visibility','item-archive'])moreActions.append($(id));
 E.button('retry-save','Retry pending save',()=>change(null,{},true).catch(()=>{}),$('add-actions')).hidden=true;
 function details(){
  const r=chosen();$('detail').hidden=!r;if(!r)return;
  $('item-name').textContent=r.name;$('item-state').textContent=r.archived?'Archived item':r.hidden?'Hidden item':'Active item';
  const img=$('item-image');img.hidden=true;img.removeAttribute('src');img.alt=r.name;
  $('image-note').textContent=r.image?'Image available':'No image recorded.';
  // Only same-origin relative image references; never load external URLs from records.
  if(typeof r.image==='string'&&/^(?:images|evidence-inbox)\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|gif|webp)$/i.test(r.image)&&!r.image.split('/').some(p=>p==='.'||p==='..')&&!r.image.includes('//')){
   img.onload=()=>{img.hidden=false;$('image-note').textContent='';};img.onerror=()=>{img.hidden=true;$('image-note').textContent='Image unavailable. See Technical details.';};img.src=r.image;
  }
  $('facts').replaceChildren();
  const info=classificationInfo(r),fields=[['Content Type',info.type],['Category',categoryValue(r)],['Description',r.description],['Notes',r.notes],['Rank',r.rank],['Estimated Price',r.estimatedPrice],['Maximum stack',r.maxStack],['Stackable',r.stackable],['Effects',r.effects]];
  if(info.conflict){const warning=document.createElement('p');warning.className='item-type-boundary';warning.textContent='Classification Conflict — '+info.message;$('facts').append(warning);E.help(warning,'Classification conflict');}
  const missing=[];for(const [title,value] of fields){if(value==null){if(value===null)missing.push(title);continue;}const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=text(value);$('facts').append(dt,dd);E.help(dt,title);}
  if(missing.length){const p=document.createElement('p');p.textContent='Missing information: '+missing.join(', ')+'.';$('facts').append(p);E.help(p,'Not recorded');}
  const technical=document.createElement('details');technical.className='item-advanced';const summary=document.createElement('summary');summary.textContent='Advanced / Technical details';technical.append(summary);
  for(const [title,value] of [['Permanent reference',r.id],['Stored Content Type',ScavAttachments.contentType(r)],['Existing classifications',r.classification],['Original category',r.category],['Properties',r.properties],['Image path',r.image],['Created',r.createdAt],['Updated',r.updatedAt]])if(value!==undefined)paragraph(technical,title+': '+text(value));$('facts').append(technical);
  $('verification').replaceChildren();E.verificationInfo($('verification'),ScavVerification.inspect(r,state.settings));
  $('item-visibility').textContent=r.hidden?'Show':'Hide';$('item-archive').textContent=r.archived?'Restore':'Archive';
 }
 function paint(){
  if(!state)return;
  const records=state.catalogue.data.filter(r=>{const status=ScavVerification.inspect(r,state.settings).status;return attention.value==='all'||attention.value===status||attention.value==='image'&&!safeImage(r.image)||attention.value==='unknown'&&needsInformation(r)||attention.value==='conflict'&&classificationInfo(r).conflict||attention.value==='attention'&&(status!=='verified'||!safeImage(r.image)||needsInformation(r)||classificationInfo(r).conflict);}).filter(r=>(classification.value==='all'||classification.value==='candidates'&&ScavAttachments.candidate(r)||classificationInfo(r).type===classification.value)&&E.matches(r.name+' '+r.id,search.value)&&(category.value==='all'||category.value==='unknown'&&categoryValue(r)==null||category.value==='value:'+categoryValue(r))&&(visibility.value==='all'||visibility.value==='active'&&!r.hidden&&!r.archived||visibility.value==='hidden'&&r.hidden&&!r.archived||visibility.value==='archived'&&r.archived));
  if(!records.some(r=>r.id===selectedId))selectedId=queueEnded?null:records[0]?.id||null;
  visibleRecords=records;
  $('count').textContent=`${state.catalogue.data.length} total · ${records.length} match current filters · showing ${Math.min(limit,records.length)}`;
  $('item-list').replaceChildren();
  for(const r of records.slice(0,limit)){
   const b=E.button('',r.name,()=>{queueEnded=false;selectedId=r.id;paint();Array.from($('item-list').children).find(n=>n.dataset.id===r.id)?.focus();},$('item-list'));
   b.className='item-choice';b.dataset.id=r.id;b.setAttribute('aria-pressed',String(r.id===selectedId));
   const hint=document.createElement('small');hint.textContent=classificationInfo(r).type+' · '+ScavVerification.inspect(r,state.settings).status.replace(/-/g,' ')+(classificationInfo(r).conflict?' · Classification Conflict':'')+(!safeImage(r.image)?' · Missing Image':'')+(needsInformation(r)?' · Missing Information':'')+(r.archived?' · Archived':r.hidden?' · Hidden':'');b.append(hint);
  }
  $('review-attachments').textContent='Review potential Attachments ('+state.catalogue.data.filter(ScavAttachments.candidate).length+')';
  $('more').hidden=records.length<=limit;details();
  $('workspace').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy||!!pending);
  const r=chosen();for(const id of ['item-classify','item-edit','item-image-action','item-evidence-action','item-duplicate','item-visibility','item-review'])$(id).disabled=busy||!!pending||!r||r.archived||(specialist(r)&&['item-edit','item-duplicate'].includes(id));
$('item-next').disabled=busy||!!pending||!r;
  $('item-archive').disabled=busy||!!pending||!r;$('retry').disabled=busy;
  $('retry-save').hidden=!pending;$('retry-save').disabled=busy;
 }
 E.search(search,()=>{queueEnded=false;limit=40;paint();});classification.onchange=()=>{queueEnded=false;category.value='all';refreshCategories();limit=40;paint();};category.onchange=visibility.onchange=attention.onchange=()=>{queueEnded=false;limit=40;paint();};$('more').onclick=()=>{limit+=40;paint();};
 async function load(){
  state=null;$('workspace').hidden=true;$('retry').hidden=true;$('status').textContent='Loading Items catalogue…';$('status').setAttribute('aria-busy','true');
  try{
   if(cloud){const result=await cloud.load();inventory=result.images;state=result;pending=null;refreshCategories();paint();$('workspace').hidden=false;E.status($('status'),'ready','Durable private draft');return;}
   const auth=await fetch('/api/session');if(!auth.ok)throw new Error('Open the private Items Editor on this computer.');
   const authResult=await auth.json();if(authResult.mode!=='local'||!authResult.token)throw new Error('Local preview is required.');session=authResult.token;
   const [result,imageResponse]=await Promise.all([api(),fetch('data/site-images.json')]);if(!imageResponse.ok)throw new Error('Could not load the image library.');inventory=await imageResponse.json();
   E.catalog(result.catalogue.data);ScavVerification.patchId(result.settings);result.catalogue.data.forEach(r=>ScavVerification.inspect(r,result.settings));state=result;pending=null;
   refreshCategories();paint();$('workspace').hidden=false;E.status($('status'),'ready','Private draft · changes save after each action');
  }catch(error){state=null;$('status').textContent='Could not load items. '+error.message;$('retry').hidden=false;}
  finally{$('status').setAttribute('aria-busy','false');}
 }
 $('retry').onclick=()=>{if(pending)E.confirm({title:'Reload saved items?',message:'The pending entries will be discarded. If a save reached storage, the saved result will be loaded. Copy any text you need before continuing.',submit:'Reload saved items',onConfirm:load});else load();};
 if(cloud)cloud.onSaved=result=>{if(!state)return;state.catalogue=result.record.state;state.settings=result.settings||state.settings;selectedId=result.record.selectedId;pending=null;queueEnded=false;refreshCategories();paint();};
 window.addEventListener('beforeunload',event=>{if(pending||busy){event.preventDefault();event.returnValue='';}});load();
})();
