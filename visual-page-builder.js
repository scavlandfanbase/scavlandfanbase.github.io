(function(){
  'use strict';
  const Model=window.ScavVisualCanvasModel;
  const Renderer=window.ScavVisualCanvasRenderer;
  const Fixtures=window.ScavVisualCanvasFixtures;
  const Layout=window.ScavVisualCanvasLayout;
  const COLS=Model.GRID_COLUMNS;
  const GRID={cols:COLS,maxRows:Model.limits.maxH,minW:Model.limits.minW,minH:Model.limits.minH};

  const stage=document.getElementById('stage');
  const propertiesPanel=document.getElementById('properties-panel');
  const previewOutput=document.getElementById('preview-output');
  const previewFrame=document.getElementById('preview-frame');
  const statusLine=document.getElementById('status-line');

  let doc=Model.validate(Fixtures.sampleDocument,{approvedImages:Fixtures.approvedImages});
  let selectedId=null;
  let previewMode='desktop';
  let dragState=null;

  function findBlock(id){return doc.blocks.find(block=>block.id===id)||null;}

  function nextId(prefix){
    let index=1,id;
    do{id=`${prefix}-${index++}`;}while(findBlock(id));
    return id;
  }

  function nextMobileOrder(){
    const used=new Set(doc.blocks.map(block=>block.mobileOrder));
    let order=0;while(used.has(order))order++;return order;
  }

  function announce(message){statusLine.textContent=message;}

  function validateCurrentDoc(){
    try{
      Model.validate(doc,{approvedImages:Fixtures.approvedImages});
      return null;
    }catch(error){return error.message;}
  }

  function addBlock(type){
    const size={w:type==='text'?6:4,h:type==='card'?14:8};
    const desktop=Layout.findFreeRegion(doc.blocks,size,GRID);
    if(!desktop){
      announce(`No space is available for a new ${type} block. Resize or remove existing blocks, then try again. The canvas is unchanged.`);
      return;
    }
    const id=nextId(type);
    const style={...Fixtures.defaultStyle};
    const block={id,type,desktop,mobileOrder:nextMobileOrder(),style};
    if(type==='text')block.text='New text block.';
    if(type==='image'){block.image=Fixtures.approvedImages[0];block.alt='Approved fixture image.';}
    if(type==='card'){block.title='New card';block.text='Card description.';block.image=null;block.alt='';block.href='items.html';}
    doc.blocks.push(block);
    selectedId=id;
    render();
    announce(`${type} block added. Edited - not saved, demonstration only.`);
  }

  function deleteSelected(){
    if(!selectedId)return;
    const block=findBlock(selectedId);
    if(!block)return;
    if(!window.confirm(`Remove the selected ${block.type} block from this fixture canvas?`))return;
    doc.blocks=doc.blocks.filter(entry=>entry.id!==selectedId);
    selectedId=null;
    render();
    announce('Block removed. Edited - not saved, demonstration only.');
  }

  function moveSelected(dx,dy){
    const block=findBlock(selectedId);
    if(!block)return;
    const candidate={...block.desktop,x:block.desktop.x+dx,y:block.desktop.y+dy};
    if(!Layout.canPlace(candidate,doc.blocks,GRID,block.id)){
      announce("Can't move there - it would overlap another block or leave the grid. Position unchanged.");
      return;
    }
    block.desktop=candidate;
    render();
    announce('Position updated. Edited - not saved, demonstration only.');
  }

  function resizeSelected(dw,dh){
    const block=findBlock(selectedId);
    if(!block)return;
    const candidate={...block.desktop,w:block.desktop.w+dw,h:block.desktop.h+dh};
    if(!Layout.canPlace(candidate,doc.blocks,GRID,block.id)){
      announce("Can't resize there - it would overlap another block or leave the grid. Size unchanged.");
      return;
    }
    block.desktop=candidate;
    render();
    announce('Size updated. Edited - not saved, demonstration only.');
  }

  function reorderSelected(direction){
    const block=findBlock(selectedId);
    if(!block)return;
    const sorted=[...doc.blocks].sort((a,b)=>a.mobileOrder-b.mobileOrder);
    const index=sorted.findIndex(entry=>entry.id===block.id);
    const swapIndex=index+direction;
    if(swapIndex<0||swapIndex>=sorted.length)return;
    const swapWith=sorted[swapIndex];
    const temp=block.mobileOrder;
    block.mobileOrder=swapWith.mobileOrder;
    swapWith.mobileOrder=temp;
    render();
    announce('Mobile stacking order updated. Edited - not saved, demonstration only.');
  }

  function selectBlock(id){
    selectedId=id;
    render();
  }

  function onBlockKeydown(event,block){
    const key=event.key;
    const step=1;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){
      event.preventDefault();
      selectedId=block.id;
      if(event.shiftKey){
        if(key==='ArrowLeft')resizeSelected(-step,0);
        else if(key==='ArrowRight')resizeSelected(step,0);
        else if(key==='ArrowUp')resizeSelected(0,-step);
        else resizeSelected(0,step);
      }else{
        if(key==='ArrowLeft')moveSelected(-step,0);
        else if(key==='ArrowRight')moveSelected(step,0);
        else if(key==='ArrowUp')moveSelected(0,-step);
        else moveSelected(0,step);
      }
    }else if(key==='Delete'||key==='Backspace'){
      event.preventDefault();
      selectedId=block.id;
      deleteSelected();
    }
  }

  function stageMetrics(){
    const rect=stage.getBoundingClientRect();
    const gap=4;
    const colWidth=(rect.width-gap*(COLS-1))/COLS;
    const rowHeight=20+gap;
    return {rect,colWidth,rowHeight,gap};
  }

  function startPointerAction(event,block,mode){
    event.preventDefault();
    selectedId=block.id;
    const metrics=stageMetrics();
    dragState={
      mode,block,metrics,
      startX:event.clientX,startY:event.clientY,
      origin:{...block.desktop},
    };
    stage.setPointerCapture(event.pointerId);
    render();
  }

  function onStagePointerMove(event){
    if(!dragState)return;
    const {mode,block,metrics,startX,startY,origin}=dragState;
    const dxCols=Math.round((event.clientX-startX)/metrics.colWidth);
    const dyRows=Math.round((event.clientY-startY)/metrics.rowHeight);
    let candidate=null;
    if(mode==='move'){
      candidate={...origin,x:origin.x+dxCols,y:origin.y+dyRows};
    }else if(mode==='resize-se'){
      candidate={...origin,w:origin.w+dxCols,h:origin.h+dyRows};
    }else if(mode==='resize-e'){
      candidate={...origin,w:origin.w+dxCols};
    }else if(mode==='resize-s'){
      candidate={...origin,h:origin.h+dyRows};
    }
    if(candidate&&Layout.canPlace(candidate,doc.blocks,GRID,block.id)){
      block.desktop=candidate;
      dragState.rejected=false;
    }else{
      dragState.rejected=true;
    }
    renderStageOnly();
  }

  function onStagePointerUp(){
    if(!dragState)return;
    const {block,origin,rejected}=dragState;
    dragState=null;
    render();
    if(rejected&&block.desktop.x===origin.x&&block.desktop.y===origin.y&&block.desktop.w===origin.w&&block.desktop.h===origin.h){
      announce('No change - that position would overlap another block or leave the grid.');
    }else{
      announce('Edited - not saved, demonstration only.');
    }
  }

  function buildHandles(block){
    const frag=document.createDocumentFragment();
    const specs=[['se','resize-se'],['e','resize-e'],['s','resize-s']];
    for(const [cls,mode]of specs){
      const handle=document.createElement('div');
      handle.className=`vcb-handle vcb-handle-${cls}`;
      handle.setAttribute('aria-hidden','true');
      handle.addEventListener('pointerdown',event=>startPointerAction(event,block,mode));
      frag.appendChild(handle);
    }
    return frag;
  }

  function styleClassString(style){
    return `fs-${style.fontSize} tc-${style.textColor} bg-${style.background} bd-${style.border} pd-${style.padding} al-${style.align} sp-${style.spacing}`;
  }

  function blockContentNode(block){
    const wrap=document.createElement('div');
    wrap.className=`vcb-block-content ${styleClassString(block.style)}`;
    const label=document.createElement('div');
    label.className='vcb-block-label';
    label.textContent=`${block.type} - ${block.id}`;
    wrap.appendChild(label);
    if(block.type==='text'){
      const p=document.createElement('p');
      p.className='canvas-text';
      p.textContent=block.text;
      wrap.appendChild(p);
    }else if(block.type==='image'){
      const figure=document.createElement('figure');
      figure.className='canvas-figure';
      const img=document.createElement('img');
      img.src='/'+block.image;
      img.alt=block.alt;
      figure.appendChild(img);
      wrap.appendChild(figure);
    }else{
      const article=document.createElement('article');
      article.className='canvas-card';
      if(block.image){
        const img=document.createElement('img');
        img.src='/'+block.image;
        img.alt=block.alt;
        article.appendChild(img);
      }
      const h3=document.createElement('h3');
      h3.textContent=block.title;
      article.appendChild(h3);
      if(block.text){
        const p=document.createElement('p');
        p.className='canvas-text';
        p.textContent=block.text;
        article.appendChild(p);
      }
      wrap.appendChild(article);
    }
    return wrap;
  }

  function renderStageOnly(){
    const hadStageFocus=stage.contains(document.activeElement);
    stage.innerHTML='';
    for(const block of doc.blocks){
      const el=document.createElement('div');
      el.className='vcb-block'+(block.id===selectedId?' is-selected':'');
      el.style.gridColumn=`${block.desktop.x+1} / span ${block.desktop.w}`;
      el.style.gridRow=`${block.desktop.y+1} / span ${block.desktop.h}`;
      el.tabIndex=0;
      el.setAttribute('role','group');
      el.setAttribute('aria-selected',block.id===selectedId?'true':'false');
      el.setAttribute('aria-label',`${block.type} block ${block.id}, desktop position column ${block.desktop.x+1} row ${block.desktop.y+1}, size ${block.desktop.w} by ${block.desktop.h}`);
      el.appendChild(blockContentNode(block));
      el.appendChild(buildHandles(block));
      el.addEventListener('pointerdown',event=>{
        if(event.target.classList.contains('vcb-handle'))return;
        startPointerAction(event,block,'move');
      });
      el.addEventListener('click',()=>selectBlock(block.id));
      el.addEventListener('keydown',event=>onBlockKeydown(event,block));
      stage.appendChild(el);
      if(hadStageFocus&&block.id===selectedId)el.focus({preventScroll:true});
    }
  }

  function renderPreview(){
    previewFrame.classList.toggle('is-mobile',previewMode==='mobile');
    try{
      previewOutput.innerHTML=Renderer.render(doc,{images:Fixtures.approvedImages,breakpoint:previewMode});
    }catch(error){
      previewOutput.textContent=`Preview unavailable: ${error.message}`;
    }
  }

  function field(labelText,inputEl){
    const label=document.createElement('label');
    label.className='vcb-field';
    const span=document.createElement('span');
    span.textContent=labelText;
    label.appendChild(span);
    label.appendChild(inputEl);
    return label;
  }

  function selectField(labelText,options,value,onChange){
    const select=document.createElement('select');
    for(const option of options){
      const opt=document.createElement('option');
      opt.value=option;opt.textContent=option;
      if(option===value)opt.selected=true;
      select.appendChild(opt);
    }
    select.addEventListener('change',()=>onChange(select.value));
    return field(labelText,select);
  }

  function textField(labelText,value,onChange,multiline=false){
    const input=document.createElement(multiline?'textarea':'input');
    if(!multiline)input.type='text';
    input.value=value;
    input.addEventListener('input',()=>onChange(input.value));
    return field(labelText,input);
  }

  function renderProperties(){
    propertiesPanel.innerHTML='';
    const heading=document.createElement('h2');
    heading.textContent='Properties';
    propertiesPanel.appendChild(heading);
    const block=findBlock(selectedId);
    if(!block){
      const empty=document.createElement('p');
      empty.className='vcb-empty-note';
      empty.id='properties-empty';
      empty.textContent='Select a block to edit its position, size and appearance.';
      propertiesPanel.appendChild(empty);
      return;
    }
    const update=(key,value)=>{block[key]=value;refreshCanvasAndPreview();announce('Edited - not saved, demonstration only.');};
    const updateStyle=(key,value)=>{block.style={...block.style,[key]:value};refreshCanvasAndPreview();announce('Edited - not saved, demonstration only.');};

    if(block.type==='text'||block.type==='card')propertiesPanel.appendChild(textField('Text',block.text||'',value=>update('text',value),true));
    if(block.type==='card')propertiesPanel.appendChild(textField('Title',block.title||'',value=>update('title',value)));
    if(block.type==='card')propertiesPanel.appendChild(textField('Link (approved pages or https only)',block.href||'',value=>update('href',value)));
    if(block.type==='image'||block.type==='card'){
      propertiesPanel.appendChild(selectField('Image (approved library only)',block.type==='card'?['(none)',...Fixtures.approvedImages]:Fixtures.approvedImages,block.image||'(none)',value=>update('image',value==='(none)'?null:value)));
      propertiesPanel.appendChild(textField('Image description',block.alt||'',value=>update('alt',value)));
    }
    propertiesPanel.appendChild(selectField('Text size',Model.fontSizes,block.style.fontSize,value=>updateStyle('fontSize',value)));
    propertiesPanel.appendChild(selectField('Text colour',Model.palette,block.style.textColor,value=>updateStyle('textColor',value)));
    propertiesPanel.appendChild(selectField('Background colour',Model.backgrounds,block.style.background,value=>updateStyle('background',value)));
    propertiesPanel.appendChild(selectField('Border',Model.borders,block.style.border,value=>updateStyle('border',value)));
    propertiesPanel.appendChild(selectField('Padding',Model.paddings,block.style.padding,value=>updateStyle('padding',value)));
    propertiesPanel.appendChild(selectField('Alignment',Model.aligns,block.style.align,value=>updateStyle('align',value)));
    propertiesPanel.appendChild(selectField('Spacing',Model.spacings,block.style.spacing,value=>updateStyle('spacing',value)));
  }

  function render(){
    renderStageOnly();
    renderProperties();
    renderPreview();
    const error=validateCurrentDoc();
    if(error)announce(`Fixture data invalid: ${error}`);
  }

  // Updates the canvas and preview without rebuilding the properties panel, so
  // typing in a text/title/link/alt field keeps its focus, cursor and selection.
  function refreshCanvasAndPreview(){
    renderStageOnly();
    renderPreview();
    const error=validateCurrentDoc();
    if(error)announce(`Fixture data invalid: ${error}`);
  }

  document.getElementById('add-text').addEventListener('click',()=>addBlock('text'));
  document.getElementById('add-image').addEventListener('click',()=>addBlock('image'));
  document.getElementById('add-card').addEventListener('click',()=>addBlock('card'));
  document.getElementById('move-left').addEventListener('click',()=>moveSelected(-1,0));
  document.getElementById('move-right').addEventListener('click',()=>moveSelected(1,0));
  document.getElementById('move-up').addEventListener('click',()=>moveSelected(0,-1));
  document.getElementById('move-down').addEventListener('click',()=>moveSelected(0,1));
  document.getElementById('grow-w').addEventListener('click',()=>resizeSelected(1,0));
  document.getElementById('shrink-w').addEventListener('click',()=>resizeSelected(-1,0));
  document.getElementById('grow-h').addEventListener('click',()=>resizeSelected(0,1));
  document.getElementById('shrink-h').addEventListener('click',()=>resizeSelected(0,-1));
  document.getElementById('order-earlier').addEventListener('click',()=>reorderSelected(-1));
  document.getElementById('order-later').addEventListener('click',()=>reorderSelected(1));
  document.getElementById('delete-block').addEventListener('click',deleteSelected);
  document.getElementById('reset-fixture').addEventListener('click',()=>{
    if(!window.confirm('Reset the canvas to the original fixture document? Unsaved edits in this demonstration will be lost.'))return;
    doc=Model.validate(Fixtures.sampleDocument,{approvedImages:Fixtures.approvedImages});
    selectedId=null;
    render();
    announce('Fixture reset.');
  });
  document.getElementById('export-json').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='visual-canvas-fixture.json';a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('preview-desktop').addEventListener('click',()=>{
    previewMode='desktop';
    document.getElementById('preview-desktop').setAttribute('aria-pressed','true');
    document.getElementById('preview-mobile').setAttribute('aria-pressed','false');
    renderPreview();
  });
  document.getElementById('preview-mobile').addEventListener('click',()=>{
    previewMode='mobile';
    document.getElementById('preview-mobile').setAttribute('aria-pressed','true');
    document.getElementById('preview-desktop').setAttribute('aria-pressed','false');
    renderPreview();
  });

  stage.addEventListener('pointermove',onStagePointerMove);
  stage.addEventListener('pointerup',onStagePointerUp);
  stage.addEventListener('pointercancel',onStagePointerUp);

  render();

  // Exposed for the isolated browser test harness only; not used by any production page.
  window.__visualCanvasTestHooks={
    getDoc:()=>structuredClone(doc),
    getSelectedId:()=>selectedId,
    getPreviewMode:()=>previewMode,
    // Test-only setup helper for boundary scenarios (e.g. a full grid); still goes
    // through model validation so it cannot introduce an invalid document.
    setDocForTest:testDoc=>{
      doc=Model.validate(testDoc,{approvedImages:Fixtures.approvedImages});
      selectedId=null;
      render();
    },
  };
})();
