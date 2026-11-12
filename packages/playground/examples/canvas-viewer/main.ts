/**
 * The read-only canvas viewer (ADR 0050, ADR 0051), opened from the starter's
 * debug menu ("Open in canvas viewer") on the document being edited.
 *
 * A page of its own, never the starter: importing the viewer moves the
 * library's styles to adopted sheets for the whole page, which the editor
 * beside it must not get. `strict.html` loads this same script under Labre
 * Sites' Content-Security-Policy. The opener posts the state once this page
 * says it is ready.
 */
type ViewerRequest = {
  type: 'labre:canvas-viewer';
  state: Uint8Array;
  focus?: { kind: 'frame' | 'group'; id: string };
  docTitles: Record<string, string>;
};

const violations: string[] = [];
document.addEventListener('securitypolicyviolation', event => {
  violations.push(`${event.violatedDirective} ${event.sourceFile}`);
  console.warn('[canvas viewer] refused:', event.violatedDirective, event);
});

// CSSOM only: a strict policy refuses `<style>` and `style` attributes.
const page = document.body.style;
page.margin = '0';
page.fontFamily = 'sans-serif';

const statusLine = document.createElement('p');
statusLine.textContent = 'Waiting for the starter to send its document…';
const host = document.createElement('div');
host.style.margin = '0 auto';
document.body.append(statusLine, host);

let dispose: (() => void) | null = null;

/** The policy reports arrive as the canvas paints: read them a moment later. */
const REPORT_DELAY_MS = 1500;

async function mount(request: ViewerRequest, interactive?: boolean) {
  const { mountCanvasViewer } = await import('@labre/affine/canvas-viewer');
  dispose?.();
  const frozen = request.focus && !interactive;
  // A frozen frame sits in a page column, as on a published page; the
  // interactive view takes the whole window, as the host's larger view does.
  host.style.width = frozen ? 'min(960px, 100vw)' : '100vw';
  host.style.height = frozen ? '' : 'calc(100vh - 80px)';
  const viewer = mountCanvasViewer(host, request.state, {
    focus: request.focus,
    interactive,
    docTitles: request.docTitles,
    onOpenDoc: docId => {
      statusLine.textContent = `onOpenDoc("${docId}")`;
    },
    onLinkClick: url => {
      statusLine.textContent = `onLinkClick("${url}")`;
    },
    // The host opens the larger view: the same focus, interactive.
    onExpand: () => void show(request, true),
  });
  dispose = viewer.dispose;
  const what = request.focus
    ? `${request.focus.kind} ${request.focus.id}, ${
        frozen ? 'frozen: a click, Enter or Space expands' : 'interactive'
      }`
    : 'whole canvas, interactive';
  setTimeout(() => {
    statusLine.textContent = `${what} · policy reports: ${violations.length}`;
  }, REPORT_DELAY_MS);
}

async function show(request: ViewerRequest, interactive?: boolean) {
  try {
    await mount(request, interactive);
  } catch (error) {
    statusLine.textContent = `The viewer refused this document: ${String(error)}`;
  }
}

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin) return;
  const request = event.data as ViewerRequest | null;
  if (request?.type !== 'labre:canvas-viewer') return;
  void show(request);
});

(window.opener as Window | null)?.postMessage(
  { type: 'labre:canvas-viewer-ready' },
  window.location.origin
);
