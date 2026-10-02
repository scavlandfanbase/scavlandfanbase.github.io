(function(root,factory){const api=factory(typeof module==='object'?require('./visual-canvas-model.js'):root.ScavVisualCanvasModel);if(typeof module==='object')module.exports=api;else root.ScavVisualCanvasRenderer=api;})(globalThis,Model=>{
  // Safe preview/export rendering for the visual canvas fixture contract.
  // Escapes all text, allows only approved images and safe links - no raw HTML/JS/CSS input.
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href=value=>/^https:/i.test(value)?value:'/'+value;

  function validate(input,{images}={}){return Model.validate(input,{approvedImages:images});}

  function styleClasses(style){
    return [`fs-${style.fontSize}`,`tc-${style.textColor}`,`bg-${style.background}`,`bd-${style.border}`,`pd-${style.padding}`,`al-${style.align}`,`sp-${style.spacing}`].join(' ');
  }

  function renderBlockContent(block){
    if(block.type==='text')return `<p class="canvas-text">${esc(block.text)}</p>`;
    if(block.type==='image')return `<figure class="canvas-figure"><img src="/${esc(block.image)}" alt="${esc(block.alt)}"></figure>`;
    return `<article class="canvas-card">${block.image?`<img src="/${esc(block.image)}" alt="${esc(block.alt)}">`:''}<h3>${esc(block.title)}</h3>${block.text?`<p class="canvas-text">${esc(block.text)}</p>`:''}<a class="canvas-card-link" href="${esc(href(block.href))}">${esc(block.title)}</a></article>`;
  }

  function render(input,{images,breakpoint='desktop'}={}){
    const doc=validate(input,{images});
    const blocks=breakpoint==='mobile'
      ? [...doc.blocks].sort((a,b)=>a.mobileOrder-b.mobileOrder)
      : doc.blocks;
    const items=blocks.map(block=>{
      const region=breakpoint==='mobile'?null:block.desktop;
      const position=region?`style="grid-column:${region.x+1} / span ${region.w};grid-row:${region.y+1} / span ${region.h};"`:'';
      return `<div class="canvas-block ${styleClasses(block.style)}" data-block="${esc(block.id)}" ${position}>${renderBlockContent(block)}</div>`;
    }).join('');
    const gridClass=breakpoint==='mobile'?'canvas-stage mobile-stack':'canvas-stage desktop-grid';
    return `<section class="${gridClass}"><h2 class="canvas-doc-title">${esc(doc.title)}</h2><div class="canvas-blocks">${items}</div></section>`;
  }

  return Object.freeze({validate,render});
});
