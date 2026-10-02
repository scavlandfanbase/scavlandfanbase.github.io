(()=>{
 const Model=window.ScavPageBuilderModel,Ops=window.ScavPageCanvasOperations;
 function mount(host,{sectionId,readPage,readContext,onChange,isLocked=()=>false}){
  let selected=null,drag=null;
  const stage=document.createElement('div'),tools=document.createElement('div'),status=document.createElement('p');
  host.classList.add('published-page');stage.className='pb-canvas-stage';stage.setAttribute('aria-label','Desktop canvas. Arrow keys move; Shift and arrows resize.');
  tools.className='pb-canvas-tools';status.setAttribute('role','status');host.append(stage,tools,status);
  const section=()=>readPage().sections.find(s=>s.id===sectionId);
  const block=()=>section()?.blocks.find(b=>b.id===selected);
  function commit(edit){if(isLocked())return false;try{onChange(edit());renderStage();status.textContent='Layout changed. Save Draft to keep it privately.';return true;}catch(error){status.textContent=error.message;return false;}}
  function place(region){return commit(()=>Ops.position(readPage(),readContext(),sectionId,selected,region));}
  function change(dx,dy,resize=false){const b=block();if(!b)return;const r=b.canvas.desktop;place({...r,[resize?'w':'x']:r[resize?'w':'x']+dx,[resize?'h':'y']:r[resize?'h':'y']+dy});}
  function renderTools(){
   tools.replaceChildren();
   for(const [label,run]of [['Move left',()=>change(-1,0)],['Move right',()=>change(1,0)],['Move up',()=>change(0,-1)],['Move down',()=>change(0,1)],['Narrower',()=>change(-1,0,true)],['Wider',()=>change(1,0,true)],['Shorter',()=>change(0,-1,true)],['Taller',()=>change(0,1,true)],['Mobile earlier',()=>commit(()=>Ops.mobileMove(readPage(),readContext(),sectionId,selected,-1))],['Mobile later',()=>commit(()=>Ops.mobileMove(readPage(),readContext(),sectionId,selected,1))]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=!block()||isLocked();button.addEventListener('click',run);tools.append(button);
   }
   if(!block())return;
   for(const [key,choices]of Object.entries(Model.canvasStyles)){
    const label=document.createElement('label'),select=document.createElement('select');label.textContent=key.replace(/([A-Z])/g,' $1');
    for(const value of choices){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}select.value=block().canvas.style[key];select.disabled=isLocked();
    select.addEventListener('change',()=>{const b=block();if(!commit(()=>Ops.appearance(readPage(),readContext(),sectionId,b.id,{...b.canvas.style,[key]:select.value})))select.value=block().canvas.style[key];});label.append(select);tools.append(label);
   }
  }
  function renderStage(){
   const focused=stage.contains(document.activeElement);stage.replaceChildren();
   for(const b of section()?.blocks||[]){
    const el=document.createElement('div'),content=document.createElement('div'),handle=document.createElement('span'),r=b.canvas.desktop;
    el.className='pb-canvas-box';el.dataset.canvasBlock=b.id;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-pressed',String(selected===b.id));
    el.setAttribute('aria-label',`${b.type} box, column ${r.x+1}, row ${r.y+1}, width ${r.w}, height ${r.h}${b.hidden?', hidden from public page':''}`);
    el.style.gridColumn=`${r.x+1}/span ${r.w}`;el.style.gridRow=`${r.y+1}/span ${r.h}`;
    content.className='pb-canvas-box-content '+Object.entries(b.canvas.style).map(([key,value])=>`canvas-${key}-${value}`).join(' ');
    if(b.hidden){const note=document.createElement('small');note.textContent='Hidden from public page';content.append(note);}
    if((b.type==='image'||b.type==='card')&&readContext().approvedImages.includes(b.image)){const img=document.createElement('img');img.src='/'+b.image;img.alt=b.alt;img.draggable=false;content.append(img);}
    if(b.type==='divider')content.append(document.createElement('hr'));
    else{
     if(b.title){const title=document.createElement('strong');title.textContent=b.title;content.append(title);}
     const text=document.createElement('p');text.textContent=b.text||(!b.title?(b.alt||b.type):'');content.append(text);
    }
    handle.className='pb-canvas-resize';handle.setAttribute('aria-hidden','true');handle.textContent='↘';el.append(content,handle);
    el.addEventListener('click',()=>{selected=b.id;renderStage();renderTools();stage.querySelector(`[data-canvas-block="${CSS.escape(selected)}"]`)?.focus();});
    el.addEventListener('keydown',event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();selected=b.id;renderStage();renderTools();return;}
     const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!directions[event.key])return;
     event.preventDefault();selected=b.id;change(...directions[event.key],event.shiftKey);renderTools();
    });
    el.addEventListener('pointerdown',event=>{
     if(isLocked()||event.button!==0)return;event.preventDefault();selected=b.id;
     drag={origin:{...r},x:event.clientX,y:event.clientY,resize:event.target===handle,pitch:(stage.getBoundingClientRect().width+4)/12};
     stage.setPointerCapture(event.pointerId);renderStage();renderTools();stage.querySelector(`[data-canvas-block="${CSS.escape(selected)}"]`)?.focus();
    });stage.append(el);
    if(focused&&selected===b.id)el.focus({preventScroll:true});
   }
  }
  stage.addEventListener('pointermove',event=>{
   if(!drag)return;const dx=Math.round((event.clientX-drag.x)/drag.pitch),dy=Math.round((event.clientY-drag.y)/24),r=drag.origin;
   place({...r,[drag.resize?'w':'x']:r[drag.resize?'w':'x']+dx,[drag.resize?'h':'y']:r[drag.resize?'h':'y']+dy});
  });
  stage.addEventListener('pointerup',()=>{drag=null;});stage.addEventListener('pointercancel',()=>{drag=null;});
  renderStage();renderTools();return {refresh:()=>{if(!block())selected=null;renderStage();renderTools();}};
 }
 window.ScavPageCanvasPanel=Object.freeze({mount});
})();
