/**
 * `doc.copyLink` — the command that finally consumes `GenerateDocUrlProvider`.
 *
 * WHAT THIS WOULD HAVE CAUGHT, and why each half is here:
 *
 * - **A silent no-op host-side.** The seam is optional, so the naive shape is
 *   "read it, return if absent" — which gives a palette entry and a chord that
 *   do nothing at all, forever, in any deployment that forgot to register the
 *   extension. The contract asserted here is that the command reports itself
 *   UNAVAILABLE instead (`when`), AND that `run` re-guards, because
 *   `runCommand` consults neither `availability` nor `when` (the palette and
 *   the agent reach `run` directly).
 * - **An anchor nothing can read back.** `extractSearchParams`
 *   (`adapters/middlewares/paste.ts`) only looks at `blockIds` / `elementIds`
 *   once it has found a valid `mode` in the query string. An anchor emitted
 *   without a `mode` therefore round-trips as a bare document link, silently.
 * - **Two events for one gesture.** The command self-emits `CopiedLink`, so it
 *   must never also declare `CommandDescriptor.telemetry` — that would report
 *   the same copy twice through `runCommand`'s bottleneck.
 */
import { DocModes } from '@labre/affine-model';
import {
  DocModeProvider,
  GenerateDocUrlProvider,
  NotificationProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import {
  BlockSelection,
  SurfaceSelection,
  runCommand,
  type BlockStdScope,
  type CommandInvocation,
} from '@labre/std';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { copyLinkCommands } from '../commands/copy-link-commands.js';

const command = copyLinkCommands.find(c => c.id === 'doc.copyLink')!;

const fromShortcut: CommandInvocation = {
  surface: 'shortcut',
  source: 'shortcut',
};

const DOC_ID = 'doc:home';

interface Harness {
  std: BlockStdScope;
  /** Every `generateDocUrl` call, so the params can be asserted directly. */
  generated: { docId: string; params?: Record<string, unknown> }[];
  toasts: string[];
  events: { event: string; payload: Record<string, unknown> }[];
  written: string[];
}

interface Options {
  /** `false` registers no `GenerateDocUrlProvider` — the degraded host. */
  urls?: boolean;
  /** `null` registers no `DocModeProvider` — the host that owns mode itself. */
  mode?: 'page' | 'edgeless' | null;
  blockIds?: string[];
  elementIds?: string[];
  /** A host that declines to route this document (unsaved, not its own). */
  declines?: boolean;
  /**
   * `false` stands the page up OUTSIDE a secure context, where the Clipboard
   * API is not "refusing" but absent: `navigator.clipboard` is `undefined`.
   */
  clipboard?: boolean;
}

function setup({
  urls = true,
  mode = 'page',
  blockIds = [],
  elementIds = [],
  declines = false,
  clipboard = true,
}: Options = {}): Harness {
  const generated: Harness['generated'] = [];
  const toasts: string[] = [];
  const events: Harness['events'] = [];
  const written: string[] = [];

  // A whole `navigator`, and `clipboard` either present or genuinely absent —
  // `undefined`, not a stub that throws — because that IS the shape a browser
  // outside a secure context serves.
  vi.stubGlobal('navigator', {
    clipboard: clipboard
      ? {
          writeText: (text: string) => {
            written.push(text);
            return Promise.resolve();
          },
        }
      : undefined,
  });

  const std = {
    store: { id: DOC_ID },
    selection: {
      filter: (type: unknown) => {
        if (type === SurfaceSelection) {
          return elementIds.length
            ? [{ blockId: 'surface', elements: elementIds, editing: false }]
            : [];
        }
        if (type === BlockSelection) {
          return blockIds.map(blockId => ({ blockId }));
        }
        return [];
      },
    },
    getOptional: (identifier: unknown) => {
      if (identifier === GenerateDocUrlProvider) {
        if (!urls) return undefined;
        return {
          generateDocUrl: (docId: string, params?: Record<string, unknown>) => {
            generated.push({ docId, params });
            if (declines) return undefined;
            const url = new URL(`https://labre.cc/doc/${docId}`);
            for (const [key, value] of Object.entries(params ?? {})) {
              url.searchParams.set(
                key,
                Array.isArray(value) ? value.join(',') : String(value)
              );
            }
            return url.toString();
          },
        };
      }
      if (identifier === DocModeProvider) {
        return mode === null ? undefined : { getEditorMode: () => mode };
      }
      if (identifier === NotificationProvider) {
        return { toast: (message: string) => toasts.push(message) };
      }
      if (identifier === TelemetryProvider) {
        return {
          track: (event: string, payload: Record<string, unknown>) =>
            events.push({ event, payload }),
        };
      }
      return undefined;
    },
  } as unknown as BlockStdScope;

  return { std, generated, toasts, events, written };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('the descriptor', () => {
  test('is a core, global-scope action bound to Mod-Alt-l', () => {
    expect(command).toBeTruthy();
    expect(command.owner).toBe('core');
    expect(command.kind).toBe('action');
    // `global`, not `page` / `edgeless`: the chord has to fire with the focus
    // in a page editor AND on the canvas.
    expect(command.scope).toBe('global');
    // `Mod-l` is the browser's address bar and never reaches the page, so the
    // shipped default is `Mod-Alt-l` (product decision, PR #401).
    expect(command.defaultKeys).toEqual({
      mac: ['Mod-Alt-l'],
      other: ['Mod-Alt-l'],
    });
    expect(command.surfaces).toEqual(['palette', 'agent']);
    expect(command.labelKey).toBe('com.labre.command.doc.copy-link');
    expect(command.labelFallback).toBe('Copy document link');
  });

  test('declares no telemetry, because it emits its own', () => {
    // The double-report this pins: a `telemetry` field routes `runCommand`'s
    // bottleneck AND the body would still emit, so one copy would count twice.
    expect(command.telemetry).toBeUndefined();
  });

  test('copying an address is allowed in a read-only document', () => {
    // Deliberately NOT `'editable'`: nothing is written to the store.
    expect(command.availability).toBe('always');
  });
});

describe('without a GenerateDocUrlProvider', () => {
  test('the command is unavailable rather than silently inert', () => {
    const { std } = setup({ urls: false });
    expect(command.when?.(std)).toBe(false);
  });

  test('`run` re-guards, because runCommand consults neither gate', () => {
    const { std, written, toasts, events } = setup({ urls: false });
    runCommand(std, command, fromShortcut);
    expect(written).toEqual([]);
    expect(toasts).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('with the seam registered', () => {
  test('the command is available', () => {
    const { std } = setup();
    expect(command.when?.(std)).toBe(true);
  });

  test('nothing selected copies the document itself', () => {
    const { std, generated, written } = setup();
    runCommand(std, command, fromShortcut);

    expect(generated).toEqual([{ docId: DOC_ID, params: { mode: 'page' } }]);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain(DOC_ID);
    expect(written[0]).not.toContain('blockIds');
  });

  test('selected blocks anchor the link on blockIds', () => {
    const { std, generated, written } = setup({ blockIds: ['b1', 'b2'] });
    runCommand(std, command, fromShortcut);

    expect(generated[0].params).toEqual({
      mode: 'page',
      blockIds: ['b1', 'b2'],
    });
    // `mode` rides along on purpose: `extractSearchParams` drops `blockIds`
    // when it cannot find one, so a link without it opens the document only.
    expect(written[0]).toContain('mode=page');
    expect(written[0]).toContain('blockIds=b1%2Cb2');
  });

  test('selected canvas elements anchor it on elementIds, and win over blocks', () => {
    // Both selections coexist in the store — selecting a note on the canvas
    // leaves the page's own selection behind — and on the canvas the ELEMENT
    // is what the user pointed at.
    const { std, generated } = setup({
      mode: 'edgeless',
      blockIds: ['b1'],
      elementIds: ['e1'],
    });
    runCommand(std, command, fromShortcut);

    expect(generated[0].params).toEqual({
      mode: 'edgeless',
      elementIds: ['e1'],
    });
  });

  test('every anchored mode is one `extractSearchParams` accepts', () => {
    for (const mode of DocModes) {
      const { std, generated } = setup({ mode, blockIds: ['b1'] });
      runCommand(std, command, fromShortcut);
      expect(DocModes).toContain(generated[0].params?.mode);
    }
  });

  test('no DocModeProvider drops the anchor rather than writing an unreadable one', () => {
    const { std, generated, written } = setup({
      mode: null,
      blockIds: ['b1'],
    });
    runCommand(std, command, fromShortcut);

    expect(generated).toEqual([{ docId: DOC_ID, params: undefined }]);
    // The link still opens the document — the honest degradation.
    expect(written).toHaveLength(1);
    expect(written[0]).not.toContain('blockIds');
  });

  test('the toast reads English when the host registered no catalogue', () => {
    const { std, toasts } = setup();
    runCommand(std, command, fromShortcut);
    expect(toasts).toEqual(['Link copied']);
  });

  test('telemetry is emitted exactly once per runCommand', () => {
    const { std, events } = setup({ elementIds: ['e1'], mode: 'edgeless' });
    runCommand(std, command, fromShortcut);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('CopiedLink');
    expect(events[0].payload).toMatchObject({
      page: 'whiteboard editor',
      module: 'shortcut',
      control: 'shortcut',
      type: 'element',
      result: 'success',
    });

    runCommand(std, command, fromShortcut);
    expect(events).toHaveLength(2);
  });

  test('the anchor kind is reported, so the three sites stay one series', () => {
    const kind = (options: Options) => {
      const { std, events } = setup(options);
      runCommand(std, command, fromShortcut);
      return events[0].payload.type;
    };
    expect(kind({})).toBe('document');
    expect(kind({ blockIds: ['b1'] })).toBe('block');
    expect(kind({ elementIds: ['e1'] })).toBe('element');
  });

  test('no clipboard API: nothing thrown, nothing copied, nothing announced', () => {
    // Over plain `http://` (anything but localhost) and in a cross-origin
    // iframe without `clipboard-write`, `navigator.clipboard` is `undefined` —
    // so `writeText` is a SYNCHRONOUS TypeError out of `run`, which
    // `runCommand` cannot catch (it only handles a returned promise). The
    // keystroke would die with it, and a toast claiming a copy that never
    // happened is worse than no toast at all.
    const { std, written, toasts, events } = setup({ clipboard: false });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => runCommand(std, command, fromShortcut)).not.toThrow();
    expect(written).toEqual([]);
    expect(toasts).toEqual([]);
    expect(events).toEqual([]);
    // Silent on screen, never silent in the console: this is a deployment
    // mistake (serving the editor over http), and it has to be diagnosable.
    expect(logged).toHaveBeenCalledOnce();
    expect(String(logged.mock.calls[0][0])).toContain('secure context');
    logged.mockRestore();
  });

  test('a host that declines to route the document announces nothing', () => {
    const { std, written, toasts, events } = setup({ declines: true });
    runCommand(std, command, fromShortcut);

    expect(written).toEqual([]);
    expect(toasts).toEqual([]);
    expect(events).toEqual([]);
  });
});
