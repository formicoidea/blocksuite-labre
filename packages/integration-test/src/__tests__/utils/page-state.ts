/**
 * The suite shares one page (`isolate: false`): what a spec leaves in the
 * storages or under `document.body` is the next spec's starting state. A spec
 * whose commands write there (the usage store, `labre:command-usage`; the
 * Templates panel's remembered category) takes a snapshot first and puts the
 * page back when it is done.
 */
export function snapshotPageState() {
  const copy = (storage: Storage) =>
    new Map(
      Array.from({ length: storage.length }, (_, i) => storage.key(i)!).map(
        key => [key, storage.getItem(key)!]
      )
    );
  const local = copy(localStorage);
  const session = copy(sessionStorage);
  const children = new Set(Array.from(document.body.children));

  const restore = (storage: Storage, saved: Map<string, string>) => {
    for (const key of Array.from(
      { length: storage.length },
      (_, i) => storage.key(i)!
    )) {
      if (!saved.has(key)) storage.removeItem(key);
    }
    for (const [key, value] of saved) {
      if (storage.getItem(key) !== value) storage.setItem(key, value);
    }
  };

  return () => {
    restore(localStorage, local);
    restore(sessionStorage, session);
    for (const child of Array.from(document.body.children)) {
      if (!children.has(child)) child.remove();
    }
  };
}
