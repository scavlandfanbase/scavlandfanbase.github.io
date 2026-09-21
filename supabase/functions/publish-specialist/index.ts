import { createHandler } from '../_shared/records.js';
Deno.serve(createHandler('specialist', (key: string) => Deno.env.get(key)));
