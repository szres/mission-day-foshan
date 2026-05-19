// Cloudflare Pages Function — catch-all proxy for MapKit JS traffic.
//
// Route:  /api/mk-proxy/<upstream-host>/<rest-of-path>?<query>
// Upstream host must match ALLOWED_HOST_REGEX (any *.apple-mapkit.com).
//
// Purpose: mainland-China users hit a 401 during mapkit.init because
// MapKit's bootstrap call can't be authenticated from inside the GFW.
// Cloudflare's free-tier traffic exits at non-CN PoPs, so requests routed
// through this Worker reach Apple from an acceptable network egress.
//
// The companion browser shim at public/proxy-shim.js rewrites every
// fetch/XHR to an *.apple-mapkit.com host into the equivalent URL on
// this proxy.

const ALLOWED_HOST_REGEX = /^[a-z0-9-]+\.apple-mapkit\.com$/i;

// Cache TTLs (seconds). Short for API responses, longer for static assets.
const STATIC_RE = /\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ttf|json)(\?|$)/i;

export async function onRequest({ request, params }) {
  const parts = Array.isArray(params.path) ? params.path : [];
  if (parts.length === 0) {
    return new Response('missing upstream host', { status: 400 });
  }

  const upstreamHost = parts[0].toLowerCase();
  if (!ALLOWED_HOST_REGEX.test(upstreamHost)) {
    return new Response('host not allowed: ' + upstreamHost, { status: 403 });
  }

  const upstreamPath = '/' + parts.slice(1).join('/');
  const incoming = new URL(request.url);
  const upstreamUrl = `https://${upstreamHost}${upstreamPath}${incoming.search}`;

  // Build outgoing request — strip CF-injected and routing headers so Apple
  // sees a clean request, but preserve Origin/Referer/Authorization which
  // MapKit relies on for token validation.
  const fwdHeaders = new Headers(request.headers);
  for (const h of [
    'host',
    'cf-connecting-ip',
    'cf-ray',
    'cf-visitor',
    'cf-ipcountry',
    'cf-ipcontinent',
    'cf-ew-via',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-real-ip',
  ]) fwdHeaders.delete(h);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstreamReq = new Request(upstreamUrl, {
    method: request.method,
    headers: fwdHeaders,
    body: hasBody ? request.body : undefined,
    redirect: 'follow',
  });

  const cacheable = request.method === 'GET';
  const cacheTtl = cacheable && STATIC_RE.test(upstreamPath) ? 3600 : 60;

  let resp;
  try {
    resp = await fetch(upstreamReq, cacheable ? {
      cf: { cacheTtl, cacheEverything: true },
    } : undefined);
  } catch (err) {
    return new Response('upstream fetch failed: ' + err.message, { status: 502 });
  }

  // Mirror response headers, dropping ones that don't apply to our origin.
  const respHeaders = new Headers(resp.headers);
  for (const h of [
    'strict-transport-security',
    'content-security-policy',
    'content-security-policy-report-only',
    'public-key-pins',
    'public-key-pins-report-only',
    'alt-svc',
  ]) respHeaders.delete(h);

  // Permissive CORS — same-origin in practice, but harmless to set.
  respHeaders.set('access-control-allow-origin', '*');
  respHeaders.set('access-control-allow-credentials', 'true');

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
