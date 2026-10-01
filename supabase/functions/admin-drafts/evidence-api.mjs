// Preparation adapter; registered behind a disabled switch, not deployed. All authority is enforced by caller-JWT SQL.
export function createEvidenceApi({env,fetcher=fetch}){
 const headers={'Access-Control-Allow-Origin':'https://scavlandfanbase.github.io','Cache-Control':'no-store'};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 return async request=>{
  if(env('EVIDENCE_REVIEW_ENABLED')!=='true')return reply({error:'Evidence Review is not enabled.'},503);
  if(request.method!=='POST')return reply({error:'POST is required.'},405);
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in to continue.'},401);
  const sb=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');if(!sb||!key)return reply({error:'Evidence Review is unavailable.'},503);
  try{
   const raw=await request.text();if(new TextEncoder().encode(raw).length>20000)return reply({error:'Evidence request is too large.'},413);
   let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid evidence request.'},400);}
   if(!body||Array.isArray(body)||body.domain!=='evidence-review'||!['list','load','decide'].includes(body.action)||body.action!=='list'&&!uuid(body.submissionId))return reply({error:'Invalid evidence request.'},400);
   const allowed=body.action==='list'?['domain','action','status','before','beforeId']:body.action==='load'?['domain','action','submissionId']:['domain','action','submissionId','requestId','expectedVersion','expectedStatus','decision','notes'];
   if(Object.keys(body).some(key=>!allowed.includes(key)))return reply({error:'Unsupported evidence fields.'},400);
   let name='scavland_evidence_state',args={p_submission:body.submissionId};
   if(body.action==='list'){
    if(!['pending','approved','rejected'].includes(body.status)||(body.before===undefined)!==(body.beforeId===undefined)||body.before!==undefined&&(typeof body.before!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(body.before)||!Number.isFinite(Date.parse(body.before))||!uuid(body.beforeId)))return reply({error:'Invalid evidence queue.'},400);
    name='scavland_evidence_queue';args={p_status:body.status,p_before:body.before??null,p_before_id:body.beforeId??null};
   }
   if(body.action==='decide'){
    if(!uuid(body.requestId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||!['pending','approved','rejected'].includes(body.expectedStatus)||!['pending','approved','rejected'].includes(body.decision)||body.notes!==undefined&&body.notes!==null&&(typeof body.notes!=='string'||body.notes.length>4000))return reply({error:'Invalid evidence decision.'},400);
    name='scavland_review_evidence';args={...args,p_request:body.requestId,p_version:body.expectedVersion,p_status:body.expectedStatus,p_decision:body.decision,p_notes:body.notes??null};
   }
   const result=await fetcher(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(args)});
   const value=await result.json();if(result.ok)return reply(value);
   const status=value.code==='PT409'?409:value.code==='42501'?403:result.status===401?401:result.status>=500?503:400;
   return reply({error:status===409?'Evidence review changed. Reload before deciding.':status===403?'Evidence review permission required.':status===401?'Sign in again.':status===503?'Evidence Review is unavailable.':'Invalid evidence decision.'},status);
  }catch{return reply({error:'Could not complete Evidence Review. Your decision has not been confirmed; retry the same request.'},503);}
 };
}
