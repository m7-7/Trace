import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

const PORT = 5000;

let win: BrowserWindow | null = null;
let serverProc: ChildProcess | null = null;

function parseEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  const vars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

function startExpressServer(): void {
  const entry = path.join(process.cwd(), 'dist', 'index.js');
  serverProc = spawn('node', [entry], {
    env: { ...process.env, ...parseEnvFile(), NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  serverProc.on('error', (err) => console.error('[electron] server error:', err.message));
}

function waitForServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const probe = () => {
      const req = http.get(`http://localhost:${PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (++attempts >= 40) {
          reject(new Error(`Express did not start on port ${PORT}`));
        } else {
          setTimeout(probe, 250);
        }
      });
    };
    probe();
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(`http://localhost:${PORT}`);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  if (process.env.ELECTRON_DEV !== '1') {
    startExpressServer();
    await waitForServer();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (win === null) createWindow();
});

app.on('will-quit', () => {
  serverProc?.kill();
  serverProc = null;
});
