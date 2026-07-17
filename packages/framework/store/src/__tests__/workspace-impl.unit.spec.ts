import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

// Import from the PUBLIC main entry — this is exactly how the host app
// (labreapp) consumes it. If WorkspaceImpl ever stops being exported from
// the package root, this import fails and the test breaks.
import { WorkspaceImpl } from '../index.js';
import { TestWorkspace } from '../test/index.js';

describe('WorkspaceImpl (public production workspace)', () => {
  it('is a distinct class from the test-only TestWorkspace', () => {
    expect(WorkspaceImpl).not.toBe(TestWorkspace);
    expect(new WorkspaceImpl({ id: 'x' })).not.toBeInstanceOf(TestWorkspace);
    expect(new TestWorkspace({ id: 'x' })).not.toBeInstanceOf(WorkspaceImpl);
  });

  it('exposes exactly the surface the host consumes off TestWorkspace', () => {
    const ws = new WorkspaceImpl({ id: 'labre' });

    // root Y.Doc, created by the workspace, that the host wires sync onto
    expect(ws.doc).toBeInstanceOf(Y.Doc);
    expect(ws.id).toBe('labre');

    // meta: deferred initialize() + docMetas corpus
    expect(typeof ws.meta.initialize).toBe('function');
    ws.meta.initialize();
    expect(ws.meta.docMetas).toEqual([]);

    // storeExtensions setter + start()
    ws.storeExtensions = [];
    expect(() => ws.start()).not.toThrow();

    // createDoc → getDoc → getStore() → store.load()
    const created = ws.createDoc('doc-0');
    expect(ws.getDoc('doc-0')).toBe(created);
    const store = created.getStore();
    expect(() => store.load()).not.toThrow();
  });

  it('defaults to an inert in-memory workspace (host persists on the Y.Doc)', () => {
    // No sources passed: construction succeeds and the root doc is usable
    // without any external sync wired — the host attaches persistence to
    // ws.doc itself.
    const ws = new WorkspaceImpl();
    expect(ws.doc).toBeInstanceOf(Y.Doc);
    ws.dispose();
  });
});
