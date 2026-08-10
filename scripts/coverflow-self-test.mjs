import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const section = html.match(/<div class="gallery-coverflow"[\s\S]*?<\/section>/)?.[0] || '';
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((source) => source.includes('activity-coverflow'));

assert.equal((section.match(/class="gallery-item"/g) || []).length, 12);
assert.match(section, /aria-label="이전 활동사진"/);
assert.match(section, /aria-label="다음 활동사진"/);
assert.match(section, /id="gallery-dots"/);
assert.ok(script);
new Function(script);

console.log('Coverflow gallery self-test passed.');
