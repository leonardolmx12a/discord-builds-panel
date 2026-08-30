const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
};

function startServer({ port = 3100, portAttempts = 1, staticDir } = {}) {
    const root = staticDir && fs.existsSync(staticDir) ? staticDir : null;

    const handler = (req, res) => {
        if (!root) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Static directory not found');
            return;
        }

        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);

        if (!filePath.startsWith(root)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const sendFile = (target) => {
            fs.readFile(target, (err, data) => {
                if (err) {
                    if (urlPath !== '/' && !path.extname(urlPath)) {
                        const indexPath = path.join(root, 'index.html');
                        return fs.readFile(indexPath, (indexErr, indexData) => {
                            if (indexErr) {
                                res.writeHead(404);
                                res.end('Not found');
                                return;
                            }
                            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(indexData);
                        });
                    }

                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }

                const ext = path.extname(target).toLowerCase();
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
                res.end(data);
            });
        };

        fs.stat(filePath, (err, stats) => {
            if (!err && stats.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }
            sendFile(filePath);
        });
    };

    return new Promise((resolve, reject) => {
        let attempt = 0;

        const tryListen = (currentPort) => {
            const server = http.createServer(handler);

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

            server.listen(currentPort, '127.0.0.1');
        };

        tryListen(port);
    });
}

module.exports = { startServer };
