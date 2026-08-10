import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const headings = html.match(/<h3 class="text-vaporize">[^<]+<\/h3>/g) || [];
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((source) => source.includes('function playVaporize'));

assert.equal(headings.length, 2);
assert.match(headings[0], /주민이 지역의 변화를 함께 기획하고 실행할 수 있도록 지원합니다/);
assert.match(headings[1], /주민이 주도하고 공동체가 성장하는 지속가능한 양양/);
assert.ok(script);
assert.match(html, /className = "text-vaporize-particle"/);
assert.match(html, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(html, /random-letter-swap|playSwap/);
new Function(script);

console.log('Text vaporize self-test passed.');
