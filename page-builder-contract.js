(function(root,factory){const api=factory(typeof module==='object'?require('./page-model.js'):root.ScavPages);if(typeof module==='object')module.exports=api;else root.ScavPageBuilder=api;})(globalThis,Pages=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fail=message=>{throw new Error(message);};
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const choices={columns:[1,2,3],align:['start','center'],spacing:['compact','normal','spacious'],background:['none','surface','subtle']};
  const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
  function validate(input,{images=[]}={}){
    const page=Pages.validate(input),approved=new Set(images);
    if(!identity(page.id))fail('Page identity is invalid.');
    page.sections=page.sections.map((section,index)=>{
      const source=input.sections[index],layout=source.layout===undefined?{}:source.layout;
      if(!plain(layout)||!choices.columns.includes(layout.columns??1)||!choices.align.includes(layout.align??'start')||!choices.spacing.includes(layout.spacing??'normal')||!choices.background.includes(layout.background??'none')||typeof (layout.border??false)!=='boolean')fail('Choose valid section layout settings.');
      if(!identity(section.id))fail('Section identity is invalid.');
      section.layout={columns:layout.columns??1,align:layout.align??'start',spacing:layout.spacing??'normal',background:layout.background??'none',border:layout.border??false};
      section.blocks=section.blocks.map(block=>{
        if(!identity(block.id))fail('Block identity is invalid.');
        if(block.type==='image'||block.type==='card'&&block.image){if(!approved.has(block.image))fail('Choose an approved image from the image library.');}
        return block;
      });
      return section;
    });
    return page;
  }
  function render(input,{images=[],editing=false}={}){
    const page=validate(input,{images}),href=value=>/^https:/i.test(value)||value.startsWith('/')?value:'/'+value;
    const renderBlock=block=>{
      if(block.type==='heading')return `<h3>${esc(block.title)}</h3>`;
      if(block.type==='text')return `<p class="page-text">${esc(block.text)}</p>`;
      if(block.type==='image')return `<figure><img src="/${esc(block.image)}" alt="${esc(block.alt)}"></figure>`;
      if(block.type==='divider')return '<hr>';
      if(block.type==='button')return `<a class="page-button" href="${esc(href(block.href))}">${esc(block.title)}</a>`;
      return `<article class="page-card">${block.image?`<img src="/${esc(block.image)}" alt="${esc(block.alt)}">`:''}<h3><a href="${esc(href(block.href))}">${esc(block.title)}</a></h3><p class="page-text">${esc(block.text)}</p></article>`;
    };
    return `<header class="page-heading"><p class="page-brand">SCAVLAND</p><h1>${esc(page.title)}</h1><p class="page-text">${esc(page.intro)}</p></header>`+page.sections.filter(section=>editing||!section.hidden).map(section=>{
      const layout=section.layout,classes=['page-section',`columns-${layout.columns}`,`align-${layout.align}`,`spacing-${layout.spacing}`,`background-${layout.background}`,layout.border?'has-border':'',editing&&section.hidden?'is-hidden':''].filter(Boolean).join(' ');
      return `<section ${editing?`data-section="${esc(section.id)}"`:''} class="${classes}">${editing&&section.hidden?'<span class="hidden-label">HIDDEN SECTION - omitted from export</span>':''}${section.title?`<h2>${esc(section.title)}</h2>`:''}<div class="section-blocks">${section.blocks.filter(block=>editing||!block.hidden).map(block=>`<div ${editing?`data-block="${esc(block.id)}"`:''} class="page-block ${editing&&block.hidden?'is-hidden':''}">${editing&&block.hidden?'<span class="hidden-label">HIDDEN BLOCK - omitted from export</span>':''}${renderBlock(block)}</div>`).join('')}</div></section>`;
    }).join('');
  }
  function document(input,{images=[],css=''}={}){
    const page=validate(input,{images});
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | SCAVLAND</title><style>${css}</style></head><body class="published-page"><main class="page-preview">${render(page,{images})}</main></body></html>`;
  }
  return Object.freeze({validate,render,document});
});