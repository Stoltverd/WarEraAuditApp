// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json());
app.all("/api/warera/*", async (req, res) => {
  const targetSubpath = req.url.replace(/^\/api\/warera/, "/trpc");
  const targetUrl = `https://api2.warera.io${targetSubpath}`;
  try {
    const headers = {
      "User-Agent": "WarEraRankingTool/1.0",
      "Accept": "application/json"
    };
    if (req.headers["x-api-key"]) {
      headers["X-API-Key"] = req.headers["x-api-key"];
    }
    if (req.headers["authorization"]) {
      headers["Authorization"] = req.headers["authorization"];
    }
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }
    const fetchOptions = {
      method: req.method,
      headers
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    const upstreamRes = await fetch(targetUrl, fetchOptions);
    const relayHeaders = ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "content-type"];
    relayHeaders.forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });
    const data = await upstreamRes.text();
    res.status(upstreamRes.status).send(data);
  } catch (error) {
    console.error("Proxy error to War Era:", error);
    res.status(502).json({
      error: {
        message: "Failed to communicate with War Era upstream API",
        details: error?.message || String(error)
      }
    });
  }
});
var distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(200).send("War Era Ranking API Server is running. Frontend dev server is active on Vite.");
    }
  });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
var server_default = app;
export {
  server_default as default
};
