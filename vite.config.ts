import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createSegtestRoute } from '@noah/segtest/route';

export default defineConfig({
  plugins: [react(), {
    name: 'local-segtest-picks',
    configureServer(server) {
      const route = createSegtestRoute(path.join(process.cwd(), '.segtest', 'picks.json'), true);
      server.middlewares.use('/api/debug/segtest', async (req, res, next) => {
        try {
          if (req.method !== 'GET' && req.method !== 'POST') return next();
          let response: Response;
          if (req.method === 'POST') {
            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
              res.statusCode = 403; res.end(); return;
            }
            let body = '';
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 16384) { res.statusCode = 413; res.end(); return; }
            }
            response = await route.POST(new Request('http://localhost/api/debug/segtest', { method: 'POST', body }));
          } else response = await route.GET();
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(await response.text());
        } catch (error) { next(error as Error); }
      });
    },
  }],
  server: { host: '127.0.0.1', port: 5197, strictPort: true },
});
