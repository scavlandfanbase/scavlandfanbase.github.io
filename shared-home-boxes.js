(function(){
 if(document.querySelector('[data-section-id="feature-grid"]')||document.querySelector('.scav-shared-boxes')||document.documentElement.dataset.sharedBoxesLoading||/^\/(?:admin|[^/]+-(?:admin|builder|category))\.html$/.test(location.pathname))return;
 document.documentElement.dataset.sharedBoxesLoading='true';
 const safeHref=value=>typeof value==='string'&&(/^(?:[a-z-]+\.html|\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*\/)(?:[?#][^\s\\]*)?$/.test(value)||/^https:\/\/[^\s\\]+$/i.test(value));
 fetch('/data/site-content.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(content=>{
  const section=content?.pages?.['index.html']?.sections?.find(s=>s.id==='feature-grid');if(!section||section.hidden)return;
  const cards=(section.cards||[]).filter(card=>!card.hidden&&safeHref(card.href));if(!cards.length)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared-home-boxes.css?v=20261002-1';document.head.append(css);
  const nav=document.createElement('nav');nav.className='scav-shared-boxes';nav.setAttribute('aria-label','Homepage categories');
  for(const card of cards){const a=document.createElement('a');a.href=/^https:\/\//i.test(card.href)||card.href.startsWith('/')?card.href:'/'+card.href;
   const title=document.createElement('strong'),description=document.createElement('span');title.textContent=card.title||'';description.textContent=card.description||'';
   if(typeof card.image==='string'&&/^images\/[A-Za-z0-9._ ()/-]+\.(?:png|jpe?g|webp)$/i.test(card.image)&&!card.image.includes('..')){const img=document.createElement('img');img.src='/'+card.image;img.alt='';img.loading='lazy';a.append(img);}
   a.append(title,description);nav.append(a);}
  const top=document.querySelector('.scav-site-nav');if(top)top.after(nav);else document.body.prepend(nav);
 }).catch(()=>{});
})();
