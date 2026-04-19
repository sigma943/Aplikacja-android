import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { initDb } from './server/db';
import { initScheduler } from './server/scheduler';
import apiRoutes from './server/api';

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());
    app.use(cors());

    // Ensure data directories exist
    const dataDir = path.join(process.cwd(), 'data');
    const imagesDir = path.join(dataDir, 'images');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    // Initialize Database
    initDb();

    // Initialize Scheduler
    initScheduler();

    // API Routes
    app.use('/api', apiRoutes);

    // Support for .well-known directory (Android App Links)
    const wellKnownPath = path.join(process.cwd(), '.well-known');
    if (!fs.existsSync(wellKnownPath)) fs.mkdirSync(wellKnownPath, { recursive: true });
    app.use('/.well-known', express.static(wellKnownPath, { dotfiles: 'allow' }));

    // Serve local images
    app.use('/api/images', express.static(imagesDir));

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error during server startup:', err);
  }
}

startServer();
