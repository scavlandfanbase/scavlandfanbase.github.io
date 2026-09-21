const cors = {
  "Access-Control-Allow-Origin": "https://scavlandfanbase.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const REPO = "scavlandfanbase/scavlandfanbase.github.io";
const BRANCH = "main";
const DATA_PATH = "data/items.json";
const allowedFields = new Set(["name", "classification", "image", "notes", "estimatedPrice", "rank", "maxStack", "description", "stackable", "source"]);
const classifications = new Set(["weapon", "armour", "ammunition", "crafted-item", "crafting-resource", "vendor-item", "junk-item"]);
const sourceStatuses = new Set(["screenshot-verified", "unverified", "user-provided", "pending-review", "not-verified"]);
const imagePattern = /^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i;

function githubHeaders() { return { Accept: "application/vnd.github+json", Authorization: `Bearer ${GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" }; }
function validRepoImage(path: unknown) { return typeof path === "string" && imagePattern.test(path) && !path.includes("..") && !path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path) && !path.includes("://"); }
function integerOrNull(value: unknown) { return value === null || (Number.isInteger(value) && (value as number) >= 0); }
function stringOrNull(value: unknown) { return value === null || typeof value === "string"; }
async function githubPathExists(path: string) { const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: githubHeaders() }); return response.ok; }
function decodeBase64(value: string) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g, "")), c => c.charCodeAt(0))); }
function encodeBase64(value: string) { const bytes = new TextEncoder().encode(value); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }

async function authorised(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  if (!user.ok) return false;
  const admin = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_scavland_admin`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return admin.ok && (await admin.json()) === true;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "POST is required." }, 405);
  if (!GITHUB_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "Publish service is not configured." }, 503);
  if (!await authorised(request)) return json({ error: "Authorized SCAVLAND admin access is required." }, 403);
  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Request must be valid JSON." }, 400); }
  if (typeof body.itemId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(body.itemId) || !body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) return json({ error: "Invalid item update request." }, 400);
  const keys = Object.keys(body.changes);
  if (!keys.length || keys.some(key => !allowedFields.has(key))) return json({ error: "The request contains a field that cannot be edited." }, 400);
  const changes = body.changes;
  if ("name" in changes && (typeof changes.name !== "string" || !changes.name.trim() || changes.name.length > 200)) return json({ error: "Name is required and must be 200 characters or fewer." }, 400);
  for (const key of ["image", "notes", "description"]) if (key in changes && !stringOrNull(changes[key])) return json({ error: `${key} must be text or null.` }, 400);
  if ("classification" in changes && (!Array.isArray(changes.classification) || !changes.classification.length || changes.classification.some((x: unknown) => typeof x !== "string" || !classifications.has(x)))) return json({ error: "Classification contains an unsupported value." }, 400);
  for (const key of ["estimatedPrice", "rank", "maxStack"]) if (key in changes && !integerOrNull(changes[key])) return json({ error: `${key} must be a non-negative whole number or null.` }, 400);
  if ("stackable" in changes && changes.stackable !== null && typeof changes.stackable !== "boolean") return json({ error: "Stackable must be true, false, or null." }, 400);
  for (const key of ["image"]) if (key in changes && changes[key] !== null && !validRepoImage(changes[key])) return json({ error: `${key} must be a valid repository image path.` }, 400);
  if ("source" in changes) {
    const source = changes.source;
    if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).some(key => !["file", "status", "note", "lastVerified"].includes(key))) return json({ error: "Source contains an unsupported field." }, 400);
    if (source.file !== null && !validRepoImage(source.file)) return json({ error: "Source file must be a valid repository image path." }, 400);
    if (source.status !== null && (typeof source.status !== "string" || !sourceStatuses.has(source.status))) return json({ error: "Source status is not allowed." }, 400);
    if (!stringOrNull(source.file) || !stringOrNull(source.status) || !stringOrNull(source.note) || !stringOrNull(source.lastVerified)) return json({ error: "Source fields must be text or null." }, 400);
    if (source.lastVerified !== null && (typeof source.lastVerified !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(source.lastVerified))) return json({ error: "Source last verified must be an ISO date." }, 400);
    if (source.status === "screenshot-verified" && (!source.file || !source.file.startsWith("evidence-inbox/"))) return json({ error: "Screenshot-verified evidence must use an evidence-inbox image." }, 400);
  }
  const paths = [changes.image, changes.source?.file].filter(Boolean) as string[];
  for (const path of paths) if (!await githubPathExists(path)) return json({ error: `Repository file does not exist: ${path}` }, 400);
  const currentResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${DATA_PATH}?ref=${BRANCH}`, { headers: githubHeaders() });
  if (!currentResponse.ok) return json({ error: "Could not read the current item data from GitHub." }, 502);
  const current = await currentResponse.json();
  let document: any;
  try { document = JSON.parse(decodeBase64(current.content)); } catch { return json({ error: "The current item data is not valid JSON." }, 502); }
  if (!Array.isArray(document.data)) return json({ error: "The current item data has no data array." }, 502);
  const matches = document.data.filter((item: any) => item?.id === body.itemId);
  if (body.create) {
    if (matches.length) return json({ error: "That item ID already exists." }, 409);
    if (!changes.name || !changes.classification) return json({ error: "New items require a name and classification." }, 400);
    document.data.push({ id: body.itemId, ...changes });
  } else {
    if (matches.length !== 1) return json({ error: "Item ID did not match exactly one record." }, 400);
    const index = document.data.indexOf(matches[0]);
    document.data[index] = { ...matches[0], ...changes, ...(changes.source ? { source: { ...matches[0].source, ...changes.source } } : {}) };
  }
  const name = String(changes.name).trim();
  const commit = await fetch(`https://api.github.com/repos/${REPO}/contents/${DATA_PATH}`, { method: "PUT", headers: { ...githubHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: `Update item: ${name}`, content: encodeBase64(JSON.stringify(document, null, 2) + "\n"), sha: current.sha, branch: BRANCH }) });
  if (!commit.ok) return json({ error: "GitHub did not accept the commit." }, 502);
  const result = await commit.json();
  return json({ commitUrl: result.commit?.html_url || null, fileUrl: result.content?.html_url || null, sha: result.commit?.sha || null });
});
