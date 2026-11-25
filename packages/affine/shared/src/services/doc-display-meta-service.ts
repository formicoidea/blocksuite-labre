import type { AliasInfo, ReferenceParams } from '@labre/affine-model';
import { type Container, createIdentifier } from '@labre/global/di';
import { type DisposableMember, disposeMember } from '@labre/global/disposable';
import {
  AliasIcon,
  BlockLinkIcon,
  DeleteIcon,
  EdgelessIcon,
  LinkedEdgelessIcon,
  LinkedPageIcon,
  PageIcon,
} from '@blocksuite/icons/lit';
import { LifeCycleWatcher, StdIdentifier } from '@labre/std';
import type { Store } from '@labre/store';
import {
  computed,
  type ReadonlySignal,
  type Signal,
  signal,
} from '@preact/signals-core';
import type { TemplateResult } from 'lit';

import { referenceToNode } from '../utils/reference.js';
import { DocModeProvider } from './doc-mode-service.js';
import {
  CHROME_DELETED_DOC,
  CHROME_UNTITLED,
} from './translation-service/chrome.js';
import { translateKey } from './translation-service/index.js';

export type DocDisplayMetaParams = {
  referenced?: boolean;
  params?: ReferenceParams;
} & AliasInfo;

/**
 * Customize document display title and icon.
 *
 * Supports the following blocks:
 *
 * * Inline View:
 *      `AffineReference`
 * * Card View:
 *      `EmbedLinkedDocBlockComponent`
 *      `EmbedEdgelessLinkedDocBlockComponent`
 * * Embed View:
 *      `EmbedSyncedDocBlockComponent`
 *      `EmbedEdgelessSyncedDocBlockComponent`
 */
export interface DocDisplayMetaExtension {
  icon: (
    docId: string,
    referenceInfo?: DocDisplayMetaParams
  ) => ReadonlySignal<TemplateResult>;
  title: (
    docId: string,
    referenceInfo?: DocDisplayMetaParams
  ) => ReadonlySignal<string>;
}

export const DocDisplayMetaProvider = createIdentifier<DocDisplayMetaExtension>(
  'DocDisplayMetaService'
);

export class DocDisplayMetaService
  extends LifeCycleWatcher
  implements DocDisplayMetaExtension
{
  static icons = {
    deleted: iconBuilder(DeleteIcon),
    aliased: iconBuilder(AliasIcon),
    page: iconBuilder(PageIcon),
    edgeless: iconBuilder(EdgelessIcon),
    linkedBlock: iconBuilder(BlockLinkIcon),
    linkedPage: iconBuilder(LinkedPageIcon),
    linkedEdgeless: iconBuilder(LinkedEdgelessIcon),
  } as const;

  static override key = 'doc-display-meta';

  readonly disposables: DisposableMember[] = [];

  /**
   * @deprecated No longer populated since ADR 0057: the service builds no
   * store, so there is nothing to key by. Read `icon(pageId)`.
   */
  readonly iconMap = new WeakMap<Store, Signal<TemplateResult>>();

  /**
   * @deprecated No longer populated since ADR 0057: the service builds no
   * store, so there is nothing to key by. Read `title(pageId)`.
   */
  readonly titleMap = new WeakMap<Store, Signal<string>>();

  /**
   * By document id (#746, ADR 0057). Keyed by the document's default store,
   * the cache built that store for every linked document it resolved, kept
   * it for the workspace's life, and built it again after a host released
   * it, only to read a title and a mode that live in the workspace meta.
   */
  private readonly _icons = new Map<string, Signal<TemplateResult>>();

  private readonly _titles = new Map<string, Signal<string>>();

  static override setup(di: Container) {
    di.addImpl(DocDisplayMetaProvider, this, [StdIdentifier]);
  }

  dispose() {
    this._icons.clear();
    this._titles.clear();
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposeMember(disposable);
      }
    }
  }

  icon(
    pageId: string,
    { params, title, referenced }: DocDisplayMetaParams = {}
  ): ReadonlySignal<TemplateResult> {
    const doc = this.std.workspace.getDoc(pageId);

    if (!doc) {
      return computed(() => DocDisplayMetaService.icons.deleted);
    }

    let icon$ = this._icons.get(pageId);

    if (!icon$) {
      icon$ = signal(
        this.std.get(DocModeProvider).getPrimaryMode(pageId) === 'edgeless'
          ? DocDisplayMetaService.icons.edgeless
          : DocDisplayMetaService.icons.page
      );

      const disposable = this.std
        .get(DocModeProvider)
        .onPrimaryModeChange(mode => {
          icon$!.value =
            mode === 'edgeless'
              ? DocDisplayMetaService.icons.edgeless
              : DocDisplayMetaService.icons.page;
        }, pageId);

      this.disposables.push(disposable);
      this._icons.set(pageId, icon$);
    }

    return computed(() => {
      if (title) {
        return DocDisplayMetaService.icons.aliased;
      }

      if (referenceToNode({ pageId, params })) {
        return DocDisplayMetaService.icons.linkedBlock;
      }

      if (referenced) {
        const mode =
          params?.mode ??
          this.std.get(DocModeProvider).getPrimaryMode(pageId) ??
          'page';
        return mode === 'edgeless'
          ? DocDisplayMetaService.icons.linkedEdgeless
          : DocDisplayMetaService.icons.linkedPage;
      }

      return icon$.value;
    });
  }

  title(
    pageId: string,
    { title }: DocDisplayMetaParams = {}
  ): ReadonlySignal<string> {
    const doc = this.std.workspace.getDoc(pageId);

    if (!doc) {
      return computed(
        () => title || translateKey(this.std, ...CHROME_DELETED_DOC)
      );
    }

    let title$ = this._titles.get(pageId);
    if (!title$) {
      title$ = signal(
        doc.meta?.title || translateKey(this.std, ...CHROME_UNTITLED)
      );

      const disposable = this.std.workspace.slots.docListUpdated.subscribe(
        () => {
          title$!.value =
            doc.meta?.title || translateKey(this.std, ...CHROME_UNTITLED);
        }
      );

      this.disposables.push(disposable);
      this._titles.set(pageId, title$);
    }

    return computed(() => {
      return title || title$.value;
    });
  }

  override unmounted() {
    this.dispose();
  }
}

function iconBuilder(
  icon: typeof PageIcon,
  size = '1.25em',
  style = 'user-select:none;flex-shrink:0;vertical-align:middle;font-size:inherit;'
) {
  return icon({ width: size, height: size, style });
}
