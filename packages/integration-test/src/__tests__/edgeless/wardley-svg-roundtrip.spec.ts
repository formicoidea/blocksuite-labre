import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  BOARD_SVG_MARKER_VERSION,
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
  materializeInterchangeImport,
  renderBoardSvg,
  type SerializedElementProps,
} from '@labre/affine/blocks/surface';
// Straight off the framework package, as the neighbouring wardley specs do.
import {
  importWardleyOwm,
  importWardleySvg,
  owmCoordsOf,
  owmPlotOf,
  WARDLEY_ROLE,
} from '@labre/affine-gfx-wardley';
import {
  ConnectorElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine/model';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import FULL_OWM from '../../../../affine/gfx/wardley/src/__tests__/corpus/svg/full.owm?raw';
import SMALL_OWM from '../../../../affine/gfx/wardley/src/__tests__/corpus/svg/small.owm?raw';
import TEA_SHOP_OWM from '../../../../affine/gfx/wardley/src/__tests__/corpus/svg/tea-shop.owm?raw';
import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Labre's own board SVG, read back as the map it exports (ADR 0032 §6, §9).
 *
 * Only a real editor can make this claim end to end: the canvas renderers
 * replay into svgcanvas, the export loop wraps every element it replays in a
 * `<g>` carrying `data-labre-*` markers, and the Wardley SVG reader — Labre's
 * recogniser first in its detection order — turns that file back into the
 * map. The property is the corpus's: **the SVG of a map imports to the same
 * map as its OWM text**, every `[visibility, evolution]` within
 * {@link TOLERANCE}.
 */

/**
 * Half the last digit the OWM DSL writes — the tolerance the corpus spec in
 * `gfx/wardley` settles ADR 0032's open point 5 at, for the same reason: a
 * position within it exports to the very number the `.owm` holds. The markers
 * carry the stored bound itself, so what is measured here is float noise.
 */
const TOLERANCE = 0.005;

type Props = SerializedElementProps;

const NODE_ROLES = new Set<string>([
  WARDLEY_ROLE.component,
  WARDLEY_ROLE.anchor,
  WARDLEY_ROLE.market,
  WARDLEY_ROLE.ecosystem,
  WARDLEY_ROLE.accelerator,
  WARDLEY_ROLE.decelerator,
]);

/**
 * A result as the map it draws: every node's role, name and coordinates on
 * its own map's plot, and every dependency and change arrow by name.
 */
function summarise(elements: readonly Props[]) {
  const map = elements.find(props => props.role === WARDLEY_ROLE.map)!;
  const plot = owmPlotOf(Bound.deserialize(map.xywh as string));
  const centre = (props: Props) => {
    const { x, y, w, h } = Bound.deserialize(props.xywh as string);
    return owmCoordsOf(plot, x + w / 2, y + h / 2);
  };
  const identity = (props: Props) =>
    (props.interchange as { owm?: { id?: string } } | undefined)?.owm?.id ??
    (props.id as string | undefined);
  const names = new Map<string, string>();
  const nodes: { role: string; name: string; v: number; e: number }[] = [];
  elements.forEach((props, index) => {
    const role = props.role as string | undefined;
    if (props.type !== 'wardleyNode' || !role || !NODE_ROLES.has(role)) return;
    const label = elements
      .slice(index + 1)
      .find(
        next =>
          next.role === WARDLEY_ROLE.label ||
          (next.type === 'wardleyNode' && next.role !== undefined)
      );
    const name =
      label?.role === WARDLEY_ROLE.label ? (label.text as string) : '';
    const id = identity(props);
    if (id && !names.has(id)) names.set(id, name);
    const { visibility, evolution } = centre(props);
    nodes.push({ role, name, v: visibility, e: evolution });
  });
  const ends = (role: string) =>
    elements
      .filter(props => props.role === role)
      .map(
        props =>
          `${names.get((props.source as { id: string }).id)} -> ${names.get((props.target as { id: string }).id)}`
      )
      .sort();
  const notes = elements
    .filter(
      props =>
        props.type === 'text' &&
        props.role === undefined &&
        props.fontFamily !== undefined
    )
    .map(props => ({ text: props.text as string, ...centre(props) }))
    .sort((a, b) => a.text.localeCompare(b.text));
  return {
    nodes: nodes.sort(
      (a, b) =>
        a.role.localeCompare(b.role) ||
        a.name.localeCompare(b.name) ||
        a.e - b.e
    ),
    links: ends(WARDLEY_ROLE.dependency),
    arrows: ends(WARDLEY_ROLE.changeArrow),
    pipelines: elements.filter(props => props.role === WARDLEY_ROLE.pipeline)
      .length,
    notes,
  };
}

function expectSameMap(
  actual: ReturnType<typeof summarise>,
  expected: ReturnType<typeof summarise>
) {
  expect(actual.nodes.map(({ role, name }) => [role, name])).toEqual(
    expected.nodes.map(({ role, name }) => [role, name])
  );
  expect(actual.links).toEqual(expected.links);
  expect(actual.arrows).toEqual(expected.arrows);
  expect(actual.pipelines).toBe(expected.pipelines);
  expect(actual.notes.map(note => note.text)).toEqual(
    expected.notes.map(note => note.text)
  );
  actual.nodes.forEach((node, index) => {
    const reference = expected.nodes[index];
    expect(
      Math.abs(node.v - reference.v),
      `${node.name} v`
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs(node.e - reference.e),
      `${node.name} e`
    ).toBeLessThanOrEqual(TOLERANCE);
  });
  actual.notes.forEach((note, index) => {
    const reference = expected.notes[index];
    expect(
      Math.abs(note.visibility - reference.visibility),
      note.text
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs(note.evolution - reference.evolution),
      note.text
    ).toBeLessThanOrEqual(TOLERANCE);
  });
}

describe('a Wardley board exported as SVG and imported back', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** The OWM text laid on the canvas the way its own import lays it. */
  const draw = async (owm: string) => {
    const ids = materializeInterchangeImport(
      edgeless.std,
      'owm',
      importWardleyOwm(owm).elements
    );
    await wait();
    const surface = getSurface(window.doc, window.editor).model;
    const board = ids
      .map(id => surface.getElementById(id))
      .find(model => model instanceof WardleyBackgroundElementModel)!;
    return { board, surface, ids };
  };

  const exportOf = (board: WardleyBackgroundElementModel) => {
    const out = renderBoardSvg(
      edgeless.std,
      board,
      DEFAULT_BOARD_SVG_EXPORT_OPTIONS
    );
    expect(out).not.toBeNull();
    return out!.svg;
  };

  test.each([
    ['the small map', SMALL_OWM],
    ['the tea shop', TEA_SHOP_OWM],
    ['every kind the pack draws', FULL_OWM],
  ])('%s comes back as the same map', async (_name, owm) => {
    const { board } = await draw(owm);
    const result = importWardleySvg(exportOf(board), { name: 'map.svg' });

    expect(result.report.sourceVersion).toBe(
      `Labre SVG ${BOARD_SVG_MARKER_VERSION}`
    );
    expectSameMap(
      summarise(result.elements),
      summarise(importWardleyOwm(owm).elements)
    );
  });

  test('every element group carries its id, type, role and bound', async () => {
    const { board, surface, ids } = await draw(SMALL_OWM);
    const svg = exportOf(board);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(doc.documentElement.getAttribute('data-labre-svg')).toBe(
      BOARD_SVG_MARKER_VERSION
    );
    const groups = Array.from(doc.querySelectorAll('g[data-labre-id]'));
    const marked = new Set(groups.map(g => g.getAttribute('data-labre-id')));
    // Every element the import drew is inside the board, so in the file.
    for (const id of ids) expect(marked.has(id), id).toBe(true);

    const origin = Bound.deserialize(board.xywh);
    for (const group of groups) {
      const model = surface.getElementById(
        group.getAttribute('data-labre-id')!
      );
      expect(model).toBeTruthy();
      expect(group.getAttribute('data-labre-type')).toBe(model!.type);
      expect(group.getAttribute('data-labre-role') ?? undefined).toBe(
        model!.role
      );
      const [x, y, w, h] = JSON.parse(
        group.getAttribute('data-labre-xywh')!
      ) as number[];
      const stored = Bound.deserialize(model!.xywh);
      // The file's coordinates: the export's own bound starts at the board.
      expect([x + origin.x, y + origin.y, w, h]).toEqual([
        stored.x,
        stored.y,
        stored.w,
        stored.h,
      ]);
      if (model instanceof ConnectorElementModel) {
        expect(group.getAttribute('data-labre-source')).toBe(model.source.id);
        expect(group.getAttribute('data-labre-target')).toBe(model.target.id);
      }
    }
  });

  test('the markers carry ids and vocabulary, never prose', async () => {
    const { board, surface } = await draw(SMALL_OWM);
    // A host record bound to an element: its contract says no exporter may
    // read it (`element-model.ts`, `pivotDocId`).
    const named = surface.elementModels.find(
      model => model.role === WARDLEY_ROLE.component
    )!;
    named.pivotDocId = 'host-record-4f2a';
    await wait();
    const svg = exportOf(board);

    expect(svg).not.toContain('host-record-4f2a');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const words = surface.elementModels
      .filter(
        (model): model is TextElementModel => model instanceof TextElementModel
      )
      .map(model => model.text.toString());
    const values = Array.from(doc.querySelectorAll('*')).flatMap(element =>
      element
        .getAttributeNames()
        .filter(name => name.startsWith('data-labre-'))
        .map(name => element.getAttribute(name)!)
    );
    for (const word of words) expect(values).not.toContain(word);
    for (const value of values) expect(value).not.toMatch(/interchange|owm/);
  });

  test('the markers cost what the PR says, on a 500-element map', async () => {
    // ADR 0032 §6 asks the stage that ships the markers to measure them on the
    // bench-sized map and say the figure. 167 components (a circle and a
    // label each), 166 links and the map: 501 elements. The bound is the
    // budget the ADR estimated (~150 bytes an element), with headroom for
    // longer coordinates.
    const lines = ['title Bench'];
    for (let i = 0; i < 167; i += 1) {
      const v = (0.05 + (0.9 * ((i * 37) % 167)) / 167).toFixed(2);
      const e = (0.05 + (0.9 * ((i * 61) % 167)) / 167).toFixed(2);
      lines.push(`component C${i} [${v}, ${e}]`);
    }
    for (let i = 1; i < 167; i += 1) lines.push(`C${i - 1}->C${i}`);
    const { board, ids } = await draw(lines.join('\n'));
    const svg = exportOf(board);
    const markerBytes = (svg.match(/ data-labre-[a-z]+="[^"]*"/g) ?? []).join(
      ''
    ).length;
    const groupBytes = (svg.match(/<g data-labre-id/g) ?? []).length * 7;
    const perElement = (markerBytes + groupBytes) / ids.length;
    console.info(
      `[markers] ${ids.length} elements, ${svg.length} bytes, markers ${markerBytes + groupBytes} bytes (${perElement.toFixed(0)} per element)`
    );
    expect(perElement).toBeLessThan(200);
  });
});
