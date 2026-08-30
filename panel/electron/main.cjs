const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { runPlatformUpdate } = require('./updater.cjs');

const PANEL_PORT_START = 3100;
const PANEL_PORT_ATTEMPTS = 10;
let panelPort = PANEL_PORT_START;
let mainWindow;
let panelServer;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function getAppRoot() {
    if (app.isPackaged) {
        return app.getAppPath();
    }
    return path.join(__dirname, '..');
}

function getServerModule() {
    if (app.isPackaged) {
        return require(path.join(__dirname, 'server.cjs'));
    }
    return null;
}

async function startBackend() {
    const root = getAppRoot();
    const staticDir = path.join(root, 'dist');

    if (app.isPackaged) {
        const { startServer } = getServerModule();
        const result = await startServer({
            port: PANEL_PORT_START,
            portAttempts: PANEL_PORT_ATTEMPTS,
            staticDir,
        });
        panelServer = result.server;
        panelPort = result.port;
        return;
    }

    const serverPath = path.join(getAppRoot(), 'server.mjs');
    const { startServer } = await import(pathToFileURL(serverPath).href);
    const result = await startServer({
        port: PANEL_PORT_START,
        portAttempts: PANEL_PORT_ATTEMPTS,
        staticDir,
    });
    panelServer = result.server;
    panelPort = result.port;
}

async function createWindow() {
    if (app.isPackaged) {
        try {
            await runPlatformUpdate();
        } catch (err) {
            console.error('[updater] Failed:', err);
        }
    }

    await startBackend();

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: true,
        autoHideMenuBar: true,
        title: 'Discord Builds Panel',
        backgroundColor: '#0b0d12',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        dialog.showErrorBox(
            'Discord Builds Panel',
            `Falha ao carregar a interface (${errorCode}): ${errorDescription}`
        );
    });

    await mainWindow.loadURL(`http://127.0.0.1:${panelPort}`);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

if (gotLock) {
    app.whenReady().then(createWindow).catch((err) => {
        dialog.showErrorBox('Discord Builds Panel', `Erro ao iniciar: ${err.message || err}`);
        app.quit();
    });

    app.on('window-all-closed', () => {
        if (panelServer) {
            panelServer.close();
        }
        app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow().catch((err) => {
                dialog.showErrorBox('Discord Builds Panel', `Erro ao iniciar: ${err.message || err}`);
                app.quit();
            });
        }
    });
}
