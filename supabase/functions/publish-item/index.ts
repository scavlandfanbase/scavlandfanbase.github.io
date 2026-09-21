import { createHandler } from '../_shared/records.js';
Deno.serve(createHandler('items', (key: string) => Deno.env.get(key)));
