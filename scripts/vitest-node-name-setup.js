/**
 * Makes happy-dom's `Node.prototype.nodeName` answer the node's real name, the
 * way a browser's does.
 *
 * The DOM spec declares `nodeName` ONCE, on `Node`, and computes it from the
 * node's type — so in a browser (and in the integration suite's Chromium)
 * `Object.getOwnPropertyDescriptor(Element.prototype, 'nodeName')` is
 * `undefined` and the single accessor on `Node.prototype` answers `'DIV'`,
 * `'#text'`, `'svg'`… happy-dom instead declares a base getter on
 * `Node.prototype` that returns `''` and SHADOWS it on `Element`, `Text`,
 * `Document` and the rest. Read through the instance the answer is right; read
 * through `Node.prototype` it is empty for every node.
 *
 * DOMPurify reads it through `Node.prototype` on purpose: since 3.4.8 it takes
 * the accessor off `Node.prototype` once and unapplies it on each node, so that
 * a document which CLOBBERS `nodeName` (an `<img name="nodeName">` and the
 * like) cannot talk the sanitizer into the wrong allow-list decision. Under
 * happy-dom every tag then reads as `''`, matches nothing in the SVG profile,
 * and the sanitizer empties the document — `<svg>` root included.
 *
 * So this repoints the base accessor at the most derived declaration, which is
 * the one behaviour the spec has and happy-dom's subclasses already implement.
 * It hardens nothing and relaxes nothing: it only lets the sanitizer see the
 * tag names it is about to judge.
 */
const dispatchNodeName = () => {
  if (typeof Node === 'undefined') return;

  const base = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeName');
  if (!base?.get) return;

  Object.defineProperty(Node.prototype, 'nodeName', {
    configurable: true,
    get() {
      let proto = Object.getPrototypeOf(this);
      while (proto && proto !== Node.prototype) {
        const derived = Object.getOwnPropertyDescriptor(proto, 'nodeName');
        if (derived?.get) return derived.get.call(this);
        proto = Object.getPrototypeOf(proto);
      }
      return base.get.call(this);
    },
  });
};

dispatchNodeName();
