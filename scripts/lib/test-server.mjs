import { spawn } from 'child_process';
import { createServer } from 'net';
import fs from 'fs';
import path from 'path';

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function checkDistStale() {
  const distDir = path.resolve('dist');
  const srcDir = path.resolve('src');

  if (!fs.existsSync(distDir)) return true;
  
  const getDirMaxTime = (dir) => {
    let maxTime = 0;
    const check = (d) => {
      if (!fs.existsSync(d)) return;
      const stats = fs.statSync(d);
      if (stats.mtimeMs > maxTime) maxTime = stats.mtimeMs;
      if (stats.isDirectory()) {
        const files = fs.readdirSync(d);
        for (const file of files) {
          check(path.join(d, file));
        }
      }
    };
    check(dir);
    return maxTime;
  };

  return getDirMaxTime(distDir) < getDirMaxTime(srcDir);
}

export async function launchServer() {
  const skipBuild = process.argv.includes('--skip-build');
  
  if (!skipBuild && checkDistStale()) {
    console.log('Building project...');
    const buildProc = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
    await new Promise((resolve, reject) => {
      buildProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
  }

  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  
  console.log(`Starting server on ${baseUrl}`);
  
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const serverProc = spawn(cmd, ['vite', 'preview', '--port', port.toString(), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });

  const cleanup = () => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProc.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
      } else {
        process.kill(-serverProc.pid);
      }
    } catch (e) {
      // ignore cleanup errors
    }
  };

  const timeout = 30000;
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        return { baseUrl, cleanup };
      }
    } catch (e) {
      // Wait and retry
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  cleanup();
  throw new Error('Server start timed out');
}
