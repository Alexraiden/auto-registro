const MAX_PAYLOAD_BYTES = 120000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = buildCorsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const match = url.pathname.match(/^\/records\/([A-Za-z0-9_-]+)$/);
      if (!match) return json({ error: "Not found" }, 404, corsHeaders);

      if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
        return json({ error: "Origin not allowed" }, 403, corsHeaders);
      }

      const syncId = match[1];
      if (request.method === "GET") {
        return handleGet(env, syncId, request, corsHeaders);
      }

      if (request.method === "PUT") {
        return handlePut(env, syncId, request, corsHeaders);
      }

      return json({ error: "Method not allowed" }, 405, corsHeaders);
    } catch (error) {
      return json({ error: error.message || "Server error" }, 500, corsHeaders);
    }
  }
};

async function handleGet(env, syncId, request, headers) {
  const accessHash = request.headers.get("X-Access-Hash");
  if (!isValidToken(accessHash)) return json({ error: "Missing access hash" }, 401, headers);

  const stored = await env.AUTO_REGISTRO_KV.get(syncId, "json");
  if (!stored) return json({ error: "Not found" }, 404, headers);
  if (stored.accessHash !== accessHash) return json({ error: "Forbidden" }, 403, headers);

  return json({
    encryptedPayload: stored.encryptedPayload,
    version: stored.version || 0,
    updatedAt: stored.updatedAt || null
  }, 200, headers);
}

async function handlePut(env, syncId, request, headers) {
  const accessHash = request.headers.get("X-Access-Hash");
  if (!isValidToken(accessHash)) return json({ error: "Missing access hash" }, 401, headers);

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).length > MAX_PAYLOAD_BYTES) {
    return json({ error: "Payload too large" }, 413, headers);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return json({ error: "Invalid JSON" }, 400, headers);
  }

  if (body.accessHash !== accessHash) return json({ error: "Access hash mismatch" }, 403, headers);
  if (!isValidEncryptedPayload(body.encryptedPayload)) {
    return json({ error: "Invalid encrypted payload" }, 400, headers);
  }

  const existing = await env.AUTO_REGISTRO_KV.get(syncId, "json");
  if (existing && existing.accessHash !== accessHash) {
    return json({ error: "Forbidden" }, 403, headers);
  }

  const record = {
    accessHash,
    encryptedPayload: body.encryptedPayload,
    version: Number(body.version || 0),
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : new Date().toISOString()
  };

  await env.AUTO_REGISTRO_KV.put(syncId, JSON.stringify(record));
  return json({ ok: true, version: record.version, updatedAt: record.updatedAt }, 200, headers);
}

function buildCorsHeaders(origin, allowedOrigin) {
  const responseOrigin = allowedOrigin === "*" ? "*" : origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Hash",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store"
  };
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function isValidToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(value);
}

function isValidEncryptedPayload(value) {
  return Boolean(
    value &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    /^[A-Za-z0-9_-]+$/.test(value.iv) &&
    /^[A-Za-z0-9_-]+$/.test(value.ciphertext)
  );
}
