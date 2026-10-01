// Local artifact only. No deployment, secret inspection, network or database writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function manifest(){
 const files=new Map(),external=new Set();
 function add(relative){
  relative=relative.replaceAll('\\','/');if(files.has(relative))return;
  const absolute=path.resolve(root,relative);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute))throw Error('Missing release dependency: '+relative);
  const bytes=fs.readFileSync(absolute),text=bytes.toString('utf8');files.set(relative,{path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  if(/\.(mjs|ts)$/.test(relative))for(const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))add(path.posix.join(path.posix.dirname(relative),match[1]));
  if(relative.endsWith('.html'))for(const match of text.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^" ]*)?)"/g)){
   const value=match[1].replaceAll('&amp;','&');if(/^https?:/.test(value))external.add(value);else add(path.posix.join(path.posix.dirname(relative),value.split('?')[0]));
  }
 }
 const migrations=['supabase/proposals/shared-item-drafts.sql','supabase/proposals/shared-item-api.sql','supabase/proposals/shared-item-legacy-preservation.sql'];
 for(const file of ['admin.html','ammo-category.html','armour-category.html','weapons-category.html','supabase/functions/admin-drafts/index.ts','scripts/shared-rollout-manifest.cjs',...migrations])add(file);
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 if(!html.includes('ammo-category.html?embed=1'))throw Error('Hub Ammo route is not connected.');
 const api=fs.readFileSync(path.join(root,'supabase/functions/admin-drafts/item-api.mjs'),'utf8');
 if(!api.includes("env('SHARED_ITEM_ENABLED')!=='true'"))throw Error('Shared item feature gate is missing.');
 return {schemaVersion:1,commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  workingTreeChanged:!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),
  mode:'preparation-only',readyForLiveActivation:false,migrationsInOrder:migrations,
  initialFlags:{SHARED_ITEM_ENABLED:false},requiredPublishingFlags:['ADMIN_CORE_ENABLED','DRAFT_PUBLISH_ENABLED'],
  remaining:['Review genuine legacy fields privately before importing','Confirm deployed flags without exposing secrets','Apply all three final proposal versions before backend activation','Coordinated backend/frontend rollout and real Owner acceptance'],
  files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),externalFrontendDependencies:[...external].sort()};
}
module.exports={manifest};
if(require.main===module){const result=manifest(),output=process.argv[2];if(output){fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');console.log('Saved preparation manifest. Live activation remains blocked by documented acceptance work.');}else console.log(JSON.stringify(result,null,2));}
