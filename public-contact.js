// No credentials, inbox reads, tracking or local storage. Retry keeps its opaque ID.
const form=document.getElementById('public-contact');
if(form){
 const button=form.querySelector('button[type="submit"]'),status=document.getElementById('contact-status');
 const endpoint=form.dataset.endpoint;let id=crypto.randomUUID(),previous=null;
 // Keep the HTML submit button disabled until this configured script is running.
 button.disabled=!(endpoint&&form.dataset.enabled==='true');
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!endpoint||form.dataset.enabled!=='true')return;
  if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));const current=JSON.stringify(values);
  if(previous!==null&&current!==previous)id=crypto.randomUUID();previous=current;
  button.disabled=true;status.textContent='Sending privately…';
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify({id,...values}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(response.status!==201||result.saved!==true)throw Error(response.status===429?'The contact service is busy. Please try again later.':'Request not confirmed. Check the form and retry; do not assume delivery.');
   status.textContent='Request saved privately for review. No email was sent. Thank you.';form.reset();id=crypto.randomUUID();previous=null;
  }catch(error){status.textContent=error instanceof Error&&error.message.startsWith('The contact service')?error.message:'Request not confirmed. Please retry; do not assume delivery.';}
  finally{button.disabled=false;}
 });
}
