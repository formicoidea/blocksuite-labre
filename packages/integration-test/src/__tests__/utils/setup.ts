import '@toeverything/theme/style.css';
import '@toeverything/theme/fonts.css';

import { ViewExtensionManager } from '@labre/affine/ext-loader';
import { getInternalViewExtensions } from '@labre/affine/extensions/view';
import type { BlockFlags } from '@labre/affine/flags';
import type { DocMode } from '@labre/affine/model';
import { AffineSchemas } from '@labre/affine/schemas';
import {
  CommunityCanvasTextFonts,
  DocModeExtension,
  FeatureFlagService,
  FontConfigExtension,
} from '@labre/affine/shared/services';
import {
  type ViewportTurboRendererExtension,
  ViewportTurboRendererIdentifier,
} from '@labre/affine-gfx-turbo-renderer';
import type { ExtensionType, Store, Transformer } from '@labre/store';
import { Schema, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { Subscription } from 'rxjs';

import { effects } from '../../effects.js';
import { TestAffineEditorContainer } from '../../index.js';
import { getTestStoreManager } from '../../store.js';
import { getTestViewManager } from '../../view.js';

const storeManager = getTestStoreManager();
const viewManager = getTestViewManager();
effects();

const storeExtensions = storeManager.get('store');

export function getRenderer() {
  return editor.std.get(
    ViewportTurboRendererIdentifier
  ) as ViewportTurboRendererExtension;
}

function createCollectionOptions() {
  const schema = new Schema();
  const room = Math.random().toString(16).slice(2, 8);

  schema.register(AffineSchemas);

  const idGenerator = createAutoIncrementIdGenerator();

  return {
    id: room,
    schema,
    idGenerator,
  };
}

function initCollection(collection: TestWorkspace) {
  const doc = collection.createDoc('doc:home').getStore();

  doc.load(() => {
    const rootId = doc.addBlock('affine:page', {
      title: new Text(),
    });
    doc.addBlock('affine:surface', {}, rootId);
  });
  doc.resetHistory();
}

async function createEditor(
  collection: TestWorkspace,
  mode: DocMode = 'page',
  extensions: ExtensionType[] = [],
  flags?: BlockFlags
) {
  // A spec asking for flags gets its own manager; everybody else keeps sharing
  // the module-level one, so the default path is byte-for-byte what it was.
  const views = flags
    ? new ViewExtensionManager(getInternalViewExtensions(flags))
    : viewManager;
  const app = document.createElement('div');
  const blockCollection = collection.docs.values().next().value;
  if (!blockCollection) {
    throw new Error('Need to create a doc first');
  }
  const doc = blockCollection.getStore();
  const editor = new TestAffineEditorContainer();
  editor.doc = doc;
  editor.mode = mode;
  // The stock `DocModeService.getEditorMode()` answers `null`, which
  // `ToolbarContext` reads as `page` — so element toolbars never rendered for
  // a surface selection in any integration test. Answer with whatever the
  // container actually mounted (live: some specs flip `editor.mode` mid-test).
  const docMode = DocModeExtension({
    getEditorMode: () => editor.mode,
    setEditorMode: newMode => editor.switchEditor(newMode),
    getPrimaryMode: () => editor.mode,
    setPrimaryMode: () => {},
    togglePrimaryMode: () => editor.mode,
    onPrimaryModeChange: () => new Subscription(),
  });
  editor.pageSpecs = [
    ...views.get('page'),
    FontConfigExtension(CommunityCanvasTextFonts),
    docMode,
    ...extensions,
  ];
  editor.edgelessSpecs = [
    ...views.get('edgeless'),
    FontConfigExtension(CommunityCanvasTextFonts),
    docMode,
    ...extensions,
  ];
  app.append(editor);

  window.editor = editor;
  window.doc = doc;

  app.style.width = '100%';
  app.style.height = '1280px';
  app.style.overflowY = 'auto';

  document.body.append(app);
  await editor.updateComplete;
  return app;
}

export function createPainterWorker() {
  const worker = new Worker(
    new URL('./turbo-painter.worker.ts', import.meta.url),
    {
      type: 'module',
    }
  );
  return worker;
}

type SetupEditorOptions = {
  extensions?: ExtensionType[];
  enableDomRenderer?: boolean;
  /**
   * Tooling flags, so a spec can mount an editor with a framework switched OFF
   * and exercise the real gated view layer rather than simulating the effect.
   * Omitted (the default for every other spec) reuses the shared manager, with
   * everything enabled.
   */
  flags?: BlockFlags;
};

export async function setupEditor(
  mode: DocMode = 'page',
  extensionsInput?: ExtensionType[],
  optionsInput?: SetupEditorOptions
) {
  const extensions: ExtensionType[] = extensionsInput ?? [];
  const options: SetupEditorOptions = optionsInput ?? {};
  const enableDomRenderer = options?.enableDomRenderer ?? false;

  const collection = new TestWorkspace(createCollectionOptions());
  collection.storeExtensions = storeExtensions;
  collection.meta.initialize();

  window.collection = collection;

  initCollection(collection);

  if (enableDomRenderer) {
    const docStore = window.collection.docs.get('doc:home')?.getStore();
    const featureFlagService = docStore?.get(FeatureFlagService);
    featureFlagService?.setFlag('enable_dom_renderer', true);
  }

  const appElement = await createEditor(
    collection,
    mode,
    extensions,
    options.flags
  );

  return () => {
    appElement?.remove();
    cleanup();
  };
}

export function cleanup() {
  window.editor?.remove();

  delete (window as any).collection;

  delete (window as any).editor;

  delete (window as any).store;
}

declare global {
  const editor: TestAffineEditorContainer;
  const doc: Store;
  const collection: TestWorkspace;
  const job: Transformer;
  interface Window {
    editor: TestAffineEditorContainer;
    doc: Store;
    job: Transformer;
    collection: TestWorkspace;
    renderer: ViewportTurboRendererExtension;
  }
}
