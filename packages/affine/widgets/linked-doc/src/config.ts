import {
  ImportIcon,
  LinkedDocIcon,
  LinkedEdgelessIcon,
  NewDocIcon,
} from '@labre/affine-components/icons';
import { toast } from '@labre/affine-components/toast';
import { StoreExtensionManagerIdentifier } from '@labre/affine-ext-loader';
import { insertLinkedNode } from '@labre/affine-inline-reference';
import {
  DocModeProvider,
  formatLocale,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import type { AffineInlineEditor } from '@labre/affine-shared/types';
import {
  createDefaultDoc,
  isFuzzyMatch,
  type Signal,
} from '@labre/affine-shared/utils';
import { IS_MOBILE } from '@labre/global/env';
import {
  type BlockStdScope,
  ConfigExtensionFactory,
  type EditorHost,
} from '@labre/std';
import type { InlineRange } from '@labre/std/inline';
import type { TemplateResult } from 'lit';

import { showImportModal } from './import-doc/index.js';
import {
  LINKED_DOC_CREATE_DOC,
  LINKED_DOC_IMPORT,
  LINKED_DOC_IMPORT_SUCCESS_TOAST,
  LINKED_DOC_LINK_TO_DOC,
  LINKED_DOC_NEW_DOC,
  LINKED_DOC_UNTITLED,
} from './translations.js';
import type { LinkedDocViewExtensionOptions } from './view';

export type LinkedWidgetConfig = Required<
  Omit<LinkedDocViewExtensionOptions, 'autoFocusedItemKey'>
> &
  Pick<LinkedDocViewExtensionOptions, 'autoFocusedItemKey'>;

export type LinkedMenuItem = {
  key: string;
  name: string | TemplateResult<1>;
  icon: TemplateResult<1>;
  suffix?: string | TemplateResult<1>;
  // disabled?: boolean;
  action: LinkedMenuAction;
};

export type LinkedMenuAction = () => Promise<void> | void;

export type LinkedMenuGroup = {
  name: string;
  items: LinkedMenuItem[] | Signal<LinkedMenuItem[]>;
  styles?: string;
  // maximum quantity displayed by default
  maxDisplay?: number;
  // if the menu is loading
  loading?: boolean | Signal<boolean>;
  // copywriting when display quantity exceeds
  overflowText?: string | Signal<string>;
  // hide the group
  hidden?: boolean | Signal<boolean>;
};

export type LinkedDocContext = {
  std: BlockStdScope;
  inlineEditor: AffineInlineEditor;
  startRange: InlineRange;
  startNativeRange: Range;
  triggerKey: string;
  config: LinkedWidgetConfig;
  close: () => void;
};

const DISPLAY_NAME_LENGTH = 8;

export function createLinkedDocMenuGroup(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: AffineInlineEditor
) {
  const doc = editorHost.store;
  const { docMetas } = doc.workspace.meta;
  const filteredDocList = docMetas
    .filter(({ id }) => id !== doc.id)
    .filter(({ title }) => isFuzzyMatch(title, query));
  const MAX_DOCS = 6;

  return {
    name: translateKey(editorHost.std, ...LINKED_DOC_LINK_TO_DOC),
    items: filteredDocList.map(doc => ({
      key: doc.id,
      name: doc.title || translateKey(editorHost.std, ...LINKED_DOC_UNTITLED),
      icon:
        editorHost.std.get(DocModeProvider).getPrimaryMode(doc.id) ===
        'edgeless'
          ? LinkedEdgelessIcon
          : LinkedDocIcon,
      action: () => {
        abort();
        insertLinkedNode({
          inlineEditor,
          docId: doc.id,
        });
        editorHost.std
          .getOptional(TelemetryProvider)
          ?.track('LinkedDocCreated', {
            control: 'linked doc',
            module: 'inline @',
            type: 'doc',
            other: 'existing doc',
          });
      },
    })),
    maxDisplay: MAX_DOCS,
    overflowText: `${new Intl.NumberFormat(formatLocale(editorHost.std)).format(filteredDocList.length - MAX_DOCS)} more docs`,
  };
}

export function createNewDocMenuGroup(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: AffineInlineEditor
): LinkedMenuGroup {
  const doc = editorHost.store;
  const docName = query || translateKey(editorHost.std, ...LINKED_DOC_UNTITLED);
  const displayDocName =
    docName.slice(0, DISPLAY_NAME_LENGTH) +
    (docName.length > DISPLAY_NAME_LENGTH ? '..' : '');

  const items: LinkedMenuItem[] = [
    {
      key: 'create',
      name: translateKey(editorHost.std, ...LINKED_DOC_CREATE_DOC, {
        name: displayDocName,
      }),
      icon: NewDocIcon,
      action: () => {
        abort();
        const docName = query;
        const newDoc = createDefaultDoc(doc.workspace, {
          title: docName,
        });
        insertLinkedNode({
          inlineEditor,
          docId: newDoc.id,
        });
        const telemetryService = editorHost.std.getOptional(TelemetryProvider);
        telemetryService?.track('LinkedDocCreated', {
          control: 'new doc',
          module: 'inline @',
          type: 'doc',
          other: 'new doc',
        });
        telemetryService?.track('DocCreated', {
          control: 'new doc',
          module: 'inline @',
          type: 'doc',
        });
      },
    },
  ];

  if (!IS_MOBILE) {
    items.push({
      key: 'import',
      name: translateKey(editorHost.std, ...LINKED_DOC_IMPORT),
      icon: ImportIcon,
      action: () => {
        abort();
        const onSuccess = (
          docIds: string[],
          options: {
            importedCount: number;
          }
        ) => {
          toast(
            editorHost,
            translateKey(editorHost.std, ...LINKED_DOC_IMPORT_SUCCESS_TOAST, {
              count: options.importedCount,
            })
          );
          for (const docId of docIds) {
            insertLinkedNode({
              inlineEditor,
              docId,
            });
          }
        };
        const onFail = (message: string) => {
          toast(editorHost, message);
        };
        const storeManager = editorHost.std.get(
          StoreExtensionManagerIdentifier
        );
        showImportModal({
          collection: doc.workspace,
          schema: doc.schema,
          extensions: storeManager.get('store'),
          onSuccess,
          onFail,
          std: editorHost.std,
        });
      },
    });
  }

  return {
    name: translateKey(editorHost.std, ...LINKED_DOC_NEW_DOC),
    items,
  };
}

export function getMenus(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: AffineInlineEditor
): Promise<LinkedMenuGroup[]> {
  return Promise.resolve([
    createLinkedDocMenuGroup(query, abort, editorHost, inlineEditor),
    createNewDocMenuGroup(query, abort, editorHost, inlineEditor),
  ]);
}

export const LinkedWidgetUtils = {
  createNewDocMenuGroup,
  insertLinkedNode,
};

export const AFFINE_LINKED_DOC_WIDGET = 'affine-linked-doc-widget';

export const LinkedWidgetConfigExtension = ConfigExtensionFactory<
  Partial<LinkedWidgetConfig>
>('affine:widget-linked-doc');
