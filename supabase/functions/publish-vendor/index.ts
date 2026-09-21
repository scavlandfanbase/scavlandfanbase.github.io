const cors = {
  "Access-Control-Allow-Origin": "https://scavlandfanbase.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const githubToken = Deno.env.get("GITHUB_TOKEN")!;
const repository = "scavlandfanbase/scavlandfanbase.github.io";
const vendorsPath = "data/vendors.json";
const allowedFields = new Set([
  "name", "location", "factionId", "inventoryDocumented", "inventory", "portrait", "shopEvidence", "source",
]);

const githubHeaders = () => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${githubToken}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

function decodeBase64(value: string) {
  return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
}

function encodeBase64(value: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function validImagePath(value: unknown) {
  return typeof value === "string"
    && /^(images|evidence-inbox)\/(?:[A-Za-z0-9._ ()-]+\/)*[A-Za-z0-9._ ()-]+\.(png|jpe?g|webp)$/i.test(value)
    && !value.includes("..");
}

function validInventory(value: unknown) {
  return Array.isArray(value) && value.every((row) => row && typeof row === "object"
    && typeof (row as Record<string, unknown>).itemId === "string"
    && typeof (row as Record<string, unknown>).name === "string"
    && typeof (row as Record<string, unknown>).rank === "string"
    && Number.isInteger((row as Record<string, unknown>).price)
    && Number((row as Record<string, unknown>).price) >= 0
    && typeof (row as Record<string, unknown>).details === "string");
}

function validPortrait(value: unknown) {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const portrait = value as Record<string, unknown>;
  if (!validImagePath(portrait.file)) return false;
  if (portrait.status !== undefined && typeof portrait.status !== "string") return false;
  if (portrait.evidence !== undefined && typeof portrait.evidence !== "string") return false;
  if (portrait.note !== undefined && typeof portrait.note !== "string") return false;
  if (!Number.isInteger(portrait.sourceWidth) || Number(portrait.sourceWidth) < 1) return false;
  const crop = portrait.crop;
  return !!crop && typeof crop === "object" && !Array.isArray(crop)
    && Number.isInteger((crop as Record<string, unknown>).x) && Number((crop as Record<string, unknown>).x) >= 0
    && Number.isInteger((crop as Record<string, unknown>).y) && Number((crop as Record<string, unknown>).y) >= 0
    && Number.isInteger((crop as Record<string, unknown>).size) && Number((crop as Record<string, unknown>).size) > 0;
}

async function isAdmin(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;

  const user = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!user.ok) return false;

  const admin = await fetch(`${supabaseUrl}/rest/v1/rpc/is_scavland_admin`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
    body: "{}",
  });
  return admin.ok && await admin.json() === true;
}

async function imageExists(path: string) {
  const result = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=main`, {
    headers: githubHeaders(),
  });
  return result.ok;
}

function changedImagePaths(changes: Record<string, unknown>) {
  const paths: string[] = [];
  const portrait = changes.portrait as Record<string, unknown> | undefined;
  if (portrait?.file) paths.push(String(portrait.file));
  const source = changes.source as Record<string, unknown> | undefined;
  if (source?.file) paths.push(String(source.file));
  const evidence = changes.shopEvidence as Record<string, unknown> | undefined;
  const screenshots = evidence?.screenshots;
  if (Array.isArray(screenshots)) for (const image of screenshots) {
    if (image && typeof image === "object" && (image as Record<string, unknown>).file) {
      paths.push(String((image as Record<string, unknown>).file));
    }
  }
  return paths;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST is required." }, 405);
  if (!githubToken || !supabaseUrl || !anonKey) return respond({ error: "Publish service is not configured." }, 503);
  if (!await isAdmin(request)) return respond({ error: "Authorized SCAVLAND admin access is required." }, 403);

  let body: { vendorId?: unknown; changes?: unknown };
  try { body = await request.json(); } catch { return respond({ error: "Request must be valid JSON." }, 400); }
  if (typeof body.vendorId !== "string" || !body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) {
    return respond({ error: "Invalid vendor update request." }, 400);
  }

  const changes = body.changes as Record<string, unknown>;
  const keys = Object.keys(changes);
  if (!keys.length || keys.some((key) => !allowedFields.has(key))) {
    return respond({ error: "The request contains an unsupported field." }, 400);
  }
  if (("name" in changes && (typeof changes.name !== "string" || !changes.name.trim() || changes.name.length > 120))
    || ("location" in changes && typeof changes.location !== "string")
    || ("factionId" in changes && typeof changes.factionId !== "string")
    || ("inventoryDocumented" in changes && typeof changes.inventoryDocumented !== "boolean")
    || ("inventory" in changes && !validInventory(changes.inventory))
    || ("portrait" in changes && !validPortrait(changes.portrait))) {
    return respond({ error: "Vendor details or stock rows are invalid." }, 400);
  }

  const paths = changedImagePaths(changes);
  if (paths.some((path) => !validImagePath(path)) || !await Promise.all(paths.map(imageExists)).then((checks) => checks.every(Boolean))) {
    return respond({ error: "Each changed image must be an existing PNG, JPG or WebP file in images/ or evidence-inbox/." }, 400);
  }

  const current = await fetch(`https://api.github.com/repos/${repository}/contents/${vendorsPath}?ref=main`, { headers: githubHeaders() });
  if (!current.ok) return respond({ error: "Could not read current vendor data." }, 502);
  const file = await current.json();
  let document: unknown;
  try { document = JSON.parse(decodeBase64(file.content)); } catch { return respond({ error: "Current vendor data is invalid JSON." }, 502); }
  const vendors = Array.isArray(document) ? document : (document as { data?: unknown }).data;
  if (!Array.isArray(vendors)) return respond({ error: "Vendor data has no list." }, 502);
  const index = vendors.findIndex((vendor) => vendor && typeof vendor === "object" && (vendor as { id?: unknown }).id === body.vendorId);
  if (index < 0) return respond({ error: "Vendor ID was not found." }, 404);

  vendors[index] = { ...(vendors[index] as Record<string, unknown>), ...changes };
  const updated = Array.isArray(document) ? vendors : { ...(document as Record<string, unknown>), data: vendors };
  const commit = await fetch(`https://api.github.com/repos/${repository}/contents/${vendorsPath}`, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Update vendor: ${(vendors[index] as { name: string }).name}`,
      content: encodeBase64(JSON.stringify(updated, null, 2) + "\n"),
      sha: file.sha,
      branch: "main",
    }),
  });
  if (!commit.ok) return respond({ error: "GitHub did not accept the vendor update." }, 502);
  const result = await commit.json();
  return respond({ commitUrl: result.commit?.html_url || null, sha: result.commit?.sha || null });
});
