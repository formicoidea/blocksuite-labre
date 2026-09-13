import type { BlockStdScope } from '@labre/std';
import type { ExtensionType, Schema, Workspace } from '@labre/store';

import {
  ImportDoc,
  type OnFailHandler,
  type OnSuccessHandler,
} from './import-doc.js';

export function showImportModal({
  schema,
  collection,
  extensions,
  onSuccess,
  onFail,
  container = document.body,
  abortController = new AbortController(),
  std,
}: {
  schema: Schema;
  collection: Workspace;
  extensions: ExtensionType[];
  onSuccess?: OnSuccessHandler;
  onFail?: OnFailHandler;
  multiple?: boolean;
  container?: HTMLElement;
  abortController?: AbortController;
  /** See `ImportDoc`'s own constructor param. */
  std?: BlockStdScope;
}) {
  const importDoc = new ImportDoc(
    collection,
    schema,
    extensions,
    onSuccess,
    onFail,
    abortController,
    std
  );
  container.append(importDoc);
  abortController.signal.addEventListener('abort', () => importDoc.remove());
  return importDoc;
}
