// Read-only local release inventory; no deployment, secrets or game-data mutation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function manifest(){
 const files=new Map(),external=new Set();
 function add(relative){
  relative=relative.replaceAll('\\','/');if(files.has(relative))return;
  const absolute=path.resolve(root,relative);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute))throw Error('Missing release dependency: '+relative);
  const bytes=fs.readFileSync(absolute),text=bytes.toString('utf8');files.set(relative,{path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  if(/\.(mjs|ts)$/.test(relative))for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))add(path.posix.join(path.posix.dirname(relative),m[1]));
  if(relative.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^" ]*)?)"/g)){
   const value=m[1].replaceAll('&amp;','&');if(/^https?:/.test(value))external.add(value);else add(path.posix.join(path.posix.dirname(relative),value.split('?')[0]));
  }
 }
 const migrations=['attachment-classification-storage.sql','attachment-preview.sql','attachment-creation-allocation.sql'].map(p=>'supabase/proposals/'+p);
 for(const file of ['admin.html','admin-dashboard.js','attachment-category.html','attachment-category.js','attachment-category.css','attachment-model.js','ammo-category.html','armour-category.html','weapons-category.html','supabase/functions/admin-drafts/index.ts',...migrations])add(file);
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8'),child=fs.readFileSync(path.join(root,'attachment-category.html'),'utf8');
 const backendSourceEnabled=/SHARED_ATTACHMENT_ENABLED\s*:\s*true/.test(fs.readFileSync(path.join(root,'supabase/functions/admin-drafts/release-config.mjs'),'utf8'));
 const frontendEnabled=/ATTACHMENT_RELEASE_ENABLED\s*=\s*true/.test(html);
 const cache='attachment-preparation-20261001-4';
 if(!html.includes('attachment-category.html?embed=1&v='+cache)&&!html.includes('attachment-category.html?embed=1&amp;v='+cache))throw Error('Unexpected Attachment frame cache.');
 for(const asset of ['attachment-category.js','attachment-category.css','attachment-model.js'])if(!child.includes(asset+'?v='+cache))throw Error('Child asset cache differs: '+asset);
 const changed=cp.execFileSync('git',['diff','--name-only','origin/main...HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 if(changed.some(p=>p.startsWith('data/')))throw Error('Release contains game-data changes.');
 return {schemaVersion:1,commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeChanged:!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),mode:frontendEnabled?'activation-pending-acceptance':'prepublication-review',readyForLiveActivation:false,assetCache:cache,migrationsInOrder:migrations,readinessQuery:'supabase/proposals/attachment-readiness.sql',sourceFlags:{SHARED_ATTACHMENT_ENABLED:backendSourceEnabled,ATTACHMENT_RELEASE_ENABLED:frontendEnabled},requiredPublishingFlags:['ADMIN_CORE_ENABLED','DRAFT_PUBLISH_ENABLED'],remaining:['Verify deployed configuration without printing secrets','Review cross-service publication race limitation','Approve coordinated release','Signed-in production acceptance after disabled deployment'],files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),externalFrontendDependencies:[...external].sort()};
}
module.exports={manifest};
if(require.main===module){const result=manifest(),output=process.argv[2];if(output){fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');console.log('Saved Attachment preparation inventory: '+result.files.length+' dependencies. No live activation.');}else console.log(JSON.stringify(result,null,2));}
