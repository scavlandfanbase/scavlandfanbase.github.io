// Shared presentation only. Callers own authorization, data loading and persistence.
window.ScavEditor = (() => {
  function button(id, text, action, parent, aria) {
    const b=document.createElement('button');b.type='button';if(id)b.id=id;b.textContent=text;
    if(aria){b.setAttribute('aria-label',aria);b.title=aria;}b.onclick=action;parent.append(b);return b;
  }
  function options(select, entries, selected) {
    select.replaceChildren(...entries.map(([id,title])=>{const option=document.createElement('option');option.value=id;option.textContent=title;return option;}));
    if(entries.some(([id])=>id===selected))select.value=selected;
  }
  function field(body,label,name,value='',max=200,required=false,multiline=false) {
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement(multiline?'textarea':'input');input.name=name;input.value=value??'';input.maxLength=max;input.required=required;wrap.append(input);body.append(wrap);return input;
  }
  function selectField(body,label,name,entries,selected) {
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('select');input.name=name;input.setAttribute('aria-label',label);options(input,entries,selected);wrap.append(input);body.append(wrap);return input;
  }
  function status(node,state,detail='') {
    const labels={ready:'Ready',saving:'Saving…',saved:'Saved',updating:'Public site updating…',error:'Couldn’t save'};
    if(!labels[state])throw new Error('Unknown editor status.');
    node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.dataset.state=state;
    node.textContent=labels[state]+(detail?' — '+detail:'');
  }
  const matches=(value,query)=>String(value??'').toLocaleLowerCase().includes(String(query??'').trim().toLocaleLowerCase());
  function search(input,onChange) {
    input.type='search';const listener=()=>onChange(input.value.trim());input.addEventListener('input',listener);
    return {matches:value=>matches(value,input.value),destroy:()=>input.removeEventListener('input',listener)};
  }
  function imagePicker({inventory,current=null,title='Choose Image',removeId='',onSubmit}) {
    let selected=current;
    return window.scavEditorDialog({title,submit:'Use Image',build:({body,setDirty})=>{
      const input=field(body,'Search images','search','',200);input.dataset.editorTransient='true';
      const categories=document.createElement('div');categories.className='scav-image-categories';
      const grid=document.createElement('div');grid.className='scav-image-grid';
      const preview=document.createElement('img');preview.className='scav-image-preview';preview.alt='Selected image';
      const caption=document.createElement('p'),results=document.createElement('p');results.setAttribute('role','status');
      body.append(categories,results,grid,preview,caption);
      const groups=inventory.categories||{};let category='all',limit=60;
      const more=button('','Show more images',()=>{limit+=60;show();},body);
      function show(){
        const paths=category==='all'?[...new Set(Object.values(groups).flatMap(g=>g.images||[]))]:groups[category].images||[];
        const filtered=paths.filter(path=>matches(path,input.value));grid.replaceChildren();
        results.textContent=filtered.length?`${filtered.length} images · showing ${Math.min(limit,filtered.length)}`:'No images match.';
        filtered.slice(0,limit).forEach(path=>{
          const b=button('','',()=>{selected=path;setDirty();show();grid.querySelectorAll('button').forEach(node=>{if(node.getAttribute('aria-label')===path)node.focus();});},grid,path);
          b.setAttribute('aria-pressed',String(selected===path));
          const img=document.createElement('img');img.src=path;img.alt='';img.loading='lazy';const text=document.createElement('span');text.textContent=path.split('/').pop();b.append(img,text);
        });
        categories.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
        more.hidden=filtered.length<=limit;preview.hidden=!selected;if(selected)preview.src=selected;else preview.removeAttribute('src');caption.textContent=selected||'No image';
      }
      for(const [key,label] of [['all','All'],...Object.entries(groups).map(([k,v])=>[k,v.label||k])]){
        const b=button('',label,()=>{category=key;limit=60;show();},categories);b.dataset.category=key;
      }
      button(removeId,'Remove Image',()=>{selected=null;setDirty();show();},body);
      search(input,()=>{limit=60;show();});show();
    },onSubmit:()=>onSubmit(selected)});
  }
  function verificationInfo(parent,inspection,{verifierName}={}) {
    const labels={verified:'Verified','unverified':'Unverified','patch-check-needed':'Patch check needed'};
    if(!labels[inspection.status])throw new Error('Invalid verification status.');
    const block=document.createElement('div');block.className='scav-verification';
    const badge=document.createElement('strong');badge.className='scav-verification-badge';badge.dataset.state=inspection.status;badge.textContent=labels[inspection.status];block.append(badge);
    const details=document.createElement('p');
    const last=inspection.last_verified_at?new Date(inspection.last_verified_at).toLocaleString():inspection.last_verified==='unknown'?'Unknown (legacy evidence)':'Never';
    details.textContent='Last verified: '+last+(inspection.verified_patch_id?' · Patch '+inspection.verified_patch_id:'');
    if(inspection.last_verified_by)details.textContent+=' · By '+(verifierName||'recorded administrator');
    block.append(details);parent.append(block);return block;
  }
  function confirm({title,message='',submit='Delete',build=()=>{},onConfirm}) {
    return window.scavEditorDialog({title,submit,build:api=>{
      api.save.className='scav-danger';
      if(message){const p=document.createElement('p');p.textContent=message;api.body.append(p);}
      build(api);
    },onSubmit:onConfirm});
  }
  // Resolve relationships by stable ID, never by a display name or copied game stats.
  function catalog(records) {
    const map=new Map();
    for(const record of records){
      if(!record||typeof record.id!=='string'||!record.id.trim())throw new Error('Every catalogue record needs a stable ID.');
      if(map.has(record.id))throw new Error('Duplicate catalogue ID.');map.set(record.id,structuredClone(record));
    }
    return Object.freeze({list:()=>structuredClone([...map.values()]),resolve:id=>map.has(id)?structuredClone(map.get(id)):null});
  }
  function recordPicker({records,currentId=null,settings,title='Choose existing record',onSelect}) {
    const source=catalog(records);let selected=source.resolve(currentId)?.archived?null:currentId;
    return window.scavEditorDialog({title,submit:'Use selected record',build:({body,save,setDirty})=>{
      const input=field(body,'Search records','search','',200);input.dataset.editorTransient='true';
      const filter=selectField(body,'Verification','filter',[['all','All'],['verified','Verified'],['attention','Needs verification']],'all');filter.dataset.editorTransient='true';
      const results=document.createElement('p');results.setAttribute('role','status');const list=document.createElement('div');list.className='scav-record-list';body.append(results,list);
      let limit=50;const more=button('','Show more records',()=>{limit+=50;show();},body);
      function show(){
        const entries=source.list().filter(r=>!r.archived&&matches(r.name||r.title,input.value)).map(record=>({record,inspection:window.ScavVerification.inspect(record,settings)})).filter(({inspection})=>filter.value==='all'||filter.value==='verified'&&inspection.status==='verified'||filter.value==='attention'&&inspection.status!=='verified');
        results.textContent=entries.length?`${entries.length} records · showing ${Math.min(limit,entries.length)}`:'No matching records.';list.replaceChildren();
        for(const {record,inspection} of entries.slice(0,limit)){
          const row=document.createElement('div');row.className='scav-record-choice';const b=button('',record.name||record.title||'Unnamed record',()=>{selected=record.id;setDirty();show();list.querySelectorAll('button').forEach(n=>{if(n.dataset.recordId===selected)n.focus();});},row);
          b.dataset.recordId=record.id;b.setAttribute('aria-pressed',String(record.id===selected));verificationInfo(row,inspection);list.append(row);
        }
        more.hidden=entries.length<=limit;save.disabled=!source.resolve(selected)||source.resolve(selected).archived===true;
      }
      search(input,()=>{limit=50;show();});filter.onchange=()=>{limit=50;show();};show();
    },onSubmit:()=>{if(!source.resolve(selected)||source.resolve(selected).archived)throw new Error('Select an existing record.');return onSelect(selected);}});
  }
  return Object.freeze({button,options,field,selectField,status,matches,search,imagePicker,verificationInfo,confirm,catalog,recordPicker});
})();
