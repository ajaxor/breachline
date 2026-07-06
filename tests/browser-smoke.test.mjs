import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const browsers = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const mimeTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.json', 'application/json'],
]);

function findBrowser() {
  return browsers.find((candidate) => spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) ?? null;
}

function serveSmokeSite() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/build-info.json') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"version":"smoke","commit":"local"}');
        return;
      }

      let requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
      if (requestPath.startsWith('/src-smoke/')) requestPath = `/src/${requestPath.slice('/src-smoke/'.length)}`;
      const localPath = normalize(join(root, requestPath));
      if (!localPath.startsWith(root)) throw new Error('Invalid path');
      let content = await readFile(localPath);
      if (requestPath === '/index.html') {
        const html = content.toString()
          .replaceAll('__BUILD_ID__', 'smoke')
          .replace(
            "await import(`./src-smoke/main.js`);",
            "await import(`./src-smoke/main.js`); await import('./tests/browser-smoke-runner.mjs');",
          );
        content = Buffer.from(html);
      }
      response.writeHead(200, { 'content-type': mimeTypes.get(extname(localPath)) ?? 'application/octet-stream' });
      response.end(content);
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end(error.message);
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function dumpDom(browser, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=10000',
      '--dump-dom',
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Chrome exited with ${code}: ${stderr}`));
      else resolve(stdout);
    });
  });
}

test('browser startup, drafting, deployment roster, and enemy inspection smoke flow', async (context) => {
  const browser = findBrowser();
  if (!browser) {
    if (process.env.CI) assert.fail('No supported Chrome/Chromium executable is available in CI');
    context.skip('Chrome/Chromium is not installed locally');
    return;
  }

  const server = await serveSmokeSite();
  try {
    const address = server.address();
    const html = await dumpDom(browser, `http://127.0.0.1:${address.port}/`);
    assert.match(html, /id="smoke-result" data-status="pass"/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});