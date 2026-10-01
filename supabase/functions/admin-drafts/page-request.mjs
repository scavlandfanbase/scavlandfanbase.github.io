// Pure request boundary only. Not routed or deployed; authentication and model
// validation must be supplied by the eventual production page transport.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function invalid(){const error=new Error('Invalid private page request.');error.status=400;throw error;}
function keys(value,expected){
 if(!object(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))invalid();
}
function identity(value){if(typeof value!=='string'||!uuid.test(value))invalid();}
function version(value){if(!Number.isSafeInteger(value)||value<1||value>=2147483647)invalid();}
export function validatePageRequest(input){
 if(!object(input)||input.domain!=='page-builder')invalid();
 switch(input.action){
  case 'list':
   keys(input,Object.hasOwn(input,'after')?['domain','action','after']:['domain','action']);
   if(Object.hasOwn(input,'after'))identity(input.after);break;
  case 'load':keys(input,['domain','action','pageId']);identity(input.pageId);break;
  case 'source':keys(input,['domain','action']);break;
  case 'history':keys(input,['domain','action','pageId']);identity(input.pageId);break;
  case 'page-state':keys(input,['domain','action','pageId']);identity(input.pageId);break;
  case 'revision':keys(input,['domain','action','pageId','version']);identity(input.pageId);version(input.version);break;
  case 'preview':keys(input,['domain','action','pageId','version','requestId']);identity(input.pageId);version(input.version);identity(input.requestId);break;
  case 'publish':keys(input,['domain','action','previewId','requestId']);identity(input.previewId);identity(input.requestId);break;
  case 'status':keys(input,['domain','action','requestId']);identity(input.requestId);break;
  case 'create':
   keys(input,['domain','action','requestId','page']);identity(input.requestId);
   // The server assigns permanent page identity. Local IDs cannot become live IDs.
   if(!object(input.page)||Object.hasOwn(input.page,'id'))invalid();
   break;
  case 'save':
   keys(input,['domain','action','pageId','expectedVersion','requestId','page']);
   identity(input.pageId);version(input.expectedVersion);identity(input.requestId);
   if(!object(input.page)||input.page.id!==input.pageId)invalid();
   break;
  case 'archive':
   keys(input,['domain','action','pageId','expectedVersion','requestId']);
   identity(input.pageId);version(input.expectedVersion);identity(input.requestId);break;
  default:invalid();
 }
 // Never mutate the caller buffer or trust actor/time/approval/base supplied by it.
 // Page content still requires the trusted Page Builder model; this is not schema validation.
 return structuredClone(input);
}
