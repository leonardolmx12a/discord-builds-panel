import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(staticDir) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    if (staticDir && existsSync(staticDir)) {
        app.use(express.static(staticDir));
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api')) return next();
            res.sendFile(path.join(staticDir, 'index.html'));
        });
    }

    return app;
}

export function startServer({ port = 3100, portAttempts = 1, staticDir } = {}) {
    const app = createApp(staticDir);

    return new Promise((resolve, reject) => {
        let attempt = 0;

        const tryListen = (currentPort) => {
            const server = app.listen(currentPort, '127.0.0.1');

            server.once('listening', () => {
                console.log(`[panel] http://127.0.0.1:${currentPort}`);
                resolve({ server, port: currentPort });
            });

            server.once('error', (err) => {
                server.close();

                if (err.code === 'EADDRINUSE' && attempt + 1 < portAttempts) {
                    attempt += 1;
                    tryListen(currentPort + 1);
                    return;
                }

                reject(err);
            });
        };

        tryListen(port);
    });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    startServer({ port: 4783 });
}
