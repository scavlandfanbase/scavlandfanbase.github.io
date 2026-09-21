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
 };
 fetch('data/site-settings.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(settings=>{if(settings)applySettings(settings)}).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildShell);else buildShell();
})();

