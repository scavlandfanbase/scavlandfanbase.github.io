// Reuse the private loopback service and its access, atomic-write and static-file protections.
const path=require('node:path');
const {createServer}=require('./page-builder-server.cjs');
const directory=process.env.SCAVLAND_PRIVATE_VENDORS||path.resolve(__dirname,'../../../private-state/vendor-builder');
createServer({directory,vendorMode:true}).listen(4182,'127.0.0.1',()=>console.log('Local Vendor Editor: http://127.0.0.1:4182/ — private drafts only.'));
