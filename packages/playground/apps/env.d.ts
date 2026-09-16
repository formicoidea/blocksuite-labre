import type { EditorHost } from '@labre/affine/block-std';
import type { TestAffineEditorContainer } from '@labre/integration-test';
import type {
  BlockSchema,
  Blocks,
  Workspace,
  Transformer,
} from '@labre/affine/store';
import type { z } from 'zod';
import type * as Y from 'yjs';

declare global {
  type HTMLTemplate = [
    string,
    Record<string, unknown>,
    ...(HTMLTemplate | string)[],
  ];

  interface Window {
    editor: TestAffineEditorContainer;
    /** Re-mount the edgeless std with another flag set, no reload (#244). */
    applyFlags: (flags: import('@labre/affine/flags').BlockFlags) => void;
    /**
     * Recette tool: re-mount page and edgeless with a pseudo-locale
     * `TranslationExtension` (default `on = true`; pass `false` to turn it
     * off) — every known key reads `⟦bracketed⟧`, so any string left in
     * plain English is a hole in the i18n seam.
     */
    applyPseudoLocale: (on?: boolean) => void;
    doc: Blocks;
    collection: Workspace;
    blockSchemas: z.infer<typeof BlockSchema>[];
    job: Transformer;
    Y: typeof Y;
    std: typeof std;
    host: EditorHost;
    testWorker: Worker;

    wsProvider: ReturnType<typeof setupBroadcastProvider>;
    bcProvider: ReturnType<typeof setupBroadcastProvider>;
  }
}
