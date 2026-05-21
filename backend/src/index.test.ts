import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess: ChildProcessWithoutNullStreams;
let serverOutput = '';

async function waitForServer(port: number, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(port)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Server did not start on port ${port}. Output: ${serverOutput}`);
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');

    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function requestJson<T>(
  pathName: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T; headers: Headers }> {
  const response = await fetch(`${BASE_URL}${pathName}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers
    }
  });
  const body = (await response.json()) as T;

  return {
    status: response.status,
    body,
    headers: response.headers
  };
}

async function login(): Promise<string> {
  const response = await requestJson<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'manager@raynet.cz',
      password: 'Raynet'
    })
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.token, 'string');

  return response.body.token;
}

async function stopServer(): Promise<void> {
  if (serverProcess.killed || serverProcess.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    const killProcess = spawn('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F']);
    await once(killProcess, 'exit');
    return;
  }

  serverProcess.kill();
  await once(serverProcess, 'exit');
}

describe('backend API', () => {
  before(async () => {
    serverProcess = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(PORT)
        }
      }
    );

    serverProcess.stdout.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });

    serverProcess.stderr.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });

    await waitForServer(PORT);
  });

  after(async () => {
    await stopServer();
  });

  test('logs in with the demo manager account', async () => {
    const response = await requestJson<{
      token: string;
      expiresAt: string;
      user: { email: string; name: string; role: string };
    }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'manager@raynet.cz',
        password: 'Raynet'
      })
    });

    assert.equal(response.status, 200);
    assert.match(response.body.token, /^[a-f0-9]{64}$/);
    assert.equal(response.body.user.email, 'manager@raynet.cz');
    assert.equal(response.body.user.role, 'manager');
    assert.ok(Date.parse(response.body.expiresAt) > Date.now());
  });

  test('requires a bearer token for the leaderboard', async () => {
    const response = await requestJson<{ status: string; message: string }>('/api/leaderboard?limit=1');

    assert.equal(response.status, 401);
    assert.equal(response.body.status, 'error');
  });

  test('returns leaderboard data for an authenticated request', async () => {
    const token = await login();
    const response = await requestJson<{
      totalSalespeople: number;
      sortBy: string;
      data: Array<{ rank: number; ownerName: string; wonRevenue: number }>;
    }>('/api/leaderboard?limit=3', {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.sortBy, 'wonRevenue');
    assert.equal(response.body.data.length, 3);
    assert.equal(response.body.data[0].rank, 1);
    assert.equal(response.body.data[0].ownerName, 'Lukáš Sardinka');
    assert.ok(response.body.data[0].wonRevenue > 0);
  });

  test('invalidates a token after logout', async () => {
    const token = await login();
    const logoutResponse = await requestJson<{ status: string }>('/api/logout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutResponse.body.status, 'ok');

    const meResponse = await requestJson<{ status: string }>('/api/me', {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(meResponse.status, 401);
  });

  test('rate limits suspicious failed login activity and logs it', async () => {
    const username = 'rate-limit-manager@raynet.cz';
    const startedOutputLength = serverOutput.length;
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await requestJson<{ status: string }>('/api/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.42'
        },
        body: JSON.stringify({
          username,
          password: 'bad-password'
        })
      });

      statuses.push(response.status);
    }

    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
    assert.match(serverOutput.slice(startedOutputLength), /auth\.suspicious_login_activity/);
    assert.match(serverOutput.slice(startedOutputLength), /auth\.rate_limit_exceeded/);
  });
});
