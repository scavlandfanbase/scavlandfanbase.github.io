(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./page-builder-model.js'):root.ScavPageBuilderModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavPageCanvasOperations=api;})(globalThis,Model=>{
  // Pure editing commands for the existing page contract. Never save or publish.
  const defaultStyle=()=>({fontSize:'md',textColor:'default',background:'surface',border:'thin',padding:'md',align:'left',spacing:'normal'});
  function sectionOf(page,id){const section=page.sections.find(s=>s.id===id);if(!section||section.layout.mode!=='canvas')throw Error('Choose a canvas section.');return section;}
  function blockOf(section,id){const block=section.blocks.find(b=>b.id===id);if(!block)throw Error('Choose an existing canvas block.');return block;}
  function transact(page,context,edit){const candidate=Model.validate(page,context);edit(candidate);return Model.validate(candidate,context);}
  function freeRegion(section,w=6,h=8){
    for(let y=0;y+h<=Model.canvasLimits.rows;y++)for(let x=0;x+w<=Model.canvasLimits.columns;x++){
      const region={x,y,w,h};
      if(section.blocks.every(b=>{const r=b.canvas.desktop;return x+w<=r.x||x>=r.x+r.w||y+h<=r.y||y>=r.y+r.h;}))return region;
    }
    throw Error('No space remains in this canvas section. Resize a box or add another section.');
  }
  function addSection(page,context,id,title=''){
    return transact(page,context,next=>{next.sections.push({id,title,hidden:false,layout:{mode:'canvas'},blocks:[]});});
  }
  function addBlock(page,context,sectionId,content){
    return transact(page,context,next=>{
      const section=sectionOf(next,sectionId),used=new Set(section.blocks.map(b=>b.canvas.mobileOrder));let order=0;while(used.has(order))order++;
      if(Object.hasOwn(content,'canvas'))throw Error('New box positions are assigned by the canvas.');
      const desktop=freeRegion(section);
      section.blocks.push({...structuredClone(content),canvas:{desktop,mobileOrder:order,style:defaultStyle()}});
    });
  }
  function position(page,context,sectionId,blockId,desktop){
    return transact(page,context,next=>{blockOf(sectionOf(next,sectionId),blockId).canvas.desktop=structuredClone(desktop);});
  }
  function appearance(page,context,sectionId,blockId,style){
    return transact(page,context,next=>{blockOf(sectionOf(next,sectionId),blockId).canvas.style=structuredClone(style);});
  }
  function mobileMove(page,context,sectionId,blockId,direction){
    if(direction!==-1&&direction!==1)throw Error('Choose earlier or later.');
    return transact(page,context,next=>{
      const section=sectionOf(next,sectionId),blocks=[...section.blocks].sort((a,b)=>a.canvas.mobileOrder-b.canvas.mobileOrder);
      const index=blocks.findIndex(b=>b.id===blockId);if(index<0)throw Error('Choose an existing canvas block.');
      const other=blocks[index+direction];if(!other)return;
      [blocks[index].canvas.mobileOrder,other.canvas.mobileOrder]=[other.canvas.mobileOrder,blocks[index].canvas.mobileOrder];
    });
  }
  function duplicate(page,context,sectionId,blockId,newId){
    const section=sectionOf(page,sectionId),content=structuredClone(blockOf(section,blockId));delete content.canvas;content.id=newId;
    const next=addBlock(page,context,sectionId,content);blockOf(sectionOf(next,sectionId),newId).canvas.style=structuredClone(blockOf(section,blockId).canvas.style);return next;
  }
  return Object.freeze({addSection,addBlock,position,appearance,mobileMove,duplicate});
});
