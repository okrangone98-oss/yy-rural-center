const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(rows) {
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', children: [],
    appendChild(child) { this.children.push(child); },
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; },
    pause() {}, play() { return Promise.resolve(); },
  });
  const ids = ['video-preview-tbody', 'video-preview-prev', 'video-preview-next', 'video-preview-position', 'video-preview-media', 'video-preview-video', 'video-preview-image', 'video-preview-title', 'video-preview-meta', 'video-preview-desc'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const context = vm.createContext({
    window: { SHEET_CONFIG: { videos: { csvUrl: 'fixture' } }, CSVUtils: {
      safeText: value => String(value ?? ''), normalizeHeader: value => value.trim().replace(/\s+/g, ''), fetchCSV: async () => rows,
    } },
    document: { getElementById: id => elements[id], querySelector: () => null, createElement: element },
    console, URLSearchParams, setTimeout,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/videos.js'), 'utf8'), context);
  return { elements, context };
}

const rows = [
  ['id', '제목', '날짜', '영상링크', '상태'],
  ['a', '첫 번째 영상', '2026. 10. 30.', 'https://example.test/a.mp4', '공개'],
  ['b', '두 번째 영상', '2026.10.29', 'https://example.test/b.mp4', '공개'],
  ['secret', '비공개 영상', '2026.10.31', 'https://example.test/private.mp4', '비공개'],
];

test('next and previous switch title, video URL and detail link together; wrap both ends', async () => {
  const f = fixture(rows);
  await vm.runInContext('window.VideosModule.load()', f.context);
  assert.equal(f.elements['video-preview-position'].textContent, '1 / 2');
  f.elements['video-preview-next'].onclick();
  assert.equal(f.elements['video-preview-title'].textContent, '두 번째 영상');
  assert.equal(f.elements['video-preview-video'].src, 'https://example.test/b.mp4');
  assert.equal(f.elements['video-preview-media'].href, 'video-detail.html?id=b');
  assert.equal(f.elements['video-preview-position'].textContent, '2 / 2');
  f.elements['video-preview-next'].onclick();
  assert.equal(f.elements['video-preview-position'].textContent, '1 / 2');
  f.elements['video-preview-prev'].onclick();
  assert.equal(f.elements['video-preview-position'].textContent, '2 / 2');
});

test('a single visible video disables navigation', async () => {
  const f = fixture(rows.slice(0, 2));
  await vm.runInContext('window.VideosModule.load()', f.context);
  assert.equal(f.elements['video-preview-prev'].disabled, true);
  assert.equal(f.elements['video-preview-next'].disabled, true);
});

test('an empty feed does not activate navigation', async () => {
  const f = fixture(rows.slice(0, 1));
  await vm.runInContext('window.VideosModule.load()', f.context);
  assert.equal(f.elements['video-preview-title'].textContent, '활동영상');
  assert.match(f.elements['video-preview-tbody'].innerHTML, /등록된 활동영상이 없습니다/);
});
