// Private Items drafts; reuse the existing loopback host/session/asset protections.
const {createServer}=require('./page-builder-server.cjs');
createServer({itemMode:true,directory:process.env.SCAVLAND_PRIVATE_ITEMS}).listen(4183,'127.0.0.1',()=>console.log('Private Items Editor: http://127.0.0.1:4183/ — changes save privately on this computer.'));
