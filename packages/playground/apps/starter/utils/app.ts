import { SelectionPaneProvider } from '@labre/affine/shared/services';
import type { Store, Workspace } from '@labre/affine/store';
import {
  defaultImageProxyMiddleware,
  docLinkBaseURLMiddlewareBuilder,
  ImageProxyService,
  embedSyncedDocMiddleware,
  titleMiddleware,
} from '@labre/affine-shared/adapters';

import { AttachmentViewerPanel } from '../../_common/components/attachment-viewer-panel';
import { CustomAdapterPanel } from '../../_common/components/custom-adapter-panel';
import { CustomFramePanel } from '../../_common/components/custom-frame-panel';
import { CustomHostSlidesPanel } from '../../_common/components/custom-host-slides-panel';
import { CustomOutlinePanel } from '../../_common/components/custom-outline-panel';
import { CustomOutlineViewer } from '../../_common/components/custom-outline-viewer';
import { DocsPanel } from '../../_common/components/docs-panel';
import { LeftSidePanel } from '../../_common/components/left-side-panel';
import { StarterDebugMenu } from '../../_common/components/starter-debug-menu';
import { CommentPanel } from '../../comment/comment-panel';
import { createTestEditor, setOutlinePanelForSeam } from './extensions';

export async function createTestApp(doc: Store, collection: Workspace) {
  const app = document.querySelector('#app');
  if (!app) {
    throw new Error('Cannot find app root element(#app).');
  }
  const editor = createTestEditor(doc, collection);

  app.append(editor);
  await editor.updateComplete;

  const debugMenu = new StarterDebugMenu();
  const docsPanel = new DocsPanel();
  const framePanel = new CustomFramePanel();
  const hostSlidesPanel = new CustomHostSlidesPanel();
  const outlinePanel = new CustomOutlinePanel();
  const adapterPanel = new CustomAdapterPanel();
  const outlineViewer = new CustomOutlineViewer();
  const leftSidePanel = new LeftSidePanel();
  const commentPanel = new CommentPanel();
  const attachmentViewerPanel = new AttachmentViewerPanel();

  docsPanel.editor = editor;
  framePanel.editor = editor;
  hostSlidesPanel.editor = editor;
  outlinePanel.editor = editor;
  setOutlinePanelForSeam(outlinePanel);
  outlineViewer.editor = editor;
  outlineViewer.toggleOutlinePanel = () => {
    outlinePanel.toggleDisplay();
  };
  adapterPanel.editor = editor;
  adapterPanel.transformerMiddlewares = [
    docLinkBaseURLMiddlewareBuilder(
      'https://example.com',
      editor.doc.workspace.id
    ).get(),
    titleMiddleware(editor.doc.workspace.meta.docMetas),
    embedSyncedDocMiddleware('content'),
    defaultImageProxyMiddleware,
  ];

  debugMenu.collection = collection;
  debugMenu.editor = editor;
  debugMenu.outlinePanel = outlinePanel;
  debugMenu.outlineViewer = outlineViewer;
  debugMenu.framePanel = framePanel;
  debugMenu.hostSlidesPanel = hostSlidesPanel;
  debugMenu.leftSidePanel = leftSidePanel;
  debugMenu.docsPanel = docsPanel;
  debugMenu.adapterPanel = adapterPanel;

  debugMenu.commentPanel = commentPanel;

  commentPanel.editor = editor;

  document.body.append(attachmentViewerPanel);
  document.body.append(outlinePanel);
  document.body.append(outlineViewer);
  document.body.append(framePanel);
  document.body.append(hostSlidesPanel);
  document.body.append(leftSidePanel);
  document.body.append(debugMenu);
  document.body.append(adapterPanel);

  window.editor = editor;
  window.doc = doc;
  Object.defineProperty(globalThis, 'host', {
    get() {
      return document.querySelector('editor-host');
    },
  });
  Object.defineProperty(globalThis, 'std', {
    get() {
      return document.querySelector('editor-host')?.std;
    },
  });
  // Host seam for remote images — `imageProxy.setImageProxyURL('')` in the
  // console to check that nothing reaches the default third-party worker.
  Object.defineProperty(globalThis, 'imageProxy', {
    get() {
      return doc.get(ImageProxyService);
    },
  });

  // `?panel=slides|frames|selection|outline` opens that panel at load (ADR 0034
  // recette). A macrotask, so it runs after the caller has applied `?mode`
  // (`mountDefaultDocEditor` does it right after this function resolves): the
  // selection pane only exists in edgeless.
  const panel = new URLSearchParams(location.search).get('panel');
  if (panel) {
    setTimeout(() => {
      editor.updateComplete
        .then(() => {
          if (panel === 'slides') hostSlidesPanel.toggleDisplay();
          if (panel === 'frames') framePanel.toggleDisplay();
          if (panel === 'outline') outlinePanel.show();
          if (panel === 'selection') {
            editor.std.getOptional(SelectionPaneProvider)?.open();
          }
        })
        .catch(console.error);
    });
  }

  return editor;
}
