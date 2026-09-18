(function(){
function buildShell(){
 document.querySelectorAll('.scav-header,.site-nav,.nav-bar').forEach(el=>el.remove());
 [...document.body.children].filter(el=>el.tagName==='HEADER'&&el.querySelector('nav')).forEach(el=>el.remove());
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const links=[['index.html','Home'],['vendors.html','Vendors'],['weapons.html','Weapons'],['armour.html','Armour'],['crafting.html','Crafting'],['map.html','Map'],['factions.html','Factions'],['areas.html','Areas']];
 const header=document.createElement('header');header.className='scav-site-header';
 header.innerHTML='<img class="scav-site-logo" src="images/branding/Scavland_Logo_2025.png" alt="SCAVLAND"><div class="scav-site-subtitle">Wasteland Survival Database</div>';
 const nav=document.createElement('nav');nav.className='scav-site-nav';nav.setAttribute('aria-label','Main navigation');
 nav.innerHTML='<div class="scav-site-nav-inner">'+links.map(([href,label])=>'<a href="'+href+'"'+(page===href?' class="active" aria-current="page"':'')+'>'+label+'</a>').join('')+'</div>';
 document.body.prepend(nav);document.body.prepend(header);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildShell);else buildShell();
})();