const fs=require('node:fs'),path=require('node:path');
function imagePaths(root){
 const result=[];
 function walk(relative){
  const full=path.join(root,relative);
  if(!fs.existsSync(full))return;
  for(const entry of fs.readdirSync(full,{withFileTypes:true})){
   const name=relative+'/'+entry.name;
   if(entry.isDirectory())walk(name);
   else if(entry.isFile()&&/\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name))result.push(name);
  }
 }
 walk('evidence-inbox');walk('images');return result.sort();
}
if(require.main===module){const root=path.resolve(__dirname,'..'),images=imagePaths(root);fs.writeFileSync(path.join(root,'data/admin-images.json'),JSON.stringify(images,null,2)+'\n');console.log('Indexed '+images.length+' pictures from all image and evidence subfolders.');}
module.exports={imagePaths};
