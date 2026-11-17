const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function element(tag) {
  const node = {
    tag, children: [], listeners: {}, style: {}, attrs: {}, parent: null,
    append(...nodes) {
      nodes.forEach(child => {
        if (child && typeof child === 'object') child.parent = node;
        node.children.push(child);
      });
    },
    replaceChildren(...nodes) {
      node.children.forEach(child => { if (child) child.parent = null; });
      node.children = [];
      node.append(...nodes);
    },
    setAttribute(key, value) { node.attrs[key] = String(value); node[key] = value; },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(node.attrs, key) ? node.attrs[key] : null; },
    addEventListener(type, fn) { (node.listeners[type] = node.listeners[type] || []).push(fn); },
    dispatch(type, event = {}) {
      (node.listeners[type] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {}, ...event }));
    },
    replaceWith(next) {
      const siblings = node.parent && node.parent.children;
      if (!siblings) return;
      siblings[siblings.indexOf(node)] = next;
      if (next) next.parent = node.parent;
      node.parent = null;
    },
    focus() { node.focused = true; },
    closest() { return null; },
    querySelector() { return null; },
  };
  node.classList = {
    set: new Set(),
    add(name) { node.classList.set.add(name); },
    remove(name) { node.classList.set.delete(name); },
    contains(name) { return node.classList.set.has(name); },
  };
  return node;
}

function load() {
  const body = element('body');
  const document = { createElement: element, body, activeElement: null, querySelectorAll: () => [] };
  const context = { window: {}, URL, document, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/notice-attachments.js'), 'utf8'), context);
  return { api: context.window.NoticeAttachments, document, body };
}

const { api, body } = load();
const { parse, previewFor, render, scrollbarGeometry, attachScrollbar, openLightbox, closeLightbox } = api;

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
  // 드라이브 첨부는 검은 레터박스가 없는 썸네일 이미지를 먼저 시도한다.
  assert.equal(drive.children[1].tag, 'img');
  assert.equal(drive.children[1].src, 'https://drive.google.com/thumbnail?id=public_1&sz=w1600&resourcekey=key');
  assert.equal(drive.children[0].children[1].href, list[1].url);
});

test('drive posters fall back to the preview frame when the thumbnail cannot load', () => {
  const list = parse('안내문::https://drive.google.com/open?id=public_1&resourcekey=key');
  const container = element('div');
  render(container, list);
  const card = container.children[0];
  const thumbnail = card.children[1];
  assert.equal(thumbnail.tag, 'img');
  thumbnail.dispatch('error');
  const frame = card.children[1];
  assert.equal(frame.tag, 'div');
  assert.equal(frame.className, 'notice-attachment-frame');
  assert.equal(frame.children[0].tag, 'iframe');
  assert.equal(frame.children[0].src, 'https://drive.google.com/file/d/public_1/preview?resourcekey=key');
  // iframe 위에는 스와이프를 통과시키는 보호 레이어가 있어야 한다.
  assert.equal(frame.children[1].tag, 'button');
  assert.equal(frame.children[1].className, 'notice-attachment-shield');
  assert.equal(frame.children[1].getAttribute('aria-label'), '안내문 크게 보기');
});

test('broken poster images are replaced with a readable message', () => {
  const container = element('div');
  render(container, parse('포스터::https://example.test/missing.png'));
  const card = container.children[0];
  const image = card.children[1];
  image.dispatch('error');
  assert.equal(card.children[1].tag, 'p');
  assert.match(card.children[1].textContent, /이미지를 불러오지 못했습니다/);
});

test('every preview offers a big-view action that opens the lightbox', () => {
  const container = element('div');
  render(container, parse('포스터::https://drive.google.com/file/d/poster_1/view'));
  const card = container.children[0];
  const button = card.children[0].children[2];
  assert.equal(button.tag, 'button');
  assert.equal(button.className, 'notice-attachment-big-view');

  button.dispatch('click');
  const viewer = body.children.at(-1);
  assert.equal(viewer.className, 'notice-lightbox');
  assert.equal(viewer.classList.contains('is-open'), true);
  const panel = viewer.children[1];
  assert.equal(panel.children[0].children[0].textContent, '포스터');
  const stage = panel.children[2].children[0];
  assert.equal(stage.children[0].tag, 'img');
  assert.equal(stage.children[0].src, 'https://drive.google.com/thumbnail?id=poster_1&sz=w1600');

  const zoom = panel.children[1].children.find(node => node.getAttribute('data-zoom') === '2');
  zoom.dispatch('click');
  assert.equal(stage.style.width, '200%');

  const close = panel.children[0].children[1];
  close.dispatch('click');
  assert.equal(viewer.classList.contains('is-open'), false);
  assert.equal(stage.children.length, 0);
  closeLightbox();
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

test('scrollbar geometry hides itself without overflow and tracks the scroll position', () => {
  const hidden = scrollbarGeometry({ scrollHeight: 500, clientHeight: 500, trackHeight: 400 });
  assert.equal(hidden.visible, false);
  assert.equal(hidden.thumbHeight, 0);
  assert.equal(hidden.max, 0);
  const top = scrollbarGeometry({ scrollHeight: 2000, clientHeight: 500, trackHeight: 400, scrollTop: 0 });
  assert.equal(top.visible, true);
  assert.equal(top.thumbHeight, 100);
  assert.equal(top.thumbTop, 0);
  const middle = scrollbarGeometry({ scrollHeight: 2000, clientHeight: 500, trackHeight: 400, scrollTop: 750 });
  assert.equal(middle.thumbTop, 150);
  const short = scrollbarGeometry({ scrollHeight: 2000, clientHeight: 500, trackHeight: 30, minThumb: 40 });
  assert.equal(short.thumbHeight, 30);
});

test('attached scrollbar positions its thumb and hides on short content', () => {
  const scroller = element('div');
  const container = element('div');
  container.append(scroller);
  scroller.clientHeight = 400;
  scroller.scrollHeight = 1600;
  scroller.scrollTop = 300;
  const api = attachScrollbar(scroller, { container });
  assert.ok(api);
  const bar = container.children[1];
  assert.equal(bar.className, 'notice-scrollbar');
  const thumb = bar.children[0].children[0];
  assert.equal(thumb.style.height, '100px');
  assert.equal(thumb.style.transform, 'translateY(75px)');

  scroller.scrollHeight = 400;
  api.refresh();
  assert.equal(bar.style.display, 'none');
  assert.equal(bar.getAttribute('aria-hidden'), 'true');
});

test('both modals wire the scroll slider and load the shared assets', () => {
  for (const file of ['index.html', 'notice.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(html, /data-notice-scroll/, file);
    assert.match(html, /notice-attachments\.js\?v=/, file);
    assert.match(html, /notice-attachments\.css\?v=/, file);
  }
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/notice-attachments.css'), 'utf8');
  for (const rule of ['.notice-scrollbar', '.notice-scrollbar-thumb', '.notice-lightbox', '.notice-attachment-shield', 'touch-action: pan-y']) {
    assert.ok(css.includes(rule), rule);
  }
});
