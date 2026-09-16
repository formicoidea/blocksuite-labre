import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { TranslationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type {
  BlockStdScope,
  CommandDescriptor,
  CommandInvocation,
} from '@labre/std';
import { generateKeyBetween, GfxControllerIdentifier } from '@labre/std/gfx';
import * as Y from 'yjs';

import {
  makeTemplateSnapshot,
  surfaceText,
  surfaceYMap,
} from './make-snapshot.js';
import type { Template } from './toolbar/template-type.js';

/**
 * The invocation every derived template runs under. Any legal literal does:
 * telemetry is emitted by `runCommand`, never by a command body, so nothing is
 * reported when the descriptor's `run` is called directly like this.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/** A standalone Y.Text reads empty until integrated; integrate to read it. */
function materialize(text: Y.Text): string {
  if (!text.doc) new Y.Doc().getMap('m').set('t', text);
  return text.toString();
}

/**
 * Record what a creation action asks the surface for, and hand it back as a
 * template snapshot — so a framework template is the command it derives from
 * rather than a hand-written copy of it that drifts.
 *
 * The `std` handed to `run` is a plain recording fake: it answers the members
 * placement actions actually touch and throws on anything else, so an
 * unsupported action fails loudly at build time instead of producing a
 * half-empty template.
 *
 * `host` is the editor the template is being inserted into. Its
 * `TranslationProvider`, and nothing else from it, is handed to the action, so
 * the seeds the action writes come out in the host's language. Without a host,
 * the action writes its English fallbacks.
 */
export function snapshotFromAction(
  run: (std: BlockStdScope) => void,
  name: string,
  host?: BlockStdScope
): ReturnType<typeof makeTemplateSnapshot> {
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

    // ponytail: the Y conversions are hard-coded (`text`, and a group's
    // `children` / `title`) instead of asking each element class for its own
    // `propsToY`. Ceiling: it covers every prop the framework actions pass
    // today. Upgrade path: run the real `propsToY` once the element-ctor map is
    // reachable without a live surface.
    const text = record['text'];
    if (typeof text === 'string') record['text'] = surfaceText(text);
    else if (text instanceof Y.Text)
      record['text'] = surfaceText(materialize(text));

    if (record['type'] === 'group') {
      const children = record['children'];
      if (children && typeof children === 'object') {
        record['children'] = surfaceYMap(
          Object.fromEntries(Object.keys(children).map(key => [key, true]))
        );
      }
      const title = record['title'];
      if (typeof title === 'string') record['title'] = surfaceText(title);
      else if (title instanceof Y.Text)
        record['title'] = surfaceText(materialize(title));
    }

    if (record['index'] === undefined) record['index'] = nextIndex();

    // The model members an action reads back off `getElementById`, kept
    // non-enumerable so they never leak into the snapshot.
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
        `snapshotFromAction: unsupported service "${identifier?.identifierName ?? String(identifier)}"`
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

  if (elements.size === 0) {
    throw new Error(
      'snapshotFromAction: the action added no element (a tool-arming command?)'
    );
  }

  normalizeToOrigin(records());

  return makeTemplateSnapshot(Object.fromEntries(elements), name);
}

/** The connector endpoints that carry a free position rather than an anchor. */
function freeEndpoints(el: Record<string, unknown>) {
  const out: { position: [number, number] }[] = [];
  for (const key of ['source', 'target'] as const) {
    const end = el[key] as { position?: [number, number] } | undefined;
    if (end && Array.isArray(end.position)) {
      out.push(end as { position: [number, number] });
    }
  }
  return out;
}

/** Move the whole drawing so its top-left corner sits at (0, 0). */
function normalizeToOrigin(records: Record<string, unknown>[]) {
  let minX = Infinity;
  let minY = Infinity;

  for (const el of records) {
    if (typeof el['xywh'] === 'string') {
      const bound = Bound.deserialize(el['xywh']);
      minX = Math.min(minX, bound.x);
      minY = Math.min(minY, bound.y);
    }
    for (const end of freeEndpoints(el)) {
      minX = Math.min(minX, end.position[0]);
      minY = Math.min(minY, end.position[1]);
    }
  }

  if (!Number.isFinite(minX) || (minX === 0 && minY === 0)) return;

  for (const el of records) {
    if (typeof el['xywh'] === 'string') {
      const bound = Bound.deserialize(el['xywh']);
      bound.x -= minX;
      bound.y -= minY;
      el['xywh'] = bound.serialize();
    }
    for (const end of freeEndpoints(el)) {
      // `vertices` are left alone on purpose: they are already normalised 0-1.
      end.position = [end.position[0] - minX, end.position[1] - minY];
    }
  }
}

/**
 * Derive a template from the command a user would have run — the template IS
 * the command, so the two can never say different things about what a
 * framework's artefact looks like.
 */
export function templateFromCommand(
  command: CommandDescriptor,
  preview: string,
  name = command.labelFallback ?? command.id
): Template {
  const run = (std: BlockStdScope) => {
    void command.run(std, INVOCATION);
  };
  return {
    name,
    type: 'template',
    preview,
    commandId: command.id,
    content: snapshotFromAction(run, name),
    localize: host => snapshotFromAction(run, name, host),
  };
}
