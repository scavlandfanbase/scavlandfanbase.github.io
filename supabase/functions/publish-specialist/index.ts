const cors = {
  "Access-Control-Allow-Origin": "https://scavlandfanbase.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const githubToken = Deno.env.get("GITHUB_TOKEN")!;
const repository = "scavlandfanbase/scavlandfanbase.github.io";
const targets = { weapons: "data/weapons.json", armour: "data/armour.json", ammunition: "data/ammo.json", crafting: "data/crafting.json" } as const;
const allowed = {
  weapons: new Set(["name", "category", "tier", "ammo", "damage", "rpm", "range", "accuracy", "recoil", "handling", "ergonomics", "reload", "image", "source"]),
  armour: new Set(["name", "category", "vendorRank", "price", "durability", "ballistic", "slash", "radiation", "repairClass", "image", "stackable", "description", "source"]),
  ammunition: new Set(["name", "category", "estimatedPrice", "description", "damage", "penetrationPercent", "maxStack", "source"]),
  crafting: new Set(["name", "workbench", "ingredients", "source"]),
};
const githubHeaders = () => ({ Accept: "application/vnd.github+json", Authorization: `Bearer ${githubToken}`, "X-GitHub-Api-Version": "2022-11-28" });
const decode = (value: string) => new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g, "")), char => char.charCodeAt(0)));
const encode = (value: string) => { let binary = ""; for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte); return btoa(binary); };
const validPath = (value: unknown) => typeof value === "string" && /^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes("..");
const validSource = (value: unknown) => value === undefined || (!!value && typeof value === "object" && !Array.isArray(value));
const validIngredients = (value: unknown) => Array.isArray(value) && value.every(row => row && typeof row === "object" && typeof (row as any).itemId === "string" && typeof (row as any).name === "string" && Number.isInteger((row as any).quantity) && (row as any).quantity > 0);
const numericFields = new Set(["damage", "rpm", "range", "accuracy", "recoil", "handling", "ergonomics", "reload", "price", "durability", "ballistic", "slash", "radiation", "estimatedPrice", "penetrationPercent", "maxStack"]);
async function isAdmin(request: Request) { const auth = request.headers.get("Authorization") || ""; if (!auth.startsWith("Bearer ")) return false; const user = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } }); if (!user.ok) return false; const admin = await fetch(`${supabaseUrl}/rest/v1/rpc/is_scavland_admin`, { method: "POST", headers: { apikey: anonKey, Authorization: auth, "Content-Type": "application/json" }, body: "{}" }); return admin.ok && await admin.json() === true; }
async function imageExists(path: string) { const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=main`, { headers: githubHeaders() }); return response.ok; }
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST is required." }, 405);
  if (!githubToken || !supabaseUrl || !anonKey) return respond({ error: "Publish service is not configured." }, 503);
  if (!await isAdmin(request)) return respond({ error: "Authorized SCAVLAND admin access is required." }, 403);
  let body: any; try { body = await request.json(); } catch { return respond({ error: "Request must be valid JSON." }, 400); }
  const kind = body?.kind, id = body?.id, changes = body?.changes;
  if (!targets[kind as keyof typeof targets] || typeof id !== "string" || !changes || typeof changes !== "object" || Array.isArray(changes)) return respond({ error: "Invalid specialist update request." }, 400);
  const allowedFields = allowed[kind as keyof typeof allowed];
  if (!Object.keys(changes).length || Object.keys(changes).some(key => !allowedFields.has(key))) return respond({ error: "The request contains an unsupported field." }, 400);
  if ("name" in changes && (typeof changes.name !== "string" || !changes.name.trim() || changes.name.length > 160)) return respond({ error: "Name is invalid." }, 400);
  if ("image" in changes && changes.image !== null && (!validPath(changes.image) || !await imageExists(changes.image))) return respond({ error: "Image path must be an existing repository image." }, 400);
  if ("source" in changes && !validSource(changes.source)) return respond({ error: "Source details are invalid." }, 400);
  if (kind === "crafting" && "ingredients" in changes && !validIngredients(changes.ingredients)) return respond({ error: "Ingredients are invalid." }, 400);
  for (const key of numericFields) if (key in changes && changes[key] !== null && (!Number.isFinite(Number(changes[key])) || Number(changes[key]) < 0)) return respond({ error: `${key} must be a non-negative number or null.` }, 400);
  const path = targets[kind as keyof typeof targets];
  const current = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=main`, { headers: githubHeaders() });
  if (!current.ok) return respond({ error: "Could not read current specialist data." }, 502);
  const file = await current.json(); let document: any; try { document = JSON.parse(decode(file.content)); } catch { return respond({ error: "Current specialist data is invalid JSON." }, 502); }
  const rows = Array.isArray(document) ? document : document.data;
  if (!Array.isArray(rows)) return respond({ error: "Specialist data has no records." }, 502);
  const matches = rows.filter((row: any) => row?.id === id); if (matches.length !== 1) return respond({ error: "Specialist ID did not match exactly one record." }, 400);
  const index = rows.indexOf(matches[0]); rows[index] = { ...rows[index], ...changes }; const updated = Array.isArray(document) ? rows : { ...document, data: rows };
  const commit = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, { method: "PUT", headers: { ...githubHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: `Update ${kind}: ${rows[index].name}`, content: encode(JSON.stringify(updated, null, 2) + "\n"), sha: file.sha, branch: "main" }) });
  if (!commit.ok) return respond({ error: "GitHub did not accept the specialist update." }, 502);
  const result = await commit.json(); return respond({ commitUrl: result.commit?.html_url || null, sha: result.commit?.sha || null });
});
