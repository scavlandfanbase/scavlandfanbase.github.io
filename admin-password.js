(async () => {
  const base='https://demtoqsafufzmnhvaykj.supabase.co',key='sb_publishable_0kdLCpTy7Sf8BKkIU5TOqw_Qaay4gzH';
  const params=new URLSearchParams(location.hash.slice(1)),status=document.getElementById('status'),form=document.getElementById('password-form');
  let token=params.get('access_token');
  history.replaceState(null,'',location.pathname);
  if(!token||!['invite','recovery'].includes(params.get('type'))){status.textContent='Open the link in your invitation or password-reset email. If it has expired, use Reset password on the admin sign-in page.';return;}
  const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  try{const check=await fetch(base+'/auth/v1/user',{headers});if(!check.ok)throw new Error();await check.json();}
  catch{status.textContent='This link could not be verified. Reopen the email link, or use Reset password on the admin sign-in page.';return;}
  status.textContent='Choose your own password (at least 8 characters), then sign in with your email address.';form.hidden=false;
  form.onsubmit=async event=>{
    event.preventDefault();const password=document.getElementById('new-password'),confirm=document.getElementById('confirm-password'),button=document.getElementById('save-password');
    if(password.value!==confirm.value){status.textContent='The passwords do not match.';return;}
    if(password.value.length<8){status.textContent='Use at least 8 characters.';return;}
    button.disabled=true;status.textContent='Saving password…';
    try{const response=await fetch(base+'/auth/v1/user',{method:'PUT',headers,body:JSON.stringify({password:password.value})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.msg||data.message||'Could not save your password.');password.value='';confirm.value='';form.hidden=true;token='';delete headers.Authorization;status.textContent='Password saved. You can now sign in to the admin page with your email and new password.';}
    catch(error){status.textContent=error.message;button.disabled=false;}
  };
})();
