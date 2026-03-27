import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDir = path.resolve('tmp', 'smoke-check');

const pagesToVisit = [
  { name: 'home', path: '/' },
  { name: 'instructors', path: '/instructors' },
  { name: 'notices', path: '/notices' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
});

const results = [];

for (const target of pagesToVisit) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (failure === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) {
      return;
    }
    failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
  });

  const response = await page.goto(`${baseUrl}${target.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(outputDir, `${target.name}.png`),
    fullPage: true,
  });

  results.push({
    name: target.name,
    url: page.url(),
    status: response?.status() ?? null,
    title: await page.title(),
    consoleErrors,
    pageErrors,
    failedRequests,
  });

  await page.close();
}

const teacherPage = await context.newPage();
const teacherConsoleErrors = [];
const teacherPageErrors = [];
const teacherFailedRequests = [];

teacherPage.on('console', (message) => {
  if (message.type() === 'error') {
    teacherConsoleErrors.push(message.text());
  }
});

teacherPage.on('pageerror', (error) => {
  teacherPageErrors.push(error.message);
});

teacherPage.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText || 'unknown';
  if (failure === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) {
    return;
  }
  teacherFailedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
});

await teacherPage.goto(`${baseUrl}/instructors`, {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

await teacherPage.waitForTimeout(1000);

const firstTeacherButton = teacherPage.locator('main button[type="button"]').first();

try {
  await firstTeacherButton.waitFor({ state: 'visible', timeout: 15000 });
} catch {
  // Keep the existing reporting path below when the list never finishes loading.
}

if (await firstTeacherButton.count()) {
  await firstTeacherButton.click();
  await teacherPage.waitForLoadState('domcontentloaded');
  await teacherPage.waitForTimeout(3000);

  await teacherPage.screenshot({
    path: path.join(outputDir, 'teacher-detail.png'),
    fullPage: true,
  });

  results.push({
    name: 'teacher-detail',
    url: teacherPage.url(),
    status: null,
    title: await teacherPage.title(),
    consoleErrors: teacherConsoleErrors,
    pageErrors: teacherPageErrors,
    failedRequests: teacherFailedRequests,
  });
} else {
  results.push({
    name: 'teacher-detail',
    url: null,
    status: null,
    title: null,
    consoleErrors: ['No clickable teacher card found on /instructors'],
    pageErrors: teacherPageErrors,
    failedRequests: teacherFailedRequests,
  });
}

await teacherPage.close();
await browser.close();

await fs.writeFile(
  path.join(outputDir, 'results.json'),
  JSON.stringify(results, null, 2),
  'utf8',
);

console.log(JSON.stringify(results, null, 2));
