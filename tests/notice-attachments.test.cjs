const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function element(tag) {
  return { tag, children: [], append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; }, setAttribute(key, value) { this[key] = value; }, addEventListener() {} };
}
const context = { window: {}, URL, document: { createElement: element } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/notice-attachments.js'), 'utf8'), context);
const { parse, previewFor, render } = context.window.NoticeAttachments;

test('notice text precedes photos and files in both dialogs', () => {
  for (const [file, prefix] of [['index.html', 'notice-preview-modal'], ['notice.html', 'modal']]) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const offsets = ['content', 'photos', 'files'].map(section => html.indexOf(`id="${prefix}-${section}"`));
    assert.ok(offsets[0] >= 0 && offsets[0] < offsets[1] && offsets[1] < offsets[2], file);
  }
});

test('named and legacy attachment links retain their labels', () => {
  const list = parse('워크숍 포스터::https://example.test/poster.png\nhttps://drive.google.com/file/d/public_1/view');
  assert.equal(list[0].name, '워크숍 포스터');
  assert.equal(list[1].name, '첨부파일 2');
});

test('attachment previews render without a second click', () => {
  const list = parse('포스터::https://example.test/poster.png?version=1\n안내문::https://drive.google.com/open?id=public_1&resourcekey=key');
  const container = element('div');
  render(container, list);
  const [image, drive] = container.children;
  assert.equal(image.children[1].tag, 'img');
  assert.equal(image.children[1].src, list[0].url);
  assert.equal(drive.children[1].tag, 'iframe');
  assert.equal(drive.children[1].src, 'https://drive.google.com/file/d/public_1/preview?resourcekey=key');
  assert.equal(drive.children[0].children[1].href, list[1].url);
});

test('unknown files remain links and lookalike Drive domains cannot create frames', () => {
  assert.equal(previewFor('https://drive.google.com.example.test/file/d/not-drive/view'), null);
  assert.equal(previewFor('javascript:alert(1)', true), null);
  const container = element('div');
  render(container, parse('자료::https://example.test/data.zip'));
  assert.equal(container.children[0].children.length, 1);
  render(container, []);
  assert.equal(container.children.length, 0);
});
