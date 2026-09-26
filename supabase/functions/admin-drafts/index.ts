import { createProductionHandler } from './production.mjs';
// Deploy only with BOTH approved SQL proposals. Publishing still requires its flag.
Deno.serve(createProductionHandler({env:(key:string)=>Deno.env.get(key)}));
