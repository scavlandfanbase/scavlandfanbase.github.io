(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavVisualCanvasLayout=api;})(globalThis,()=>{
  // Pure desktop-grid geometry helpers shared by the model (contract validation)
  // and the editor (interactive placement). No DOM, no fixtures, no I/O.
  function regionsOverlap(a,b){
    return !(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
  }

  function regionInBounds(region,grid){
    const {cols,maxRows,minW,minH}=grid;
    return Number.isInteger(region.x)&&Number.isInteger(region.y)&&Number.isInteger(region.w)&&Number.isInteger(region.h)
      &&region.x>=0&&region.y>=0&&region.w>=minW&&region.h>=minH
      &&region.x+region.w<=cols&&region.y+region.h<=maxRows;
  }

  function overlapsAny(region,blocks,excludeId){
    return blocks.some(block=>block.id!==excludeId&&regionsOverlap(region,block.desktop));
  }

  function canPlace(region,blocks,grid,excludeId){
    return regionInBounds(region,grid)&&!overlapsAny(region,blocks,excludeId);
  }

  function findFreeRegion(blocks,size,grid){
    const {cols,maxRows}=grid;
    for(let y=0;y<=maxRows-size.h;y++){
      for(let x=0;x<=cols-size.w;x++){
        const candidate={x,y,w:size.w,h:size.h};
        if(canPlace(candidate,blocks,grid,null))return candidate;
      }
    }
    return null;
  }

  return Object.freeze({regionsOverlap,regionInBounds,overlapsAny,canPlace,findFreeRegion});
});
