import assert from 'node:assert/strict';
import test from 'node:test';
import { createCodespacesServer } from '../tools/codespaces-server.mjs';

test('Codespaces 정적 서버는 공개 빌드만 제공하고 쓰기 요청을 거부한다', async t => {
  const server = createCodespacesServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const home = await fetch(origin + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /온라인 폐지줍기/);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);

  const npay = await fetch(origin + '/api/npay');
  assert.equal(npay.status, 200);
  assert.equal((await npay.json()).directLinks.length, 18);

  assert.equal((await fetch(origin + '/api/catalog', { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(origin + '/api/catalog', { method: 'POST' })).status, 405);
  assert.equal((await fetch(origin + '/..%2Fpackage.json')).status, 404);
});
