import { createProductionHandler } from './production.mjs';
import {releaseEnvironment} from './release-config.mjs';
// Coordinated shared release requires all three reviewed shared-item proposals.
// Keep SHARED_ITEM_ENABLED false until legacy import/preservation acceptance.
Deno.serve(createProductionHandler({env:releaseEnvironment((key:string)=>Deno.env.get(key))}));
