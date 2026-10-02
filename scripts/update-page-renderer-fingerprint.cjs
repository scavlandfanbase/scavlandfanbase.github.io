const fs=require('node:fs'),crypto=require('node:crypto'),path='supabase/functions/admin-drafts/page-renderer.mjs';
let source=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
const inner=source.split('const renderer=(()=>{\n')[1].split('})();\nexport default renderer;')[0];
const wrapper="(function(root,factory){const api=factory(typeof module==='object'?require('./page-builder-model.js'):root.ScavPageBuilderModel);if(typeof module==='object')module.exports=api;else root.ScavPageBuilder=api;})(globalThis,Model=>{\n"+inner+'});';
source=source.replace(/Original normalized SHA-256: [a-f0-9]{64}/,'Original normalized SHA-256: '+crypto.createHash('sha256').update(wrapper).digest('hex'));
fs.writeFileSync(path,source);
