/**
 * Vitest setup file for the happy-dom specs that reach DOMPurify.
 *
 * A browser has ONE `nodeName` getter, on `Node.prototype`. happy-dom defines
 * one per subclass and leaves the `Node.prototype` one answering `''`.
 * DOMPurify (>= 3.4.8) caches the `Node.prototype` getter to read names
 * clobber-safely, so under happy-dom every tag reads as `''`, is not on the
 * allow-list, and is removed — `<svg>` root included. This makes the base
 * getter answer what the subclass one would, which is what the platform does.
 * It has to run before `dompurify` is imported: the getter is cached at load.
 */
Object.defineProperty(Node.prototype, 'nodeName', {
  configurable: true,
  get(this: Node) {
    for (
      let proto = Object.getPrototypeOf(this);
      proto && proto !== Node.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      const getter = Object.getOwnPropertyDescriptor(proto, 'nodeName')?.get;
      if (getter) return getter.call(this);
    }
    return '';
  },
});
