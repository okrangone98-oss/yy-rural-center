const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/home-film.js'), 'utf8');

function element() {
  const handlers = {};
  return {
    addEventListener(name, listener) { handlers[name] = listener; },
    emit(name) { handlers[name]?.(); },
    style: {},
  };
}

function loadFilm({ reduceMotion = false, saveData = false } = {}) {
  const ids = Object.fromEntries(['', '-caption', '-progress', '-toggle', '-next', '-controls', '-fallback']
    .map(suffix => ['home-film' + suffix, element()]));
  const film = ids['home-film'];
  Object.assign(film, {
    paused: true,
    play() { this.paused = false; this.emit('play'); return Promise.resolve(); },
    pause() { this.paused = true; this.emit('pause'); },
    setAttribute() {},
    removeAttribute(name) { delete this[name]; },
    querySelector() { return null; },
    load() {},
  });

  const document = Object.assign(element(), {
    hidden: false,
    getElementById: id => ids[id],
  });
  let intersect;
  vm.runInNewContext(source, {
    document,
    window: { matchMedia: () => ({ matches: reduceMotion }) },
    navigator: { connection: { saveData } },
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe() {}
    },
  });
  return {
    film, document, ids,
    setVisible(visible) { intersect([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); },
    toggle() { ids['home-film-toggle'].emit('click'); },
  };
}

test('the homepage video pauses offscreen and preserves a manual pause', () => {
  const player = loadFilm();
  assert.equal(player.film.paused, true);
  player.setVisible(true);
  assert.equal(player.film.paused, false);
  player.setVisible(false);
  assert.equal(player.film.paused, true);
  player.setVisible(true);
  assert.equal(player.film.paused, false);

  player.toggle();
  player.setVisible(false);
  player.setVisible(true);
  assert.equal(player.film.paused, true);
});

test('motion and data preferences start on a poster while allowing playback on request', () => {
  for (const preference of [{ reduceMotion: true }, { saveData: true }]) {
    const player = loadFilm(preference);
    player.setVisible(true);
    assert.equal(player.film.paused, true);
    assert.match(player.film.poster, /\.webp$/);
    player.toggle();
    assert.equal(player.film.paused, false);
  }
});

test('failed clips are skipped and the archive link is available after all fail', () => {
  const player = loadFilm();
  const failed = new Set();

  for (let count = 0; count < 3; count++) {
    failed.add(player.film.src);
    player.film.emit('error');
  }

  assert.equal(failed.size, 3);
  assert.equal(player.ids['home-film-controls'].hidden, true);
  assert.equal(player.ids['home-film-fallback'].hidden, false);
});
