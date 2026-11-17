/**
 * Runs inside a policy frame of `canvas-viewer-csp.spec.ts` WITHOUT the
 * host's `canvas-viewer-csp-host.ts`: it listens for policy reports, then
 * imports the store (whose modules build zod object schemas while they
 * evaluate) and reports what the policy refused. The spec asserts the eval
 * report is there, so the host line it documents is shown to be needed, and
 * the main tests' "nothing refused" is shown to see such a report at all.
 * Not a spec: loaded with a `<script type="module" src>`.
 */
import type { PolicyReport } from './canvas-viewer-csp-frame';

/** Frames the page stays quiet after the import, for late reports. */
const SETTLE_FRAMES = 10;

const violations: PolicyReport[] = [];
document.addEventListener('securitypolicyviolation', event => {
  violations.push({
    directive: event.violatedDirective,
    source: event.sourceFile,
    line: event.lineNumber,
    target: String(event.blockedURI),
  });
});

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function probe() {
  try {
    await import('@labre/store');
    await Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
      previous => previous.then(nextFrame),
      Promise.resolve()
    );
    window.parent.postMessage({ type: 'probed', violations }, '*');
  } catch (error) {
    window.parent.postMessage(
      { type: 'error', message: (error as Error).message },
      '*'
    );
  }
}

void probe();
