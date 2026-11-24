import type { DataSourceBase } from '@labre/affine-database-engine';
import {
  CHROME_DELETED_DOC,
  CHROME_UNTITLED,
  translateKey,
} from '@labre/affine-shared/services';
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import type { BlockStdScope } from '@labre/std';
import { type DeltaOperation, Text, type Workspace } from '@labre/store';
import { type Signal, signal } from '@preact/signals-core';

import { EditorHostKey } from '../context/host-context.js';

export const getSingleDocIdFromText = (text?: Text) => {
  const deltas = text?.deltas$.value;
  if (!deltas) return;
  let linkedDocId: string | undefined = undefined;
  for (const delta of deltas) {
    if (isLinkedDoc(delta)) {
      if (linkedDocId) {
        return;
      }
      linkedDocId = delta.attributes?.reference?.pageId as string;
    } else if (delta.insert) {
      return;
    }
  }
  return linkedDocId;
};

export const isLinkedDoc = (delta: DeltaOperation) => {
  const attributes: AffineTextAttributes | undefined = delta.attributes;
  return attributes?.reference?.type === 'LinkedPage';
};

export const isPureText = (text?: Text): boolean => {
  const deltas = text?.deltas$.value;
  if (!deltas) return true;
  return deltas.every(v => !isLinkedDoc(v));
};

type LinkedReference = NonNullable<AffineTextAttributes['reference']>;

const docListRevisions = new WeakMap<Workspace, Signal<number>>();

/**
 * A revision of `workspace`'s doc list, bumped on every doc-meta change (a
 * rename, a doc added or removed, local or from a peer): the
 * `docListUpdated` slot `DocDisplayMetaService` listens to. The workspace
 * meta has no signal of its own; read inside a `computed`, this one makes
 * the meta read below follow it.
 * ponytail: one subscription per workspace, never unsubscribed. It sits on
 * the workspace's own Subject, so it goes when the workspace goes. Give it
 * an owner if a workspace ever outlives many editors.
 */
function docListRevision(workspace: Workspace) {
  let revision = docListRevisions.get(workspace);
  if (!revision) {
    const created = signal(0);
    workspace.slots.docListUpdated.subscribe(() => {
      created.value = created.peek() + 1;
    });
    docListRevisions.set(workspace, created);
    revision = created;
  }
  return revision.value;
}

/**
 * The title the editor paints for a linked-doc reference, the string
 * `DocDisplayMetaService.title` gives: the alias, else the doc's title, else
 * the provider's own "Untitled" / "Deleted page" wordings. Read from the
 * workspace meta, never through the service: its `title()` builds the
 * linked doc's store (`doc.getStore()`), a store per distinct linked doc,
 * never released while the workspace lives (ADR 0057).
 * ponytail: a host that overrides `DocDisplayMetaProvider`'s titles is not
 * consulted here; give the seam a store-free title read if one ever does.
 */
function linkedDocTitle(std: BlockStdScope, reference: LinkedReference) {
  if (reference.title) return reference.title;
  const { workspace } = std;
  docListRevision(workspace);
  const doc = workspace.getDoc(reference.pageId);
  if (!doc) return translateKey(std, ...CHROME_DELETED_DOC);
  return doc.meta?.title || translateKey(std, ...CHROME_UNTITLED);
}

/**
 * A text cell's string as the editor paints it (#742, upstream
 * toeverything/AFFiNE#15865): a linked-doc reference is stored as one
 * placeholder character and painted as the doc's title, or the alias the
 * reference carries, so the view search, the copy and the export read that
 * title instead of the placeholder.
 *
 * A rename of the linked doc (local or from a peer) is followed wherever the
 * string is read inside a `computed`: `stringValue$`, `jsonValue$`, the view
 * search's `rows$`. A one-off read (an adapter) gets the title of the moment.
 *
 * Degraded path: without an editor host (a data source built outside an
 * editor) the raw text, placeholder included, as before.
 *
 * Cost: a text without any reference never touches the host. A reference
 * costs a lookup in the workspace's docs and its meta list; no store is
 * created and no doc is loaded. The view search recomputes every text cell
 * per keystroke (`cellGetOrCreate` builds a new cell each time), so this
 * runs once per reference per keystroke.
 */
export const getTextWithResolvedReferences = (
  value: Text | Text['yText'] | string | undefined,
  dataSource?: Pick<DataSourceBase, 'serviceGet'>
): string => {
  if (!value) return '';
  // A cell stored as a plain string (`storedShapeIsReadable`) is its own
  // text: it has no deltas to walk.
  if (typeof value === 'string') return value;
  const deltas: DeltaOperation[] =
    value instanceof Text ? value.deltas$.value : value.toDelta();
  if (!deltas.some(isLinkedDoc)) return value.toString();
  const host = dataSource?.serviceGet(EditorHostKey);
  if (!host) return value.toString();
  const { std } = host;
  return deltas
    .map(delta => {
      const reference: AffineTextAttributes['reference'] =
        delta.attributes?.reference;
      if (reference?.type !== 'LinkedPage') return delta.insert ?? '';
      return linkedDocTitle(std, reference);
    })
    .join('');
};
