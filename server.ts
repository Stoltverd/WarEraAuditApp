import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Proxy handler for War Era tRPC endpoints
app.all('/api/warera/*', async (req: Request, res: Response) => {
  const targetSubpath = req.url.replace(/^\/api\/warera/, '/trpc');
  const targetUrl = `https://api2.warera.io${targetSubpath}`;

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'WarEraRankingTool/1.0',
      'Accept': 'application/json',
    };

    if (req.headers['x-api-key']) {
      headers['X-API-Key'] = req.headers['x-api-key'] as string;
    }
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string;
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'] as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    // Relay rate-limit headers to client
    const relayHeaders = ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'content-type'];
    relayHeaders.forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });

    const data = await upstreamRes.text();
    res.status(upstreamRes.status).send(data);
  } catch (error: any) {
    console.error('Proxy error to War Era:', error);
    res.status(502).json({
      error: {
        message: 'Failed to communicate with War Era upstream API',
        details: error?.message || String(error),
      },
    });
  }
});

// Serve frontend build if dist exists
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('War Era Ranking API Server is running. Frontend dev server is active on Vite.');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

export default app;
