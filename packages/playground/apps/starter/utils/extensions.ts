import { PivotRecordPickerExtension } from '@labre/affine/blocks/surface';
import { ViewExtensionManager } from '@labre/affine/ext-loader';
import { getInternalViewExtensions } from '@labre/affine/extensions/view';
import { RefNodeSlotsProvider } from '@labre/affine/inlines/reference';
import {
  CommunityCanvasTextFonts,
  DocModeProvider,
  EditorSettingExtension,
  FeatureFlagService,
  fillPlaceholders,
  FontConfigExtension,
  GenerateDocUrlExtension,
  NotificationExtension,
  ParseDocUrlExtension,
  TelemetryExtension,
  type TranslationParams,
  TranslationExtension,
} from '@labre/affine/shared/services';
import type { ExtensionType, Store, Workspace } from '@labre/affine/store';
import { getTranslationKeyManifest } from '@labre/affine/translations';
import { type TestAffineEditorContainer } from '@labre/integration-test';
import { getTestViewManager } from '@labre/integration-test/view';

import {
  mockDocModeService,
  mockEditorSetting,
  mockGenerateDocUrlService,
  mockNotificationService,
  mockParseDocUrlService,
  mockPivotRecordPicker,
} from '../../_common/mock-services';

const viewManager = getTestViewManager();

/**
 * The pseudo-locale recette tool (see `window.applyPseudoLocale` below): every
 * key the manifest lists resolves to its own fallback bracketed
 * (`⟦Copied to clipboard⟧`), so a KNOWN key always reads translated. A key
 * `translateKey` never reaches, or a static config wording never wired to a
 * `…Wording` sibling field, keeps showing PLAIN English — that gap IS the
 * point: it is a hole in the seam, visible without a real catalogue.
 */
const translationManifestByKey = new Map(
  getTranslationKeyManifest().map(entry => [entry.key, entry] as const)
);

function pseudoTranslate(
  key: string,
  params?: TranslationParams
): string | undefined {
  const fallback = translationManifestByKey.get(key)?.fallback;
  return fallback === undefined
    ? undefined
    : fillPlaceholders(`⟦${fallback}⟧`, params);
}

export function getTestCommonExtensions(
  editor: TestAffineEditorContainer
): ExtensionType[] {
  return [
    FontConfigExtension(CommunityCanvasTextFonts),
    // Standalone host, recette flavour: instead of the event-dropping
    // `NoopTelemetryExtension`, the playground prints what the bus carries so
    // an event can be checked in the console (`[telemetry] DocumentDamaged …`).
    TelemetryExtension({
      track: (event, props) => console.info('[telemetry]', event, props),
    }),
    EditorSettingExtension({
      setting$: mockEditorSetting(),
    }),
    ParseDocUrlExtension(mockParseDocUrlService(editor.doc.workspace)),
    // The other half of the same seam, and the reason it is here: the library
    // ships ONE consumer of `GenerateDocUrlProvider` — the `doc.copyLink`
    // command (`Ctrl/Cmd+Alt+L`) — and that command reports itself
    // UNAVAILABLE without it, so the playground could not exercise it at all
    // while this mock stayed unwired. Its URL shape is the mirror of
    // `mockParseDocUrlService`'s (the doc id in the hash), which is what makes
    // the copy → paste → inline reference round trip testable here.
    GenerateDocUrlExtension(mockGenerateDocUrlService(editor.doc.workspace)),
    // Same story: the toasts the library emits through `NotificationProvider`
    // were dropped on the floor in the playground because nothing registered
    // one. `doc.copyLink` announces itself through it, so a silent seam would
    // have made the recette "did the shortcut fire?" unanswerable.
    NotificationExtension(mockNotificationService(editor)),
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

  // The two recette hooks below compose: each remount rebuilds edgelessSpecs
  // from the CURRENT flags and the CURRENT pseudo-locale extensions, so
  // calling one never undoes what the other last set, in either order.
  let currentFlags: Parameters<typeof getInternalViewExtensions>[0] = {};
  let pseudoLocaleExtensions: ExtensionType[] = [];

  const remountEdgeless = () => {
    const views = new ViewExtensionManager(
      getInternalViewExtensions(currentFlags)
    );
    editor.edgelessSpecs = [
      ...views.get('edgeless'),
      ...defaultExtensions,
      ...pseudoLocaleExtensions,
    ];
  };

  // Recette hook: `applyFlags({ wardley: false })` in the console re-mounts the
  // edgeless std with another flag set WITHOUT a reload — what the SaaS host
  // does when a framework is switched off in its settings (#244).
  window.applyFlags = flags => {
    currentFlags = flags;
    remountEdgeless();
  };

  // Recette hook: `applyPseudoLocale()` (or `applyPseudoLocale(false)` to turn
  // it off) re-mounts BOTH page and edgeless specs with a
  // `TranslationExtension` whose catalogue is `pseudoTranslate` above, and
  // `language: 'fr-FR'` so `Intl` formatting (dates, numbers) reads visibly
  // French too. Every string left on screen with no `⟦ ⟧` around it is a key
  // the seam never reached — the whole point of the tool.
  window.applyPseudoLocale = (on = true) => {
    pseudoLocaleExtensions = on
      ? [TranslationExtension({ t: pseudoTranslate, language: 'fr-FR' })]
      : [];
    editor.pageSpecs = [
      ...viewManager.get('page'),
      ...defaultExtensions,
      ...pseudoLocaleExtensions,
    ];
    remountEdgeless();
  };

  // `?pseudo` in the URL starts the editor pseudo-localised — no console step.
  if (new URLSearchParams(location.search).has('pseudo')) {
    window.applyPseudoLocale();
  }

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
