import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const envPath = path.resolve('.env.local');
const baseUrl = process.env.ROLE_CHECK_BASE_URL || 'http://localhost:3017/iumteo';
const memberEmail = process.env.CHAT_TEST_MEMBER_EMAIL || 'okrangone98@gmail.com';
const instructorEmail = process.env.CHAT_TEST_INSTRUCTOR_EMAIL || 'seizeworld@naver.com';
const adminUsername = process.env.ROLE_CHECK_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ROLE_CHECK_ADMIN_PASSWORD || '1234';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDir = path.resolve('tmp', 'role-flow-check');
const basePath = (() => {
  try {
    const pathname = new URL(baseUrl).pathname.replace(/\/$/, '');
    return pathname === '/' ? '' : pathname;
  } catch {
    return '';
  }
})();

function readEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function pickValue(record, aliases) {
  for (const alias of aliases) {
    const matchedKey = Object.keys(record).find(
      (key) => key === alias || key.replace(/\s+/g, '') === alias.replace(/\s+/g, ''),
    );
    if (matchedKey && String(record[matchedKey] || '').trim()) {
      return String(record[matchedKey]).trim();
    }
  }
  return '';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function createCookieJar() {
  const jar = new Map();

  return {
    apply(response) {
      const setCookies = response.headers.getSetCookie?.() || [];
      for (const entry of setCookies) {
        const firstSegment = entry.split(';', 1)[0];
        const separatorIndex = firstSegment.indexOf('=');
        if (separatorIndex < 0) continue;
        const key = firstSegment.slice(0, separatorIndex);
        const value = firstSegment.slice(separatorIndex + 1);
        jar.set(key, value);
      }
    },
    entries() {
      return Array.from(jar.entries());
    },
    header() {
      return Array.from(jar.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
  };
}

async function fetchJson(url, options = {}, jar) {
  const headers = new Headers(options.headers || {});
  if (jar?.header()) headers.set('cookie', jar.header());

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
  });

  jar?.apply(response);

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

async function loginWithCredentials(base, credential) {
  const jar = createCookieJar();

  const csrf = await fetchJson(`${base}/api/auth/csrf`, { method: 'GET' }, jar);
  if (!csrf.response.ok || !csrf.data?.csrfToken) {
    throw new Error(`Failed to fetch csrf token for ${credential.username}`);
  }

  const form = new URLSearchParams({
    csrfToken: csrf.data.csrfToken,
    username: credential.username,
    password: credential.password,
    callbackUrl: `${base}${basePath || ''}/`,
    json: 'true',
  });

  const login = await fetchJson(
    `${base}/api/auth/callback/credentials?json=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
    jar,
  );

  if (login.data?.error) {
    throw new Error(`Login failed for ${credential.username}: ${login.data.error}`);
  }

  const session = await fetchJson(`${base}/api/auth/session`, { method: 'GET' }, jar);
  if (!session.response.ok || !session.data?.user?.email) {
    throw new Error(`Session lookup failed for ${credential.username}`);
  }

  return { jar, session: session.data };
}

async function loadLocalEnv() {
  const text = await fs.readFile(envPath, 'utf8');
  return readEnv(text);
}

async function fetchGasUser(env, email) {
  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', 'getUser');
  url.searchParams.set('apiKey', env.GAS_API_KEY);
  url.searchParams.set('email', email);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`GAS getUser failed for ${email}: ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.success === false || payload?.ok === false) {
    throw new Error(payload?.message || `GAS getUser failed for ${email}`);
  }

  if (!payload?.data || typeof payload.data !== 'object') {
    throw new Error(`No GAS user data found for ${email}`);
  }

  return payload.data;
}

function buildCredential(record, role) {
  const email = pickValue(record, ['이메일', '로그인 이메일', '로그인용 이메일', 'Email', 'email']);
  const phone = normalizePhone(pickValue(record, ['연락처', '전화번호', '핸드폰 번호', 'Phone', 'phone']));
  const password =
    pickValue(record, ['비밀번호', '사용자비번', 'Password_Hash', 'password', 'Password']) ||
    (role === 'INSTRUCTOR' && phone.length >= 4 ? phone.slice(-4) : '');

  if (!email || !password) {
    throw new Error(`${role} credential is incomplete for ${email || 'unknown user'}`);
  }

  return { username: email, password };
}

async function loginAndCapture(context, name, credential, expectedPath) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (failure === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) return;
    failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
  });

  const origin = new URL(baseUrl).origin;
  const login = await loginWithCredentials(origin, credential);
  await context.addCookies(
    login.jar.entries().map(([name, value]) => ({
      name,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: name.startsWith('next-auth.') || name.startsWith('__Secure-next-auth.'),
      sameSite: 'Lax',
      secure: false,
    })),
  );

  const targetUrl = `${baseUrl}${expectedPath}`;
  const pageResponse = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForURL((url) => url.pathname.endsWith(expectedPath), { timeout: 30000 });
  await page.waitForTimeout(2500);

  const session = await page.evaluate(async () => {
    const sessionPath = `${window.location.origin}${window.__ROLE_CHECK_BASE_PATH__ || ''}/api/auth/session`;
    const response = await fetch(sessionPath, { cache: 'no-store' });
    return response.json();
  });

  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: true,
  });

  const result = {
    name,
    loginStatus: pageResponse?.status() ?? null,
    url: page.url(),
    expectedPath,
    sessionRole: login.session?.user?.role || session?.user?.role || null,
    consoleErrors,
    pageErrors,
    failedRequests,
  };

  await page.close();
  return result;
}

await fs.mkdir(outputDir, { recursive: true });

const env = await loadLocalEnv();
const memberRecord = await fetchGasUser(env, memberEmail);
const instructorRecord = await fetchGasUser(env, instructorEmail);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const results = [];

try {
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await context.addInitScript((currentBasePath) => {
      window.__ROLE_CHECK_BASE_PATH__ = currentBasePath;
    }, basePath);
    results.push(
      await loginAndCapture(context, 'member-profile', buildCredential(memberRecord, 'USER'), '/profile'),
    );
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await context.addInitScript((currentBasePath) => {
      window.__ROLE_CHECK_BASE_PATH__ = currentBasePath;
    }, basePath);
    results.push(
      await loginAndCapture(
        context,
        'instructor-profile',
        buildCredential(instructorRecord, 'INSTRUCTOR'),
        '/teacher',
      ),
    );
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await context.addInitScript((currentBasePath) => {
      window.__ROLE_CHECK_BASE_PATH__ = currentBasePath;
    }, basePath);
    try {
      results.push(
        await loginAndCapture(
          context,
          'admin-dashboard',
          { username: adminUsername, password: adminPassword },
          '/admin',
        ),
      );
    } catch (error) {
      results.push({
        name: 'admin-dashboard',
        url: null,
        expectedPath: '/admin',
        sessionRole: null,
        consoleErrors: [],
        pageErrors: [error instanceof Error ? error.message : String(error)],
        failedRequests: [],
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(JSON.stringify(results, null, 2));
