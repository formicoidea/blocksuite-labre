import { PivotRecordPickerExtension } from '@labre/affine/blocks/surface';
import { RefNodeSlotsProvider } from '@labre/affine/inlines/reference';
import {
  CommunityCanvasTextFonts,
  DocModeProvider,
  EditorSettingExtension,
  FeatureFlagService,
  FontConfigExtension,
  NoopTelemetryExtension,
  ParseDocUrlExtension,
} from '@labre/affine/shared/services';
import type { ExtensionType, Store, Workspace } from '@labre/affine/store';
import { type TestAffineEditorContainer } from '@labre/integration-test';
import { getTestViewManager } from '@labre/integration-test/view';

import {
  mockDocModeService,
  mockEditorSetting,
  mockParseDocUrlService,
  mockPivotRecordPicker,
} from '../../_common/mock-services';

const viewManager = getTestViewManager();

export function getTestCommonExtensions(
  editor: TestAffineEditorContainer
): ExtensionType[] {
  return [
    FontConfigExtension(CommunityCanvasTextFonts),
    // Standalone host: telemetry seam wired with the event-dropping adapter.
    NoopTelemetryExtension,
    EditorSettingExtension({
      setting$: mockEditorSetting(),
    }),
    ParseDocUrlExtension(mockParseDocUrlService(editor.doc.workspace)),
    // A RECETTE MOCK-UP, and only ever that. The library registers no pivot
    // record picker — it cannot know what a record is — so without one the
    // reading panel's "Link to a record" action is hidden by design and the
    // playground had no way to exercise `pivot.bind`. This is the SaaS host's
    // record browser stood in for by a `prompt`; see `mockPivotRecordPicker`.
    PivotRecordPickerExtension(mockPivotRecordPicker()),
    {
      setup: di => {
        di.override(DocModeProvider, mockDocModeService(editor));
      },
    },
  ];
}

export function createTestEditor(store: Store, workspace: Workspace) {
  store
    .get(FeatureFlagService)
    .setFlag('enable_advanced_block_visibility', true);

  const editor = document.createElement('affine-editor-container');

  editor.autofocus = true;
  editor.doc = store;

  const defaultExtensions = getTestCommonExtensions(editor);
  editor.pageSpecs = [...viewManager.get('page'), ...defaultExtensions];
  editor.edgelessSpecs = [...viewManager.get('edgeless'), ...defaultExtensions];

  editor.std
    .get(RefNodeSlotsProvider)
    .docLinkClicked.subscribe(({ pageId: docId }) => {
      const target = workspace.getDoc(docId)?.getStore();
      if (!target) {
        throw new Error(`Failed to jump to doc ${docId}`);
      }
      target.load();
      editor.doc = target;
    });

  return editor;
}
