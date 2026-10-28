/* One original community image; transformations affect the viewport, never its contents. */
(() => {
 const panel=document.querySelector('#map-panel'),surface=document.querySelector('#map-surface'),image=document.querySelector('#community-map');
 if(!panel||!surface||!image)return;
 const status=document.querySelector('#map-status'),zoomText=document.querySelector('#map-zoom'),full=document.querySelector('#map-fullscreen');
 const pointers=new Map();let zoom=1,fit=1,x=0,y=0,ready=false,width=0,height=0;
 const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
 function render(){
  const s=fit*zoom,w=image.naturalWidth*s,h=image.naturalHeight*s;
  x=w<=width?(width-w)/2:limit(x,width-w,0);y=h<=height?(height-h)/2:limit(y,height-h,0);
  image.style.transform=`translate(${x}px, ${y}px) scale(${s})`;
  zoomText.textContent=Math.round(zoom*100)+'%';
  document.querySelector('#map-out').disabled=!ready||zoom<=1;
  document.querySelector('#map-in').disabled=!ready||zoom>=32;
 }
 function resize(reset=false){
  const old=fit*zoom,cx=old?(width/2-x)/old:0,cy=old?(height/2-y)/old:0;
  width=surface.clientWidth;height=surface.clientHeight;
  if(!ready||!width||!height)return;
  fit=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  if(reset){zoom=1;x=0;y=0;}else{x=width/2-cx*fit*zoom;y=height/2-cy*fit*zoom;}
  render();
 }
 function zoomAt(next,cx=width/2,cy=height/2){
  if(!ready)return;next=limit(next,1,32);const ratio=next/zoom;
  x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;zoom=next;render();
 }
 function local(e){const r=surface.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function metrics(){const a=[...pointers.values()];if(a.length===1)return {...a[0],distance:0};return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};}
 surface.addEventListener('pointerdown',e=>{
  if(!ready||(e.pointerType==='mouse'&&e.button!==0)||pointers.size>=2)return;
  surface.focus({preventScroll:true});pointers.set(e.pointerId,local(e));surface.setPointerCapture(e.pointerId);surface.classList.add('dragging');
 });
 surface.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const before=metrics();pointers.set(e.pointerId,local(e));const after=metrics();
  if(pointers.size===2&&before.distance>0){const next=limit(zoom*after.distance/before.distance,1,32),ratio=next/zoom;
   x=after.x-(before.x-x)*ratio;y=after.y-(before.y-y)*ratio;zoom=next;
  }else{x+=after.x-before.x;y+=after.y-before.y;}render();
 });
 function finish(e){pointers.delete(e.pointerId);if(!pointers.size)surface.classList.remove('dragging');}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,finish);
 window.addEventListener('blur',()=>{pointers.clear();surface.classList.remove('dragging');});
 surface.addEventListener('wheel',e=>{if(!ready)return;e.preventDefault();const p=local(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);zoomAt(zoom*Math.exp(-limit(delta,-500,500)*.002),p.x,p.y);},{passive:false});
 surface.addEventListener('dragstart',e=>e.preventDefault());
 document.querySelector('#map-in').addEventListener('click',()=>zoomAt(zoom*1.5));
 document.querySelector('#map-out').addEventListener('click',()=>zoomAt(zoom/1.5));
 document.querySelector('#map-reset').addEventListener('click',()=>{pointers.clear();resize(true);});
 surface.addEventListener('keydown',e=>{
  if(!ready)return;const moves={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};
  if(moves[e.key]){e.preventDefault();x+=moves[e.key][0];y+=moves[e.key][1];render();}
  else if(['+','=','-','0','Home'].includes(e.key)){e.preventDefault();if(e.key==='0'||e.key==='Home')resize(true);else zoomAt(zoom*(e.key==='-'?1/1.5:1.5));}
 });
 function fullState(){const active=document.fullscreenElement===panel||panel.classList.contains('map-expanded');full.textContent=active?'Exit full screen':'Full screen';full.setAttribute('aria-pressed',String(active));resize();}
 full.addEventListener('click',async()=>{
  try{if(document.fullscreenElement===panel)await document.exitFullscreen();else if(panel.classList.contains('map-expanded'))panel.classList.remove('map-expanded');else if(panel.requestFullscreen)await panel.requestFullscreen();else panel.classList.add('map-expanded');}
  catch{panel.classList.toggle('map-expanded');}fullState();
 });
 document.addEventListener('fullscreenchange',fullState);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('map-expanded')){panel.classList.remove('map-expanded');fullState();full.focus();}});
 function loaded(){if(!image.naturalWidth)return;ready=true;status.textContent='Map ready. Drag to explore, or use the zoom controls.';resize(true);}
 image.addEventListener('load',loaded);image.addEventListener('error',()=>{ready=false;status.textContent='The map could not load. Try reloading or open the original image below.';render();});
 new ResizeObserver(()=>resize()).observe(surface);
 if(image.complete)loaded();
})();
