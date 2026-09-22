const cors={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const allowed=['evidence_review','items_edit','weapons_edit','armour_edit','crafting_edit','ammunition_edit','vendors_edit','settings_edit','content_edit'];
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'POST is required.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)throw Object.assign(new Error('Admin management is not configured.'),{status:503});
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))throw Object.assign(new Error('Sign in first.'),{status:403});
  const userHeaders={apikey:anon,Authorization:auth,'Content-Type':'application/json'};
  const ur=await fetch(url+'/auth/v1/user',{headers:userHeaders}); if(!ur.ok)throw Object.assign(new Error('Your session expired.'),{status:403});
  const owner=await fetch(url+'/rest/v1/rpc/is_scavland_owner',{method:'POST',headers:userHeaders,body:'{}'});
  if(!owner.ok||await owner.json()!==true)throw Object.assign(new Error('Owner access is required.'),{status:403});
  const body=await req.json().catch(()=>({})), action=body.action;
  const adminHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const admins=async()=>{const r=await fetch(url+'/rest/v1/admin_users?select=user_id,created_at,role,display_name,is_active,permissions&order=created_at.asc',{headers:adminHeaders});if(!r.ok)throw new Error('Could not load administrators.');return r.json()};
  const authUsers=async()=>{let page=1,out=[];for(;;){const r=await fetch(url+'/auth/v1/admin/users?page='+page+'&per_page=100',{headers:adminHeaders});if(!r.ok)throw new Error('Could not load account emails.');const d=await r.json(),batch=d.users||[];out.push(...batch);if(batch.length<100)break;page++;}return out};
  if(action==='list'){const [rows,users]=await Promise.all([admins(),authUsers()]);const email=new Map(users.map(u=>[u.id,u.email]));return reply({admins:rows.map(a=>({...a,email:email.get(a.user_id)||''}))});}
  if(action==='invite'){
   const email=String(body.email||'').trim().toLowerCase(),name=String(body.displayName||'').trim(),role=body.role==='reviewer'?'reviewer':'admin';
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Object.assign(new Error('Enter a valid email address.'),{status:400});
   let users=await authUsers(),u=users.find(x=>String(x.email||'').toLowerCase()===email);
   if(u&&(await admins()).some(a=>a.user_id===u.id&&a.role==='owner'))throw Object.assign(new Error('This is the protected Owner account. It already has full access.'),{status:400});
   if(!u){const r=await fetch(url+'/auth/v1/invite?redirect_to='+encodeURIComponent('https://scavlandfanbase.github.io/admin-password.html'),{method:'POST',headers:adminHeaders,body:JSON.stringify({email,data:{display_name:name}})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.msg||d.message||'Could not send invitation.'),{status:400});u=d;}
   const permissions=role==='reviewer'?['evidence_review']:allowed;
   const r=await fetch(url+'/rest/v1/admin_users?on_conflict=user_id',{method:'POST',headers:{...adminHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:u.id,display_name:name||null,role,is_active:true,permissions})});
   if(!r.ok)throw new Error('The account exists, but website access could not be saved. Retry this same email to finish setup; no duplicate invitation will be sent.');return reply({ok:true,message:'Website access saved. New invitees can set their password using the invitation email. Existing accounts can sign in or use Reset password.'});
  }
  if(action==='update'){
   const id=String(body.userId||''),rows=await admins(),target=rows.find(a=>a.user_id===id);if(!target)throw Object.assign(new Error('Administrator not found.'),{status:404});
   if(target.role==='owner')throw Object.assign(new Error('The Owner account cannot be changed here.'),{status:400});
   const role=body.role==='reviewer'?'reviewer':'admin',permissions=Array.isArray(body.permissions)?body.permissions.filter(x=>allowed.includes(x)):(role==='reviewer'?['evidence_review']:allowed);
   const r=await fetch(url+'/rest/v1/admin_users?user_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{...adminHeaders,Prefer:'return=minimal'},body:JSON.stringify({role,display_name:String(body.displayName||'').trim()||null,is_active:body.isActive!==false,permissions})});
   if(!r.ok)throw new Error('Could not update administrator.');return reply({ok:true});
  }
  throw Object.assign(new Error('Unknown action.'),{status:400});
 }catch(e){return reply({error:e.message||'Admin management failed.'},e.status||500)}
});
