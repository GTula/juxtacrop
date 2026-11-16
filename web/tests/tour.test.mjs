import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Run the actual controller against a small DOM adapter. External data and map
// rendering are deliberately excluded; these tests exercise tour transitions.
const source = readFileSync(new URL('../demo/js/tour.js', import.meta.url), 'utf8');
function setup(seen = false) {
  const nodes = new Map(), listeners = new Map(), storage = new Map(seen ? [['juxtacrop.tour.invitation.v1', '1']] : []);
  let interval, root, help, loads = 0;
  class Node {
    constructor(name = '') {
      this.name = name; this.style = {}; this.dataset = {}; this.hidden = false; this.isConnected = true; this.children = [];
      this.handlers = {}; this.classes = new Set(); this.disabled = false;
      this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), contains: c => this.classes.has(c) };
    }
    set innerHTML(value) { this.html = value; }
    get innerHTML() { return this.html || ''; }
    append(el) { this.children.push(el); }
    prepend(el) { this.children.unshift(el); }
    setAttribute() {}
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    get offsetWidth() { return 350; }
    get offsetHeight() { return 300; }
    getBoundingClientRect() { return { left: 20, top: 20, right: 300, bottom: 200, width: 280, height: 180 }; }
    closest(selector) { return selector === '.hidden' && this.classes.has('hidden') ? this : null; }
    contains(el) { return el === this || this.children.includes(el); }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    querySelector(selector) {
      if (selector === 'svg') return this.children.find(n => n.name === 'svg');
      return node(selector);
    }
    querySelectorAll() { return []; }
  }
  const node = name => { if (!nodes.has(name)) nodes.set(name, new Node(name)); return nodes.get(name); };
  const document = {
    body: new Node('body'), activeElement: new Node('initial'),
    createElement: name => { const el = new Node(name); if (name === 'div') root = el; if (name === 'button' && !help) help = el; return el; },
    createElementNS: (_, name) => new Node(name),
    querySelector: node,
    querySelectorAll: selector => selector.split(',').map(s => node(s.trim())).sort((a, b) => (a.name === '#rbPlans' ? -1 : b.name === '#rbPlans' ? 1 : 0)),
    addEventListener: (type, fn) => { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }
  };
  const emit = type => { for (const fn of listeners.get(type) || []) fn({}); };
  const S = { lat: null, field: null, parcels: [], status: {}, plan: null };
  const context = {
    document, S, innerWidth: 1400, innerHeight: 900, Date,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    $: (s, el) => el ? el.querySelector(s) : node(s),
    $$: () => [], visible: true,
    stopSim() {}, cancelDraw() {}, clearAll() { S.field = null; S.parcels = []; },
    loadDemo() { loads++; }, loadData() {}, updateUI() {}, openOnboard() {},
    openPlan() { node('#planModal').classList.remove('hidden'); },
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 1, setInterval: fn => { interval = fn; },
    window: { addEventListener() {} }
  };
  ['#historyModal', '#reconModal', '#whyModal', '#planModal', '#sourcesModal'].forEach(s => node(s).classList.add('hidden'));
  vm.runInNewContext(source, context);
  const card = node('.tour-card');
  function action(value, data = {}) {
    const button = new Node(); button.dataset = { action: value, ...data };
    card.handlers.click({ target: { closest: () => button } });
  }
  function selectAlternative() {
    const button = new Node(); button.dataset.plan = 'cover';
    // Captured application clicks record selection before the application renders.
    const target = node('#rbPlans'); target.contains = () => true;
    for (const fn of listeners.get('click') || []) fn({ target: { closest: () => button }, preventDefault() {}, stopImmediatePropagation() {} });
    interval();
  }
  return { root: () => root, card, S, action, emit, tick: () => interval(), node, help: () => help, storage, loads: () => loads, selectAlternative };
}

{
  const t = setup(); assert.equal(t.root().hidden, false);
  assert.match(t.card.innerHTML, /Set up my own field/);
  t.action('close'); assert.equal(t.root().hidden, true); assert.equal(t.storage.size, 1);
  t.help().onclick(); assert.equal(t.root().hidden, false);
}
{
  const t = setup(true); assert.equal(t.root().hidden, true);
  t.help().onclick(); t.action('own'); assert.match(t.card.innerHTML, /Find your field/);
  t.S.lat = 42; t.tick(); assert.match(t.card.innerHTML, /Outline your field/);
  t.tick(); assert.match(t.card.innerHTML, /Outline your field/); // No fake drawing completion.
  t.S.field = {}; t.tick(); assert.match(t.card.innerHTML, /Create management plots/);
  t.S.parcels = [{}]; t.tick(); assert.match(t.card.innerHTML, /One field, several decisions/);
}
{
  const t = setup(); t.action('iowa'); assert.equal(t.loads(), 1);
  assert.equal(t.node('[data-action="next"]').disabled, true);
  t.S.lat = 42; t.S.field = {}; t.S.parcels = [{}]; t.S.plan = { opts: [{ key: 'cover' }] }; t.tick();
  assert.equal(t.node('[data-action="next"]').disabled, false);
  t.action('next'); t.action('next'); assert.match(t.card.innerHTML, /Confirm what you planted/);
  t.emit('demo:history-confirmed'); t.node('#reconModal').classList.remove('hidden'); t.tick();
  assert.match(t.card.innerHTML, /Confirm what you planted/); // Wait for reconstruction.
  t.node('#reconModal').classList.add('hidden'); t.tick(); assert.match(t.card.innerHTML, /What matters/);
  t.action('back'); t.tick(); assert.match(t.card.innerHTML, /Confirm what you planted/); // Back stays put.
  t.action('next'); t.action('next'); assert.match(t.card.innerHTML, /Compare an alternative/);
  const savedPlan = t.S.plan; t.S.plan = null; t.S.status.power = 'error'; t.tick();
  assert.match(t.node('#tourStatus').textContent, /Retry the sources/);
  assert.equal(t.node('[data-action="next"]').disabled, true);
  t.S.plan = savedPlan; t.S.status.power = 'ok'; t.tick();
  t.node('#planBody').getBoundingClientRect = () => ({left: 500, right: 800, top: 100, bottom: 500, width: 300, height: 400});
  t.selectAlternative(); assert.match(t.card.innerHTML, /Look behind/);
  assert.equal(t.card.style.left, '822px'); // Anchor to modal, not earlier toolbar.
  t.emit('demo:evidence-opened'); t.tick(); assert.match(t.card.innerHTML, /Look behind/); // Leave time to read.
  t.action('next'); assert.match(t.card.innerHTML, /Make the rotation/);
  t.emit('demo:crop-edited'); t.tick(); assert.match(t.card.innerHTML, /Ready to explore/);
  t.action('close'); t.help().onclick(); assert.match(t.card.innerHTML, /Resume guided tour/);
  t.action('resume'); assert.match(t.card.innerHTML, /Ready to explore/);
  t.action('next'); assert.equal(t.root().hidden, true);
  t.help().onclick(); t.action('uruguay'); assert.match(t.card.innerHTML, /Replace the current field/);
  assert.equal(t.loads(), 1); t.action('choices'); assert.equal(t.S.parcels.length, 1);
  t.action('uruguay'); t.action('replace', { kind: 'uruguay' }); assert.equal(t.loads(), 2);
}
console.log('PASS guided tour: invitation, both paths, real action gates, reconstruction, Back, resume, completion and replacement confirmation.');
