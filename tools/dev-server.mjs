// dev-server.mjs -- a tiny local web server for testing. Run:  node tools/dev-server.mjs
// It serves the /public folder at http://localhost:8000 and applies the same security headers as vercel.json.
// (You can also use:  python -m http.server 8000 --directory public   -- but without the headers.)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const publicDir = join(root, "public");
const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const port = Number(process.env.PORT || 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

function extraHeaders(pathname) {
  const out = {};
  for (const rule of config.headers || []) {
    const pattern = rule.source === "/(.*)" ? /^\/.*/ : new RegExp("^" + rule.source.replace(/\./g, "\\.") + "$");
    if (pattern.test(pathname)) for (const { key, value } of rule.headers) out[key] = value;
  }
  return out;
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const relative = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(publicDir, relative));
    res.writeHead(200, { "Content-Type": TYPES[extname(relative)] || "application/octet-stream", ...extraHeaders(pathname) });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, () => console.log(`Serving public/ at http://localhost:${port}`));
