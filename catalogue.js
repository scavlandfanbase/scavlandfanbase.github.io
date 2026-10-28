/* Public-only catalogue index. No credentials, private endpoints or HTML from query strings. */
(async()=>{
 const main=document.querySelector('main[data-view]');if(!main)return;
 const form=document.querySelector('#search-form'),status=document.querySelector('#results-status'),results=document.querySelector('#results'),pager=document.querySelector('#pager');
 try{
 const response=await fetch('/catalogue.json');if(!response.ok)throw Error();const data=await response.json(),records=data[main.dataset.view];if(!Array.isArray(records))throw Error();
 const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function render(){
 const params=new URLSearchParams(location.search),search=(params.get('search')||'').slice(0,120),category=params.get('category')||'',related=params.get('relatedTo');
 form.elements.search.value=search;form.elements.category.value=category;
 const matching=records.filter(r=>(!category||r.category===category)&&(!related||r.related.includes(related))&&(!search||[r.name,r.id].some(v=>v.toLowerCase().includes(search.toLowerCase()))));
 const raw=Number(params.get('offset')||0),offset=Number.isSafeInteger(raw)&&raw>=0?Math.min(raw,Math.max(0,Math.ceil(matching.length/24)*24-24)):0;
 status.textContent=matching.length+' records'+(matching.length?' · '+(offset+1)+'–'+Math.min(offset+24,matching.length):' · Try another name or category.');results.replaceChildren();pager.replaceChildren();
 for(const r of matching.slice(offset,offset+24)){
 const a=element('a');a.className='item';a.href=r.url;const art=element('div');art.className='item-art';if(r.image&&/^\/images\/[a-f0-9]{64}\.png$/.test(r.image)){const image=element('img');image.className='game-icon';image.src=r.image;image.alt=r.name;image.loading='lazy';image.decoding='async';art.append(image);}else{const placeholder=element('span','Image unavailable');placeholder.className='missing';art.append(placeholder);}
 const copy=element('div');copy.className='item-copy';copy.append(element('small',r.category||''),element('h3',r.name),element('span','View details →'));a.append(art,copy);results.append(a);
 }
 for(const [label,n] of [['Previous',offset-24],['Next',offset+24]])if(n>=0&&n<matching.length){const link=element('a',label),p=new URLSearchParams(params);p.set('offset',String(n));link.href=location.pathname+'?'+p;link.addEventListener('click',event=>{event.preventDefault();history.pushState(null,'',link.href);render();status.focus();});pager.append(link);}
 }
 status.tabIndex=-1;
 form.addEventListener('submit',event=>{event.preventDefault();const p=new URLSearchParams(location.search);p.set('search',form.elements.search.value);p.set('category',form.elements.category.value);p.delete('offset');history.pushState(null,'',location.pathname+'?'+p);render();});
 form.elements.category.addEventListener('change',()=>form.requestSubmit());window.addEventListener('popstate',render);render();
 }catch{status.textContent='Catalogue unavailable. Please reload or use the complete catalogue.';const a=document.createElement('a');a.href='/catalogue/';a.textContent='Complete catalogue';results.replaceChildren(a);}
})();
