import { createProductionHandler } from './production.mjs';
// Coordinated shared release requires all three reviewed shared-item proposals.
// Keep SHARED_ITEM_ENABLED false until legacy import/preservation acceptance.
Deno.serve(createProductionHandler({env:(key:string)=>Deno.env.get(key)}));
