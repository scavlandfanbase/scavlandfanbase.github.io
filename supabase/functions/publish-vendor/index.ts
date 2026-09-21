import { createHandler } from '../_shared/records.js';
Deno.serve(createHandler('vendors', (key: string) => Deno.env.get(key)));
