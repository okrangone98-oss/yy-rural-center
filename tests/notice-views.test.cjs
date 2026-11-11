const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(change = () => {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', style: {},
      addEventListener() {}, querySelector() { return null; },
      classList: { add() {}, remove() {}, contains() { return false; } },
    });
    return elements.get(id);
  }
  const notices = [
    ['번호', '구분', '제목', '내용', '날짜', '게시상태', '저장ID'],
    ['2', '안내', '기존 제목', '', '2026.10.15', '공개', '11'],
    ['3', '모집', '다른 공지', '', '2026.09.16', '공개', '1'],
    ['1', '안내', '아래에 추가한 새 공지', '', '2026.10.22', '공개', '26'],
  ];
  const views = [['id', 'count', '제목', '작성일'], ['11', '57', '기존 제목', '2026. 10. 15.'], ['1', '61', '다른 공지', '2026-09-16'], ['26', '0', '아래에 추가한 새 공지', '2026/10/22']];
  change(notices, views);
  const counts = { 11: 57, 1: 61, 26: 0 };
  const calls = [];
  const context = vm.createContext({
    console, URL, URLSearchParams, Set, Map,
    window: { SHEET_CONFIG: { notices: { csvUrl: 'notices', viewsCsvUrl: 'views', viewsApiUrl: 'https://example.test/exec' } } },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    fetch: async url => {
      calls.push(url);
      if (url.includes('addView')) {
        const id = new URL(url).searchParams.get('id');
        counts[id] = (counts[id] || 0) + 1;
      }
      return { ok: true, json: async () => ({ ok: true, data: { ...counts } }) };
    },
  });
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/utils.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/notice-data.js'), 'utf8'), context);
  context.window.CSVUtils.fetchCSV = async url => url === 'notices' ? notices : views;
  const html = fs.readFileSync(path.join(root, 'notice.html'), 'utf8');
  vm.runInContext(html.slice(html.indexOf('// Notice Board Logic'), html.lastIndexOf('  </script>')), context);
  return { context, counts, calls, elements };
}

test('newest date wins over the sheet number and numbers are not rendered', async () => {
  const f = fixture(notices => { notices[3][0] = '99'; });
  await vm.runInContext('loadNotices()', f.context);
  assert.equal(vm.runInContext('NOTICES[0].storageId', f.context), '26');
  assert.equal(vm.runInContext('VIEW_COUNTS["id:11"]', f.context), 57);
  assert.equal(vm.runInContext('VIEW_COUNTS["id:1"]', f.context), 61);
  assert.doesNotMatch(f.elements.get('notice-tbody').innerHTML, /notice-number|공지번호/);
});

test('new notice increments ID 26 once, not display number 1; rename retains identity', async () => {
  const f = fixture();
  await vm.runInContext('loadNotices()', f.context);
  vm.runInContext('addViewCount(NOTICES[0]); NOTICES[0].title="수정한 제목"; addViewCount(NOTICES[0]);', f.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.counts[26], 1);
  assert.equal(f.counts[1], 61);
  assert.equal(f.counts[11], 57);
  assert.equal(f.calls.filter(url => url.includes('addView')).length, 1);
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[0])', f.context), 'id:26');
});

test('CSV fallback still resolves counts by storage ID after a title change', async () => {
  const f = fixture();
  f.context.fetch = async () => { throw new Error('offline'); };
  await vm.runInContext('loadNotices();', f.context);
  vm.runInContext('NOTICES[1].title="제목 변경";', f.context);
  await vm.runInContext('loadViewCounts()', f.context);
  assert.equal(vm.runInContext('VIEW_COUNTS[viewKeyOf(NOTICES[1])]', f.context), 57);
});

test('same title on different dates increments only the matching record', async () => {
  const f = fixture((notices, views) => {
    notices[1][2] = notices[3][2] = '반복 모집';
    notices[1][6] = notices[3][6] = '';
    views[1][2] = views[3][2] = '반복 모집';
  });
  await vm.runInContext('loadNotices()', f.context);
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[0])', f.context), 'id:26');
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[1])', f.context), 'id:11');
  vm.runInContext('addViewCount(NOTICES[0]);', f.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.counts[26], 1);
  assert.equal(f.counts[11], 57);
});

test('shifted storage IDs never charge a new notice to an existing title', async () => {
  const f = fixture((notices, views) => {
    notices[1][6] = '1';
    notices[3][6] = '11';
    views[0][3] = '공지번호';
    views[3][2] = '';
  });
  await vm.runInContext('loadNotices()', f.context);
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[0])', f.context), '');
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[1])', f.context), 'id:11');
  vm.runInContext('addViewCount(NOTICES[0]);', f.context);
  assert.equal(f.calls.filter(url => url.includes('addView')).length, 0);
});

test('missing or invalid dates sort last and ambiguous legacy titles do not count', async () => {
  const f = fixture((notices, views) => {
    notices[2][4] = '2026. 2. 30';
    notices[3][2] = notices[1][2];
    views[0][3] = '공지번호';
    views[3][2] = '';
  });
  await vm.runInContext('loadNotices()', f.context);
  assert.equal(vm.runInContext('NOTICES.at(-1).date', f.context), '2026. 2. 30');
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[0])', f.context), '');
  assert.equal(vm.runInContext('viewKeyOf(NOTICES[1])', f.context), '');
});
