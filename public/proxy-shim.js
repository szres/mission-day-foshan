// MapKit JS network shim.
//
// Routes every fetch / XMLHttpRequest / WebSocket targeted at any
// *.apple-mapkit.com host through /api/mk-proxy/<host>/<path>?<query>
// so the request exits Cloudflare from a non-CN PoP. This is what makes
// mapkit.init succeed for mainland-China users (Apple's MapKit auth
// otherwise returns 401 when the request egress is inside the GFW).
//
// Loaded synchronously BEFORE mapkit.js so the overrides are in place
// by the time any MapKit code runs. Disable with ?no-proxy=1 in the URL
// for debugging.
(function () {
  if (typeof window === 'undefined') return;
  if (/[?&]no-proxy=1\b/.test(window.location.search)) {
    console.info('[proxy-shim] disabled via ?no-proxy=1');
    return;
  }

  const DEBUG = /[?&]debug-proxy=1\b/.test(window.location.search);
  const PROXY_PREFIX = '/api/mk-proxy/';
  const HOST_RE = /^https:\/\/([a-z0-9-]+\.apple-mapkit\.com)(\/|$)/i;
  const WS_RE   = /^wss:\/\/([a-z0-9-]+\.apple-mapkit\.com)(\/|$)/i;

  function rewriteHttp(url) {
    if (typeof url !== 'string') return url;
    const m = HOST_RE.exec(url);
    if (!m) return url;
    const rewritten = url.replace(HOST_RE, PROXY_PREFIX + m[1] + '$2');
    if (DEBUG) console.log('[proxy-shim]', url, '→', rewritten);
    return rewritten;
  }

  function rewriteWs(url) {
    if (typeof url !== 'string') return url;
    const m = WS_RE.exec(url);
    if (!m) return url;
    // Browsers can't open wss to a relative path; build an absolute one on
    // our own origin. The Worker would also need WebSocket support — log a
    // warning so we know if MapKit actually tries this.
    const rewritten = 'wss://' + window.location.host + PROXY_PREFIX + m[1] + url.slice(('wss://' + m[1]).length);
    console.warn('[proxy-shim] WebSocket attempted — Worker does not proxy WS yet:', url);
    return rewritten;
  }

  // ----- fetch -----
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      if (typeof input === 'string') {
        return origFetch(rewriteHttp(input), init);
      }
      if (input instanceof Request) {
        const newUrl = rewriteHttp(input.url);
        if (newUrl !== input.url) {
          return origFetch(new Request(newUrl, input), init);
        }
      }
      return origFetch(input, init);
    };
  }

  // ----- XMLHttpRequest -----
  if (typeof XMLHttpRequest !== 'undefined') {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      const args = Array.prototype.slice.call(arguments);
      args[1] = rewriteHttp(url);
      return origOpen.apply(this, args);
    };
  }

  // ----- WebSocket -----
  if (typeof WebSocket !== 'undefined') {
    const OrigWS = WebSocket;
    function PatchedWS(url, protocols) {
      return protocols === undefined
        ? new OrigWS(rewriteWs(url))
        : new OrigWS(rewriteWs(url), protocols);
    }
    PatchedWS.prototype = OrigWS.prototype;
    Object.assign(PatchedWS, OrigWS);
    window.WebSocket = PatchedWS;
  }

  if (DEBUG) console.info('[proxy-shim] installed');
})();
