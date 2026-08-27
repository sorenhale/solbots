// Optional. The public tape already allows browser calls.
// Skip this file unless a host later blocks them.
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    }
    const src = new URL(request.url);
    const dest = new URL(src.pathname + src.search, "https://api.dexscreener.com");
    const res = await fetch(dest, { headers: { accept: "application/json" } });
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", "*");
    return new Response(res.body, { status: res.status, headers });
  },
};
