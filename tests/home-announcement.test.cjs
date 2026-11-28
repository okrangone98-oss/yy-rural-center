const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(saved, blocked = false, autoOpen = true) {
  const handlers = {};
  const checkbox = { checked: false };
  const launcher = { hidden: true, addEventListener: (event, fn) => { handlers.reopen = fn; } };
  const dialog = {
    open: false,
    dataset: { autoOpen: String(autoOpen) },
    showModal() { this.open = true; },
    close() { this.open = false; },
    querySelectorAll: () => [{ addEventListener: (event, fn) => { handlers.close = fn; } }],
    querySelector: () => ({ addEventListener() {} }),
    addEventListener: (event, fn) => { handlers.cancel = fn; },
  };
  let value = saved;
  const storage = {
    getItem() { if (blocked) throw Error('blocked'); return value; },
    setItem(key, next) { if (blocked) throw Error('blocked'); value = next; },
    removeItem() { if (blocked) throw Error('blocked'); value = null; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/home-announcement.js'), 'utf8'), {
    document: { getElementById: id => ({ 'home-announcement': dialog, 'announcement-reopen': launcher, 'announcement-hide-today': autoOpen ? checkbox : null })[id] },
    localStorage: storage, Date, Number,
  });
  return { handlers, dialog, launcher, checkbox, stored: () => value };
}

test('desktop and mobile share automatic opening; closing exposes reopen button', () => {
  const f = setup(null);
  assert.equal(f.dialog.open, true);
  assert.equal(f.launcher.hidden, true);
  f.handlers.close();
  assert.equal(f.launcher.hidden, false);
  f.handlers.reopen();
  assert.equal(f.dialog.open, true);
});

test('today suppression still allows reopening and explicitly cancelling suppression', () => {
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  const f = setup(String(midnight.getTime()));
  assert.equal(f.dialog.open, false);
  assert.equal(f.launcher.hidden, false);
  assert.equal(f.checkbox.checked, true);
  f.handlers.reopen();
  f.checkbox.checked = false;
  f.handlers.close();
  assert.equal(f.stored(), null);
});

test('invalid, expired and far future hide values do not block the popup', () => {
  for (const value of ['invalid', 'Infinity', '1', String(Date.now() + 7 * 86400000)]) {
    assert.equal(setup(value).dialog.open, true);
  }
});

test('blocked browser storage does not prevent opening or closing', () => {
  const f = setup(null, true);
  assert.equal(f.dialog.open, true);
  f.checkbox.checked = true;
  f.handlers.close();
  assert.equal(f.dialog.open, false);
  assert.equal(f.launcher.hidden, false);
});


test('manual homepage announcement opens only on request and leaves the opener available', () => {
  const f = setup('unchanged', false, false);
  assert.equal(f.dialog.open, false);
  assert.equal(f.launcher.hidden, false);

  f.handlers.reopen();
  assert.equal(f.dialog.open, true);
  assert.equal(f.launcher.hidden, false);

  f.handlers.close();
  assert.equal(f.dialog.open, false);
  assert.equal(f.stored(), 'unchanged');
});
