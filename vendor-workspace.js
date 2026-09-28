// Vendor-only frame sizing. No data, session or persistence messages are handled here.
(() => {
 const frame=document.getElementById('vendors-frame');
 if(frame){
  function viewport(){const r=frame.getBoundingClientRect();if(!r.width)return;frame.contentWindow.postMessage({type:'vendor-viewport',top:Math.max(0,-r.top),height:Math.max(240,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))},location.origin);}
  addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='vendor-height')return;const h=e.data.height;if(Number.isFinite(h)&&h>0&&h<100000){frame.style.height=Math.ceil(h)+'px';viewport();}});
  addEventListener('scroll',viewport,{passive:true});addEventListener('resize',viewport);frame.addEventListener('load',viewport);
 }else if(parent!==window&&document.querySelector('#inventory-workspace')){
  document.body.classList.add('vendor-embedded');
  const builder=document.querySelector('.builder');let last=0;
  new ResizeObserver(()=>{const height=Math.ceil(builder.getBoundingClientRect().height);if(height!==last){last=height;parent.postMessage({type:'vendor-height',height},location.origin);}}).observe(builder);
  addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='vendor-viewport')return;const {top,height}=e.data;if(!Number.isFinite(top)||!Number.isFinite(height)||top<0||height<0)return;document.documentElement.style.setProperty('--vendor-dialog-top',(top+height/2)+'px');document.documentElement.style.setProperty('--vendor-dialog-height',Math.max(180,height-24)+'px');});
 }
})();
