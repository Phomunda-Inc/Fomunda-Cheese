import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace("import './style.css';", '');

function boot(saved = null, { unavailable = false } = {}) {
  const elements = new Map();
  const errors = [];
  const document = {
    activeElement: null,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() { return filters; },
  };
  function element() {
    return {
      textContent: '', innerHTML: '', hidden: true, dataset: {}, handlers: {},
      addEventListener(type, callback) { this.handlers[type] = callback; },
      setAttribute(key, value) { this[key] = value; },
      contains(target) { return this.children?.includes(target) || false; },
      querySelector(selector) { return this.replacements?.get(selector) || null; },
      focus() { document.activeElement = this; },
      showModal() { this.open = true; },
      close() { this.open = false; },
    };
  }
  const filters = ['all', 'spinning', 'fly']
    .map((filter) => Object.assign(element(), { dataset: { filter } }));
  const storage = {
    value: saved,
    getItem() {
      if (unavailable) throw new Error('Storage blocked');
      return this.value;
    },
    setItem(key, value) {
      if (unavailable) throw new Error('Storage blocked');
      this.value = value;
    },
  };
  const context = vm.createContext({
    document, localStorage: storage, Intl,
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(source, context);
  return {
    document, storage, filters, errors, element,
    get: (selector) => document.querySelector(selector),
    run: (code) => vm.runInContext(code, context),
    click: (selector, dataset) => document.querySelector(selector).handlers.click({
      target: { closest: () => ({ dataset }) },
    }),
  };
}

test('catalog filters render matching products and expose selected state', () => {
  const app = boot();
  const count = () => (app.get('#products').innerHTML.match(/<article/g) || []).length;
  assert.equal(count(), 3);
  app.filters[1].handlers.click();
  assert.equal(count(), 2);
  assert.equal(app.filters[1]['aria-pressed'], 'true');
  assert.equal(app.filters[0]['aria-pressed'], 'false');
  app.filters[2].handlers.click();
  assert.equal(count(), 1);
  assert.match(app.get('#products').innerHTML, /Älven 900/);
  app.filters[0].handlers.click();
  assert.equal(count(), 3);
});

test('delegated product buttons update quantities and localized totals', () => {
  const app = boot();
  app.click('#products', { add: 'sjon' });
  app.click('#products', { add: 'sjon' });
  app.click('#products', { add: 'alven' });
  assert.equal(app.get('#cart-count').textContent, 3);
  const total = new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK', maximumFractionDigits: 0,
  }).format(3497);
  assert.equal(app.get('#cart-total').textContent, total);
  assert.match(app.get('#announcement').textContent, /Älven 900: 1/);
});

test('saved carts survive reloads and decrementing removes empty lines', () => {
  const app = boot();
  app.click('#products', { add: 'kusten' });
  const restored = boot(app.storage.value);
  assert.equal(restored.get('#cart-count').textContent, 1);
  restored.click('#cart-items', { change: 'kusten', step: '-1' });
  assert.equal(restored.get('#cart-count').textContent, 0);
  assert.equal(restored.storage.value, '{}');
  assert.match(restored.get('#cart-items').innerHTML, /Här var det lugnt/);
});

test('quantity ceiling is enforced in both state and button markup', () => {
  const app = boot('{"sjon":98}');
  app.click('#products', { add: 'sjon' });
  app.click('#products', { add: 'sjon' });
  assert.equal(app.get('#cart-count').textContent, 99);
  assert.equal(JSON.parse(app.storage.value).sjon, 99);
  assert.match(app.get('#cart-items').innerHTML, /data-step="1"[^>]*disabled/);
  assert.match(app.get('#announcement').textContent, /högst 99/);
});

test('malformed and unavailable storage is reported without breaking cart interaction', () => {
  for (const saved of ['not-json', 'null', '[]', '{"unknown":1}', '{"sjon":-1}', '{"sjon":1.5}', '{"sjon":100}']) {
    const app = boot(saved);
    assert.equal(app.errors.length, 1);
    assert.equal(app.get('#storage-warning').hidden, false);
    assert.equal(app.get('#cart-count').textContent, 0);
  }
  const app = boot(null, { unavailable: true });
  app.click('#products', { add: 'sjon' });
  assert.equal(app.get('#cart-count').textContent, 1);
  assert.equal(app.errors.length, 2);
  assert.equal(app.get('#storage-warning').hidden, false);
});

test('dialog controls open and close the cart', () => {
  const app = boot();
  app.get('#open-cart').handlers.click();
  assert.equal(app.get('#cart').open, true);
  app.get('#close-cart').handlers.click();
  assert.equal(app.get('#cart').open, false);
});

test('cart redraw restores focus or falls back to the close button', () => {
  const app = boot('{"sjon":2}');
  const items = app.get('#cart-items');
  const oldButton = app.element();
  const replacement = app.element();
  items.children = [oldButton];
  items.replacements = new Map([['[data-change="sjon"][data-step="-1"]', replacement]]);
  oldButton.focus();
  app.click('#cart-items', { change: 'sjon', step: '-1' });
  assert.equal(app.document.activeElement, replacement);
  items.children = [replacement];
  items.replacements.clear();
  app.click('#cart-items', { change: 'sjon', step: '-1' });
  assert.equal(app.document.activeElement, app.get('#close-cart'));
});

test('unknown catalog identities fail explicitly', () => {
  const app = boot();
  assert.throws(() => app.run("changeQuantity('unknown', 1)"), /Unknown product/);
});
