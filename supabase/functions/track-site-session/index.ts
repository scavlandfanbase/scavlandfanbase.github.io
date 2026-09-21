const cors = {
  "Access-Control-Allow-Origin": "https://scavlandfanbase.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "POST is required." }, 405);
  let body: { sessionId?: unknown; page?: unknown };
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (typeof body.sessionId !== "string" || !/^[A-Za-z0-9-]{20,80}$/.test(body.sessionId)) return json({ error: "Invalid session id." }, 400);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/track_site_session`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_session_id: body.sessionId, p_page: typeof body.page === "string" ? body.page : "/" }),
  });
  return response.ok ? json({ ok: true }) : json({ error: "Analytics unavailable." }, 503);
});
