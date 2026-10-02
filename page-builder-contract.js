(function(root,factory){const api=factory(typeof module==='object'?require('./page-builder-model.js'):root.ScavPageBuilderModel);if(typeof module==='object')module.exports=api;else root.ScavPageBuilder=api;})(globalThis,Model=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validate(input,{images,existingPages,currentPageId=null}={}){
    return Model.validate(input,{approvedImages:images,existingPages,currentPageId});
  }
  function render(input,{images,existingPages,currentPageId=null,editing=false}={}){
    const page=validate(input,{images,existingPages,currentPageId}),href=value=>/^https:/i.test(value)||value.startsWith('/')?value:'/'+value;
    const renderBlock=block=>{
      if(block.type==='heading')return `<h3>${esc(block.title)}</h3>`;
      if(block.type==='text')return `<p class="page-text">${esc(block.text)}</p>`;
      if(block.type==='image')return `<figure><img src="/${esc(block.image)}" alt="${esc(block.alt)}"></figure>`;
      if(block.type==='divider')return '<hr>';
      if(block.type==='button')return `<a class="page-button" href="${esc(href(block.href))}">${esc(block.title)}</a>`;
      return `<article class="page-card">${block.image?`<img src="/${esc(block.image)}" alt="${esc(block.alt)}">`:''}<h3><a href="${esc(href(block.href))}">${esc(block.title)}</a></h3><p class="page-text">${esc(block.text)}</p></article>`;
    };
    return `<header class="page-heading"><p class="page-brand">SCAVLAND</p><h1>${esc(page.title)}</h1><p class="page-text">${esc(page.intro)}</p></header>`+page.sections.filter(section=>editing||!section.hidden).map(section=>{
      if(section.layout.mode==='canvas'){
        const blocks=section.blocks.filter(block=>editing||!block.hidden).slice().sort((a,b)=>a.canvas.mobileOrder-b.canvas.mobileOrder);
        return `<section ${editing?`data-section="${esc(section.id)}"`:''} class="page-section canvas-section background-${section.layout.background??'none'} ${section.layout.border?'has-border':''} ${editing&&section.hidden?'is-hidden':''}">${section.title?`<h2>${esc(section.title)}</h2>`:''}<div class="section-blocks">${blocks.map(block=>{
          const {desktop:r,style}=block.canvas;
          const classes=Object.entries(style).map(([key,value])=>`canvas-${key}-${value}`).join(' ');
          return `<div ${editing?`data-block="${esc(block.id)}"`:''} class="page-block ${classes} canvas-x-${r.x} canvas-y-${r.y} canvas-w-${r.w} canvas-h-${r.h} ${editing&&block.hidden?'is-hidden':''}">${renderBlock(block)}</div>`;
        }).join('')}</div></section>`;
      }
      const layout=section.layout,classes=['page-section',`columns-${layout.columns??1}`,`align-${layout.align??'start'}`,`spacing-${layout.spacing??'normal'}`,`background-${layout.background??'none'}`,layout.border?'has-border':'',editing&&section.hidden?'is-hidden':''].filter(Boolean).join(' ');
      return `<section ${editing?`data-section="${esc(section.id)}"`:''} class="${classes}">${editing&&section.hidden?'<span class="hidden-label">HIDDEN SECTION - omitted from export</span>':''}${section.title?`<h2>${esc(section.title)}</h2>`:''}<div class="section-blocks">${section.blocks.filter(block=>editing||!block.hidden).map(block=>`<div ${editing?`data-block="${esc(block.id)}"`:''} class="page-block ${editing&&block.hidden?'is-hidden':''}">${editing&&block.hidden?'<span class="hidden-label">HIDDEN BLOCK - omitted from export</span>':''}${renderBlock(block)}</div>`).join('')}</div></section>`;
    }).join('');
  }
  function document(input,{images,existingPages,currentPageId=null,css=''}={}){
    const page=validate(input,{images,existingPages,currentPageId});
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | SCAVLAND</title><style>${css}</style></head><body class="published-page"><main class="page-preview">${render(page,{images,existingPages,currentPageId})}</main></body></html>`;
  }
  return Object.freeze({validate,render,document});
});