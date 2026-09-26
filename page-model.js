// Shared custom-page contract and escaped renderer. No persistence or arbitrary HTML.
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ScavPages=api;})(globalThis,()=>{
  const types=['heading','text','image','card','divider','button'];
  const reserved=new Set(['index','home','admin','api','pages','data','images','assets','scripts','supabase','content-admin','page-builder','patch-admin','settings-admin','items-admin','vendors-admin','specialist-admin','admin-password','weapons','armour','items','ammo','ammunition','vendors','crafting','factions','areas','map','roadmap','evidence-import']);
  const fail=message=>{throw new Error(message);};
  const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(`${label} ${required?'is required and ':''}must be at most ${max} characters.`);return v;}
  function slug(value){if(typeof value!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)||value.length>80||reserved.has(value))fail('Choose a unique page address using lowercase letters, numbers and hyphens. System page names are protected.');return value;}
  function image(value){return typeof value==='string'&&/^(?:images|evidence-inbox)\/[a-zA-Z0-9_./ -]+\.(?:png|jpe?g|webp|gif)$/i.test(value)&&!value.split('/').some(p=>p==='.'||p==='..')&&!value.includes('//');}
  function link(value){if(typeof value!=='string'||value.length>500||/[\s\\<>"']/u.test(value))return false;return /^https:\/\/[^/]+(?:\/.*)?$/i.test(value)&&(()=>{try{return !new URL(value).username&&!new URL(value).password;}catch{return false;}})()||/^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)||/^[a-z0-9-]+\.html(?:#[a-zA-Z0-9_-]+)?$/.test(value);}
  function validate(page){
    if(!plain(page))fail('Invalid page.');
    text(page.id,80,'Page identity',true);text(page.title,160,'Page title',true);slug(page.slug);text(page.intro,1000,'Introduction');
    if(!Array.isArray(page.sections)||page.sections.length>40)fail('A page supports up to 40 sections.');
    const ids=new Set([page.id]);let count=0;
    const identity=id=>{text(id,80,'Content identity',true);if(ids.has(id))fail('Content identities must be unique.');ids.add(id);};
    const sections=page.sections.map(s=>{
      if(!plain(s))fail('Invalid section.');identity(s.id);text(s.title,160,'Section title');if(typeof s.hidden!=='boolean'||!Array.isArray(s.blocks))fail('Invalid section.');
      const blocks=s.blocks.map(b=>{
        if(!plain(b)||!types.includes(b.type))fail('Choose a supported block type.');identity(b.id);if(++count>200)fail('A page supports up to 200 blocks.');if(typeof b.hidden!=='boolean')fail('Invalid block visibility.');
        const result={id:b.id,type:b.type,hidden:b.hidden};
        if(['heading','card','button'].includes(b.type))result.title=text(b.title,160,'Block title',true);
        if(['text','card'].includes(b.type))result.text=text(b.text,10000,'Text',b.type==='text');
        if(['card','button'].includes(b.type)){if(!link(b.href))fail('Use an HTTPS link, an existing page such as items.html, or /pages/your-page.');result.href=b.href;}
        if(['image','card'].includes(b.type)){if(b.type==='image'||b.image){if(!image(b.image))fail('Choose an image from the image library.');result.image=b.image;}else result.image=null;result.alt=text(b.alt,300,'Image description',b.type==='image');}
        return result;
      });return {id:s.id,title:s.title,hidden:s.hidden,blocks};
    });return {id:page.id,title:page.title,slug:page.slug,intro:page.intro,sections};
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(input,{editing=false}={}){
    const page=validate(input),href=value=>/^https:/i.test(value)||value.startsWith('/')?value:'/'+value;
    const blocks=b=>{
      if(b.type==='heading')return `<h3>${esc(b.title)}</h3>`;
      if(b.type==='text')return `<p class="page-text">${esc(b.text)}</p>`;
      if(b.type==='image')return `<figure><img src="/${esc(b.image)}" alt="${esc(b.alt)}"></figure>`;
      if(b.type==='divider')return '<hr>';
      if(b.type==='button')return `<a class="page-button" href="${esc(href(b.href))}">${esc(b.title)}</a>`;
      return `<article class="page-card">${b.image?`<img src="/${esc(b.image)}" alt="${esc(b.alt)}">`:''}<h3><a href="${esc(href(b.href))}">${esc(b.title)}</a></h3><p class="page-text">${esc(b.text)}</p></article>`;
    };
    return `<header class="page-heading"><p class="page-brand">SCAVLAND</p><h1>${esc(page.title)}</h1><p class="page-text">${esc(page.intro)}</p></header>`+page.sections.filter(s=>editing||!s.hidden).map(s=>`<section ${editing?`data-section="${esc(s.id)}" tabindex="0"`:''} class="page-section ${editing&&s.hidden?'is-hidden':''}">${editing&&s.hidden?'<span class="hidden-label">HIDDEN SECTION</span>':''}${s.title?`<h2>${esc(s.title)}</h2>`:''}${s.blocks.filter(b=>editing||!b.hidden).map(b=>`<div ${editing?`data-block="${esc(b.id)}" tabindex="0"`:''} class="page-block ${editing&&b.hidden?'is-hidden':''}">${editing&&b.hidden?'<span class="hidden-label">HIDDEN BLOCK</span>':''}${blocks(b)}</div>`).join('')}</section>`).join('');
  }
  function document(page){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | SCAVLAND</title><link rel="stylesheet" href="/page-builder.css"></head><body class="published-page"><main class="page-preview">${render(page)}</main></body></html>`;}
  return Object.freeze({types,slug,validate,render,document,image,link});
});
