(function(){
function buildShell(){
 document.querySelectorAll('.scav-header,.site-nav,.nav-bar').forEach(el=>el.remove());
 [...document.body.children].filter(el=>el.tagName==='HEADER'&&el.querySelector('nav')).forEach(el=>el.remove());
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const links=[['index.html','Home'],['vendors.html','Vendors'],['weapons.html','Weapons'],['armour.html','Armour'],['crafting.html','Crafting'],['map.html','Map'],['items.html','Items'],['factions.html','Factions'],['areas.html','Areas'],['roadmap.html','Roadmap']];
 const header=document.createElement('header');header.className='scav-site-header';
 header.innerHTML='<img class="scav-site-logo" src="images/branding/Scavland_Logo_2025.png" alt="SCAVLAND"><div class="scav-site-subtitle">Wasteland Survival Database</div>';
 const nav=document.createElement('nav');nav.className='scav-site-nav';nav.setAttribute('aria-label','Main navigation');
 nav.innerHTML='<div class="scav-site-nav-inner">'+links.map(([href,label])=>'<a href="'+href+'"'+(page===href?' class="active" aria-current="page"':'')+'>'+label+'</a>').join('')+'</div>';
 document.body.prepend(nav);document.body.prepend(header);
 const applySettings=settings=>{
  const pageSettings=(settings.pages||{})[page]||{}, values={...(settings.global||{}),...pageSettings};
  const root=document.documentElement.style;
  if(values.backgroundImage)root.setProperty('--site-background-image',`url('${values.backgroundImage.replace(/'/g,"%27")}')`);
  if(values.headerImage)root.setProperty('--site-header-image',`url('${values.headerImage.replace(/'/g,"%27")}')`);
  if(values.fontFamily)root.setProperty('--site-font-family',values.fontFamily);
  if(values.fontSize)root.setProperty('--site-font-size',values.fontSize);
    if(values.accentColor)root.setProperty('--site-accent-color',values.accentColor);
    if(values.textColor)root.setProperty('--site-text-color',values.textColor);
    if(values.panelColor)root.setProperty('--site-panel-color',values.panelColor);
    if(values.navColor)root.setProperty('--site-nav-color',values.navColor);
    if(values.radius)root.setProperty('--site-radius',values.radius);
  if(values.subtitle)header.querySelector('.scav-site-subtitle').textContent=values.subtitle;
    if(values.pageTitle){const title=document.querySelector('.hero h1,main h1,body>h1');if(title)title.textContent=values.pageTitle}
    if(values.pageIntro){const intro=document.querySelector('.hero p,main>section>p,main>p');if(intro)intro.textContent=values.pageIntro}
    if(values.footerText){const footer=document.querySelector('footer');if(footer)footer.textContent=values.footerText}
    if(values.navLabels&&typeof values.navLabels==='object')nav.querySelectorAll('a').forEach(link=>{const label=values.navLabels[link.getAttribute('href')];if(label)link.textContent=label});
 };
   const previewKey='scavland-admin-preview';
   const previewSettings=()=>{try{return new URLSearchParams(location.search).has('adminPreview')?JSON.parse(localStorage.getItem(previewKey)||'null'):null}catch{return null}};
   fetch('data/site-settings.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(settings=>{if(settings){const override=previewSettings();if(override){settings={...settings,global:{...settings.global,...override}}}applySettings(settings)}}).catch(()=>{});
  fetch('data/site-content.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(content=>{const pageContent=content?.pages?.[page];if(!pageContent)return;const title=document.querySelector('.hero h1,main h1,body>h1'),intro=document.querySelector('.hero p,main>section>p,main>p');if(pageContent.title&&title)title.textContent=pageContent.title;if(pageContent.intro&&intro)intro.textContent=pageContent.intro;const cards=[...document.querySelectorAll('.grid .card')],sourceCards=pageContent.sections?.flatMap(section=>section.cards||[])||[];sourceCards.forEach((card,index)=>{const target=cards[index];if(!target)return;if(card.title)target.querySelector('h3')?.replaceChildren(document.createTextNode(card.title));if(card.description)target.querySelector('p')?.replaceChildren(document.createTextNode(card.description));if(card.href)target.onclick=()=>location.href=card.href});if(page==='roadmap.html')pageContent.sections?.forEach((section,index)=>{const column=document.querySelectorAll('.roadmap-column')[index];if(!column)return;if(section.title)column.querySelector('h2')?.replaceChildren(document.createTextNode(section.title));(section.cards||[]).forEach((card,cardIndex)=>{const item=column.querySelectorAll('li')[cardIndex];if(!item)return;item.querySelector('strong')?.replaceChildren(document.createTextNode(card.title||''));item.querySelector('span')?.replaceChildren(document.createTextNode(card.description||''))})});const update=pageContent.sections?.find(section=>section.id==='latest-update');if(update?.title)document.querySelector('.updates h2')?.replaceChildren(document.createTextNode(update.title))}).catch(()=>{});
  if(page==='index.html'){const update=pageContent.sections?.find(section=>section.id==='latest-update'),box=document.getElementById('updateBox');if(update&&box){box.querySelector('h3')?.replaceChildren(document.createTextNode(update.title||'Latest Update'));box.querySelector('p')?.replaceChildren(document.createTextNode(update.summary||''));const link=box.querySelector('a');if(link&&update.url)link.href=update.url}}
  if(page==='factions.html')pageContent.sections?.flatMap(section=>section.cards||[]).forEach(card=>{const box=document.getElementById(card.id);if(!box)return;box.querySelector('.faction-title')?.replaceChildren(document.createTextNode(card.title||''));box.querySelector('.faction-text')?.replaceChildren(document.createTextNode(card.description||''))});
  if(page==='areas.html'){const heading=document.querySelector('.areas-head h1'),intro=document.querySelector('.areas-head p');if(pageContent.title&&heading)heading.textContent=pageContent.title;if(pageContent.intro&&intro)intro.textContent=pageContent.intro}
  if(page==='map.html'){const heading=document.querySelector('.map-intro h1,main h1,body>h1');const intro=document.querySelector('.map-intro p,main>section>p');if(pageContent.title&&heading)heading.textContent=pageContent.title;if(pageContent.intro&&intro)intro.textContent=pageContent.intro}
  if(['vendors.html','weapons.html','armour.html','crafting.html','items.html'].includes(page)){const heading=document.querySelector('.hero h1,main h1,body>h1'),intro=document.querySelector('.hero p,main>section>p,main>p');if(pageContent.title&&heading)heading.textContent=pageContent.title;if(pageContent.intro&&intro)intro.textContent=pageContent.intro}
  pageContent.sections?.forEach(section=>{if(!section.target)return;const target=document.querySelector(section.target);if(!target)return;if(section.title)target.textContent=section.title;const sibling=target.nextElementSibling;if(section.intro&&sibling&&sibling.tagName==='P')sibling.textContent=section.intro});
  if(new URLSearchParams(location.search).has('adminContentPreview'))fetch('data/site-content.json',{cache:'no-store'}).then(r=>r.json()).then(content=>{const preview=JSON.parse(localStorage.getItem('scavland-content-preview')||'null');if(preview?.page!==page)return;const pageContent=preview.content,title=document.querySelector('.hero h1,main h1,body>h1'),intro=document.querySelector('.hero p,main>section>p,main>p');if(pageContent.title&&title)title.textContent=pageContent.title;if(pageContent.intro&&intro)intro.textContent=pageContent.intro;const cards=[...document.querySelectorAll('.grid .card')],sourceCards=pageContent.sections?.flatMap(section=>section.cards||[])||[];sourceCards.forEach((card,index)=>{const target=cards[index];if(!target)return;target.querySelector('h3')?.replaceChildren(document.createTextNode(card.title||''));target.querySelector('p')?.replaceChildren(document.createTextNode(card.description||''))})}).catch(()=>{});
  fetch('data/site-content.json',{cache:'no-store'}).then(r=>r.json()).then(content=>{const global=content?.global;if(global?.footerText){const footer=document.querySelector('footer');if(footer)footer.textContent=global.footerText}if(Array.isArray(global?.navigation))global.navigation.forEach(item=>{const link=nav.querySelector('a[href="'+item.page+'"]');if(link&&item.label)link.textContent=item.label})}).catch(()=>{});
  fetch('data/site-content.json',{cache:'no-store'}).then(r=>r.json()).then(content=>{const pageContent=content?.pages?.[page];const cards=pageContent?.sections?.flatMap(section=>section.cards||[])||[];document.querySelectorAll('.grid .card img').forEach((image,index)=>{if(cards[index]?.image)image.src=cards[index].image})}).catch(()=>{});
  if(new URLSearchParams(location.search).has('adminPreview'))window.addEventListener('storage',e=>{if(e.key===previewKey)location.reload()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildShell);else buildShell();
})();

