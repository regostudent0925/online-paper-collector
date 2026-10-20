import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(root, 'tools', 'codespaces-server.mjs');
const port = Number.parseInt(process.env.PORT || '4179', 10);
const pidFile = process.env.CODESPACES_SERVER_PID_FILE || '/tmp/online-paper-collector.pid';
const logFile = process.env.CODESPACES_SERVER_LOG_FILE || '/tmp/online-paper-collector.log';

function isHealthy() {
  return new Promise((resolve) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/',
      method: 'HEAD',
      timeout: 800
    }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

if (await isHealthy()) {
  console.log(`Codespaces preview already running on port ${port}.`);
  process.exit(0);
}

const output = fs.openSync(logFile, 'a');
const child = spawn(process.execPath, [serverFile], {
  cwd: root,
  detached: true,
  env: { ...process.env, HOST: '0.0.0.0', PORT: String(port) },
  stdio: ['ignore', output, output]
});

fs.closeSync(output);
child.unref();
fs.writeFileSync(pidFile, `${child.pid}\n`, 'utf8');

for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (await isHealthy()) {
    console.log(`Codespaces preview started on port ${port} (PID ${child.pid}).`);
    process.exit(0);
  }
}

console.error(`Codespaces preview did not start. Check ${logFile}.`);
process.exit(1);
