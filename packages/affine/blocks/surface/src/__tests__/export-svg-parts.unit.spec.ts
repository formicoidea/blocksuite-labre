import { describe, expect, test } from 'vitest';

import {
  boardSvgExportOptions,
  boardSvgExportPartOf,
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
  type SvgExportCandidate,
  selectBoardSvgParts,
} from '../extensions/export-svg/parts.js';
import { LEGEND_ROLE } from '../extensions/legend.js';

/**
 * The three switches of "Export SVG" (ADR 0025, amendment of 2026-10-04):
 * "Framework elements", "Other shapes and strokes", "Other texts".
 *
 * What a switch removes is decided by a pure rule over the stored `role` and
 * `type` of what lies on the board, so it is pinned here over plain records —
 * no surface, no store, no canvas. The rule's per-framework half (every
 * framework's real board and real artefact, as its commands create them) is
 * `packages/affine/all/src/__tests__/commands/export-svg-parts.unit.spec.ts`;
 * the gesture and the file are `board-svg-export.spec.ts` in the browser.
 */

const board = { type: 'wardley', role: 'wardley:map' };
const noGroups = () => [] as const;

const partOf = (
  element: SvgExportCandidate,
  groups: readonly SvgExportCandidate[] = []
) => boardSvgExportPartOf(board, element, groups);

describe('boardSvgExportPartOf', () => {
  test('the board itself is a framework element', () => {
    expect(partOf(board)).toBe('framework');
  });

  test('a role in the board’s namespace is a framework element', () => {
    expect(partOf({ type: 'wardleyNode', role: 'wardley:component' })).toBe(
      'framework'
    );
    // Its name is a text, and still the framework's: the role says so.
    expect(partOf({ type: 'text', role: 'wardley:label' })).toBe('framework');
    // A typed edge is the framework's; the role is what types it.
    expect(partOf({ type: 'connector', role: 'wardley:dependency' })).toBe(
      'framework'
    );
  });

  test('another framework’s element on the board counts by its type', () => {
    expect(partOf({ type: 'bpmnNode', role: 'bpmn:task' })).toBe('shapes');
    expect(partOf({ type: 'text', role: 'bpmn:label' })).toBe('texts');
  });

  test('a plain element counts by its type', () => {
    expect(partOf({ type: 'shape' })).toBe('shapes');
    expect(partOf({ type: 'connector' })).toBe('shapes');
    expect(partOf({ type: 'brush' })).toBe('shapes');
    expect(partOf({ type: 'highlighter' })).toBe('shapes');
    expect(partOf({ type: 'text' })).toBe('texts');
  });

  /**
   * A framework artefact is often several elements grouped: an EDGY person and
   * its name, a Wardley market and its three dots, a Core Domain sub-domain and
   * its title. Only one of them carries the role; the others are its parts.
   */
  test('a role-less part of a grouped artefact is the framework’s', () => {
    const market = { type: 'wardleyNode', role: 'wardley:market' };
    const dot = { type: 'wardleyNode' };
    const name = { type: 'text' };
    const group = { type: 'group', childElements: [market, dot, name] };

    expect(partOf(dot, [group])).toBe('framework');
    expect(partOf(name, [group])).toBe('framework');
    expect(partOf(group)).toBe('framework');
    // Nested one level further — a pipeline's body sits in a group in a group.
    const outer = { type: 'group', childElements: [group] };
    expect(
      partOf(name, [{ type: 'group', childElements: [name] }, outer])
    ).toBe('texts');
    expect(partOf(name, [group, outer])).toBe('framework');
  });

  test('a role-less element grouped with another framework’s artefact is not', () => {
    const foreign = { type: 'bpmnNode', role: 'bpmn:task' };
    const name = { type: 'text' };
    const group = { type: 'group', childElements: [foreign, name] };

    expect(partOf(name, [group])).toBe('texts');
    expect(partOf(group)).toBe('shapes');
  });

  test('a generated legend and every glyph in it are the framework’s', () => {
    const swatch = { type: 'shape' };
    const caption = { type: 'text' };
    const legend = {
      type: 'group',
      role: LEGEND_ROLE,
      childElements: [swatch, caption],
    };

    expect(partOf(legend)).toBe('framework');
    expect(partOf(swatch, [legend])).toBe('framework');
    expect(partOf(caption, [legend])).toBe('framework');
  });

  test('a board with no role owns itself and nothing else', () => {
    // The Cynefin board stamps no role: it paints its domains itself.
    const cynefin = { type: 'cynefin' };

    expect(boardSvgExportPartOf(cynefin, cynefin, [])).toBe('framework');
    expect(boardSvgExportPartOf(cynefin, { type: 'shape' }, [])).toBe('shapes');
  });
});

describe('selectBoardSvgParts', () => {
  const artefact = { type: 'wardleyNode', role: 'wardley:component' };
  const shape = { type: 'shape' };
  const text = { type: 'text' };
  const textBlock = { flavour: 'affine:edgeless-text' };
  const elements = [board, artefact, shape, text];

  const select = (options: Partial<typeof DEFAULT_BOARD_SVG_EXPORT_OPTIONS>) =>
    selectBoardSvgParts(
      board,
      elements,
      [textBlock],
      { ...DEFAULT_BOARD_SVG_EXPORT_OPTIONS, ...options },
      noGroups
    );

  test('everything is in with the defaults', () => {
    expect(select({})).toEqual({ elements, textBlocks: [textBlock] });
  });

  test('each switch removes exactly its part', () => {
    expect(select({ framework: false })).toEqual({
      elements: [shape, text],
      textBlocks: [textBlock],
    });
    expect(select({ shapes: false })).toEqual({
      elements: [board, artefact, text],
      textBlocks: [textBlock],
    });
    expect(select({ texts: false })).toEqual({
      elements: [board, artefact, shape],
      textBlocks: [],
    });
  });

  test('keeps the paint order it was given', () => {
    const reversed = [...elements].reverse();
    expect(
      selectBoardSvgParts(
        board,
        reversed,
        [],
        DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
        noGroups
      ).elements
    ).toEqual(reversed);
  });
});

describe('boardSvgExportOptions', () => {
  test('no options means everything, as the palette and the agent run it', () => {
    expect(boardSvgExportOptions(undefined)).toEqual({
      framework: true,
      shapes: true,
      texts: true,
    });
  });

  test('only an explicit false switches a part off', () => {
    expect(boardSvgExportOptions({ texts: false })).toEqual({
      framework: true,
      shapes: true,
      texts: false,
    });
    expect(
      boardSvgExportOptions({ framework: 0, shapes: 'no', texts: null })
    ).toEqual(DEFAULT_BOARD_SVG_EXPORT_OPTIONS);
    expect(boardSvgExportOptions('everything')).toEqual(
      DEFAULT_BOARD_SVG_EXPORT_OPTIONS
    );
  });
});
