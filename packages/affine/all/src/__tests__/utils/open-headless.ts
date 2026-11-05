import { WorkspaceImpl } from '@labre/store';
import * as Y from 'yjs';

import { testStoreExtensions } from './store';

/**
 * Opens a stored Y.Doc state the way a server does, with no browser: the public
 * `WorkspaceImpl`, the store extensions, `Y.applyUpdate`, `store.load()`. Not
 * `TestWorkspace`, which no host may use (ADR 0004).
 */
export function openHeadless(state: Uint8Array | null, workspaceId = 'ws-1') {
  const workspace = new WorkspaceImpl({ id: workspaceId });
  workspace.storeExtensions = testStoreExtensions;
  workspace.meta.initialize();
  const page = workspace.createDoc('page');
  if (state) Y.applyUpdate(page.spaceDoc, state);
  const store = page.getStore({ id: 'page' });
  store.load();
  return { doc: page.spaceDoc, store, workspace };
}
