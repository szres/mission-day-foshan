// Cloudflare Pages Function — GET /api/portal-image?u=<encoded URL>
// Proxies portal thumbnails from lh3.googleusercontent.com so they load for
// users on networks where Google's CDN is unreliable. Cached at the edge.

const ALLOWED_HOSTS = new Set(['lh3.googleusercontent.com']);
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get('u');
  if (!target) return new Response('missing ?u=', { status: 400 });

  let parsed;
  try { parsed = new URL(target); }
  catch { return new Response('invalid url', { status: 400 }); }
  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return new Response('host not allowed', { status: 403 });
  }

  const upstream = await fetch(parsed.toString(), {
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    headers: { 'user-agent': 'fsmd-image-proxy/1.0' },
  });

  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  headers.set('cache-control', `public, max-age=${CACHE_TTL}, immutable`);
  headers.delete('set-cookie');

  return new Response(upstream.body, { status: 200, headers });
}
