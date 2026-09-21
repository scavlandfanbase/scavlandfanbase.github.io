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
const contentPath = "data/site-content.json";
const allowedPages = new Set(["global", "index.html", "roadmap.html", "areas.html", "factions.html", "map.html", "items.html", "vendors.html", "weapons.html", "armour.html", "crafting.html"]);
const imagePath = (value: unknown) => value === null || (typeof value === "string" && /^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes(".."));
const text = (value: unknown, max: number) => value === null || typeof value === "string" && value.length <= max;
const githubHeaders = () => ({ Accept: "application/vnd.github+json", Authorization: `Bearer ${githubToken}`, "X-GitHub-Api-Version": "2022-11-28" });
const decode = (value: string) => new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g, "")), char => char.charCodeAt(0)));
const encode = (value: string) => { let binary = ""; for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte); return btoa(binary); };
async function isAdmin(request: Request) { const authorization = request.headers.get("Authorization") || ""; if (!authorization.startsWith("Bearer ")) return false; const user = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } }); if (!user.ok) return false; const admin = await fetch(`${supabaseUrl}/rest/v1/rpc/is_scavland_admin`, { method: "POST", headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" }, body: "{}" }); return admin.ok && await admin.json() === true; }
function validPage(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const page = value as any; if (!text(page.title, 200) || !text(page.intro, 200)) return false; if (!Array.isArray(page.sections)) return false; return page.sections.every((section: any) => section && typeof section.id === "string" && text(section.title, 200) && text(section.intro, 200) && (!section.summary || typeof section.summary === "string" && section.summary.length <= 300) && (!section.url || typeof section.url === "string" && section.url.length <= 500) && (!section.cards || Array.isArray(section.cards) && section.cards.every((card: any) => card && typeof card.id === "string" && text(card.title, 160) && text(card.description, 500) && imagePath(card.image) && (!card.href || typeof card.href === "string")))); }
function validGlobal(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const global = value as any; return text(global.footerText, 200) && Array.isArray(global.navigation) && global.navigation.every((item: any) => item && typeof item.page === "string" && typeof item.label === "string" && item.label.length <= 40); }
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST is required." }, 405);
  if (!githubToken || !supabaseUrl || !anonKey) return respond({ error: "Publish service is not configured." }, 503);
  if (!await isAdmin(request)) return respond({ error: "Authorized SCAVLAND admin access is required." }, 403);
  let body: any; try { body = await request.json(); } catch { return respond({ error: "Request must be valid JSON." }, 400); }
  if (!allowedPages.has(body?.page) || body.page === "global" && !validGlobal(body?.content) || body.page !== "global" && !validPage(body?.content)) return respond({ error: "Invalid public content update." }, 400);
  const current = await fetch(`https://api.github.com/repos/${repository}/contents/${contentPath}?ref=main`, { headers: githubHeaders() });
  if (!current.ok) return respond({ error: "Could not read current public content." }, 502);
  const file = await current.json(); let document: any; try { document = JSON.parse(decode(file.content)); } catch { return respond({ error: "Current public content is invalid JSON." }, 502); }
  if (body.page === "global") document.global = body.content; else document.pages = { ...(document.pages || {}), [body.page]: body.content };
  const commit = await fetch(`https://api.github.com/repos/${repository}/contents/${contentPath}`, { method: "PUT", headers: { ...githubHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: `Update public content: ${body.page}`, content: encode(JSON.stringify(document, null, 2) + "\n"), sha: file.sha, branch: "main" }) });
  if (!commit.ok) return respond({ error: "GitHub did not accept the public content update." }, 502);
  const result = await commit.json(); return respond({ commitUrl: result.commit?.html_url || null, sha: result.commit?.sha || null });
});

