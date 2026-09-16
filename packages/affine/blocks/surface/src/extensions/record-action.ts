import { Bound } from '@labre/global/gfx';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { generateKeyBetween, GfxControllerIdentifier } from '@labre/std/gfx';

import { EdgelessCRUDIdentifier } from './crud-extension.js';

/** What {@link recordAction} saw a creation action ask the surface for. */
export interface RecordedAction {
  /**
   * One plain record per element the action added, in creation order, holding
   * the props it passed. `id` is the recording's own (`el-0`, `el-1`, …), not
   * an id any document will ever carry.
   */
  records: Record<string, unknown>[];
  /**
   * The union of the records' `xywh`, relative to the fake viewport's centre —
   * which sits at the ORIGIN, so this is the footprint the same action would
   * draw around whatever centre a real viewport has. `null` when no record
   * carries a box at all.
   */
  bound: Bound | null;
}

/** Hook applied to a finished record before it is kept. See {@link recordAction}. */
export type RecordEncoder = (record: Record<string, unknown>) => void;

export interface RecordActionOptions {
  /**
   * The editor the recording is being run FOR. Its `TranslationProvider`, and
   * nothing else from it, is handed to the action, so the seeds the action
   * writes come out in the user's language. Without one, the action writes its
   * English fallbacks.
   */
  host?: BlockStdScope;
  /**
   * Last chance to rewrite a record before it is kept — how a caller that needs
   * a SNAPSHOT converts the `Y.Text` / `Y.Map` props into their serialized
   * form. A caller that only measures the drawing passes nothing.
   */
  encode?: RecordEncoder;
}

/**
 * Run a creation action against a recording fake, and hand back what it asked
 * the surface for — so a framework's artefact can be measured, previewed or
 * serialized without ever touching a document.
 *
 * The `std` handed to `run` answers the members placement actions actually
 * touch and THROWS on anything else, so an unsupported action fails loudly
 * instead of yielding a half-empty drawing. Callers that can carry on without a
 * measure catch it; callers that cannot (a template derived at build time) let
 * it through.
 *
 * Extracted from `snapshotFromAction` (`@labre/affine-gfx-template`), which is
 * still its first caller: the placement tool needs the same recording and lives
 * in the toolbar widget, which the template package depends ON — so the
 * recording had to move down here, where both can reach it.
 */
export function recordAction(
  run: (std: BlockStdScope) => void,
  { host, encode }: RecordActionOptions = {}
): RecordedAction {
  const elements = new Map<string, Record<string, unknown>>();
  let n = 0;
  let lastIndex: string | null = null;
  const nextIndex = () => (lastIndex = generateKeyBetween(lastIndex, null));

  const addElement = (props: Record<string, unknown>) => {
    const id = `el-${n++}`;
    const record: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) record[key] = value;
    }
    record['id'] = id;

    encode?.(record);

    if (record['index'] === undefined) record['index'] = nextIndex();

    // The model members an action reads back off `getElementById`, kept
    // non-enumerable so they never leak into a snapshot built from the record.
    Object.defineProperties(record, {
      group: { value: null },
      deserializedXYWH: {
        get: () =>
          typeof record['xywh'] === 'string'
            ? Bound.deserialize(record['xywh'])
            : null,
      },
    });

    elements.set(id, record);
    return id;
  };

  const records = () => [...elements.values()];

  const surface = {
    addElement,
    getElementById: (id: string) => elements.get(id) ?? null,
    getElementsByType: (type: string) =>
      records().filter(el => el['type'] === type),
    get elementModels() {
      return records();
    },
  };

  const gfx = {
    surface,
    // The centre at the ORIGIN is what makes `bound` a footprint rather than a
    // position: an action that creates "at the viewport centre" records a box
    // around (0, 0), which is exactly the offset to re-apply around a real one.
    viewport: { centerX: 0, centerY: 0, zoom: 1, center: { x: 0, y: 0 } },
    doc: { captureSync: () => {} },
    selection: { set: () => {}, selectedElements: [] },
    tool: { setTool: () => {} },
    layer: {
      generateIndex: () => nextIndex(),
      getReorderedIndex: (_model: unknown, direction: string) => {
        const sorted = records()
          .map(el => String(el['index']))
          .sort();
        return direction === 'back'
          ? generateKeyBetween(null, sorted[0] ?? null)
          : generateKeyBetween(sorted[sorted.length - 1] ?? null, null);
      },
      get canvasElements() {
        return records();
      },
    },
    std: null as unknown as BlockStdScope,
  };

  const crud = {
    addElement: (type: string, props: Record<string, unknown>) =>
      addElement({ ...props, type }),
  };

  const std = {
    get: (identifier: { identifierName?: string }) => {
      if (identifier === (GfxControllerIdentifier as unknown)) return gfx;
      if (identifier === (EdgelessCRUDIdentifier as unknown)) return crud;
      throw new Error(
        `recordAction: unsupported service "${identifier?.identifierName ?? String(identifier)}"`
      );
    },
    getOptional: (identifier: unknown) =>
      identifier === (TranslationProvider as unknown)
        ? host?.getOptional(TranslationProvider)
        : undefined,
    command: {
      // Really run the command, so a group built by `createGroupCommand` is
      // whatever that command says a group is — no second definition here.
      exec: (
        cmd: (
          ctx: Record<string, unknown>,
          next: (r?: unknown) => void
        ) => void,
        payload: Record<string, unknown>
      ) => {
        let out: unknown;
        cmd({ std: gfx.std, ...payload }, r => {
          out = r;
        });
        return [{}, out ?? {}];
      },
    },
    store: {
      readonly: false,
      captureSync: () => {},
      id: 'doc:template',
      workspace: { meta: { getDocMeta: () => undefined } },
    },
  };

  gfx.std = std as unknown as BlockStdScope;
  run(gfx.std);

  return { records: records(), bound: uniteBounds(records()) };
}

/** The union of whatever boxes the records carry. */
function uniteBounds(records: Record<string, unknown>[]): Bound | null {
  let union: Bound | null = null;
  for (const record of records) {
    const xywh = record['xywh'];
    if (typeof xywh !== 'string') continue;
    const bound = Bound.deserialize(xywh);
    union = union ? union.unite(bound) : bound;
  }
  return union;
}
