// Free password gate for the Niblock internal tools (a £0 alternative to Vercel's
// paid Password Protection). Runs on Vercel's Edge before any page is served.
//
// Setup: add an environment variable SITE_PASSWORD in the Vercel project.
// Login: username is "niblock", password is whatever you set in SITE_PASSWORD.

export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const PASS = process.env.SITE_PASSWORD;

  // Fail closed: if no password is configured yet, lock everything.
  if (!PASS) {
    return new Response("This site is being set up (no password configured yet).", { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try { decoded = atob(encoded); } catch (e) { decoded = ""; }
    const idx = decoded.indexOf(":");
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === "niblock" && pass === PASS) {
      return; // correct credentials — let the request through
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Niblock internal tools"' },
  });
}
