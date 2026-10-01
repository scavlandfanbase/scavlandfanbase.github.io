// Read-only preparation inventory; never deploys or reads secrets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function manifest(){
 const files=new Map(),external=new Set();
 function add(relative){
  relative=relative.replaceAll(String.fromCharCode(92),'/');if(files.has(relative))return;
  const absolute=path.resolve(root,relative);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute))throw Error('Missing dependency: '+relative);
  const bytes=fs.readFileSync(absolute),text=bytes.toString('utf8');files.set(relative,{path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  if(/\.(mjs|ts)$/.test(relative))for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))add(path.posix.join(path.posix.dirname(relative),m[1]));
  if(relative.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^" ]*)?)"/g)){const value=m[1].replaceAll('&amp;','&');if(/^https?:/.test(value))external.add(value);else add(path.posix.join(path.posix.dirname(relative),value.split('?')[0]));}
 }
 for(const file of ['admin.html','evidence-review.html','evidence-review.js','evidence-review.css','supabase/functions/admin-drafts/index.ts','supabase/proposals/evidence-review-history.sql','supabase/proposals/evidence-review-readiness.sql'])add(file);
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8'),child=fs.readFileSync(path.join(root,'evidence-review.html'),'utf8'),cache='evidence-review-20261001-1';
 const frontendEnabled=/EVIDENCE_REVIEW_RELEASE_ENABLED\s*=\s*true/.test(html);
 if(!html.includes('evidence-review.html?embed=1&amp;v='+cache))throw Error('Frame cache mismatch.');
 for(const asset of ['evidence-review.js','evidence-review.css'])if(!child.includes(asset+'?v='+cache))throw Error('Asset cache mismatch: '+asset);
 const changed=cp.execFileSync('git',['diff','--name-only','origin/main...HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 if(changed.some(p=>p.startsWith('data/')))throw Error('Unexpected game-data changes.');
 return {commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeChanged:!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),readyForLiveActivation:false,assetCache:cache,requiredConfiguration:['SUPABASE_URL','SUPABASE_ANON_KEY'],requiredPermission:'evidence_review',initialFlags:{EVIDENCE_REVIEW_ENABLED:false,EVIDENCE_REVIEW_RELEASE_ENABLED:frontendEnabled},remaining:['Reconcile Attachment and Evidence changes in shared Hub/backend files','Review actual schema, grants, policies and Storage signing permissions','Coordinate replacement of old direct moderation with SQL cutover','Combined browser/handler/SQL acceptance','Explicit release approval and signed-in live acceptance'],files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),externalFrontendDependencies:[...external].sort()};
}
module.exports={manifest};if(require.main===module){const result=manifest();if(process.argv[2]){fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');console.log('Saved Evidence preparation inventory: '+result.files.length+' dependencies; activation remains pending.');}else console.log(JSON.stringify(result,null,2));}
