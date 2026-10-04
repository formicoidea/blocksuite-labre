import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { boardSvgMarkers } from '../extensions/export-svg/render.js';
import {
  BOARD_SVG_MARKER_VERSION,
  createSvgContext,
} from '../extensions/export-svg/svg-context.js';

/**
 * The markers Labre's board SVG export writes (ADR 0032 §6, ADR 0025 amended
 * 2026-10-04), over plain objects and a bare svgcanvas context.
 *
 * Exists because the markers are a file format other tools read: what each
 * attribute holds, what it must NEVER hold, and that wrapping an element in
 * its group leaves the next element beside it — whatever the renderer's own
 * save/restore balance. The end-to-end half (a real board, exported and read
 * back as the same map) is `integration-test/…/wardley-svg-roundtrip.spec.ts`.
 */

const bound = new Bound(100, 50, 1600, 900);

describe('what one element’s group says about it', () => {
  it('its id, type, role and stored bound, in the file’s coordinates', () => {
    expect(
      boardSvgMarkers(
        {
          id: 'n1',
          type: 'wardleyNode',
          role: 'wardley:component',
          xywh: '[300,250,12,12]',
          group: { id: 'g1' },
        },
        bound
      )
    ).toEqual({
      'data-labre-id': 'n1',
      'data-labre-type': 'wardleyNode',
      'data-labre-role': 'wardley:component',
      'data-labre-xywh': '[200,200,12,12]',
      'data-labre-group': 'g1',
    });
  });

  it('a connector’s two ends, and a block’s flavour as its type', () => {
    expect(
      boardSvgMarkers(
        {
          id: 'c1',
          type: 'connector',
          xywh: '[0,0,0,0]',
          source: { id: 'a' },
          target: { id: 'b' },
        },
        bound
      )
    ).toMatchObject({ 'data-labre-source': 'a', 'data-labre-target': 'b' });
    expect(
      boardSvgMarkers(
        { id: 't1', flavour: 'affine:edgeless-text', xywh: '[100,50,10,10]' },
        bound
      )['data-labre-type']
    ).toBe('affine:edgeless-text');
  });

  it('never the host record, the foreign payload, or any text', () => {
    // GUARD: the markers are base-class ids and vocabulary. Would have caught
    // an export that started writing a field `pivotDocId`'s contract forbids
    // an exporter to read, or prose a picture does not already show.
    const element = {
      id: 'n1',
      type: 'text',
      xywh: '[100,50,10,10]',
      pivotDocId: 'host-record',
      interchange: { owm: { id: 'Kettle' } },
      text: 'Kettle',
      tags: ['wardley:nature:practice'],
    };
    const values = Object.values(boardSvgMarkers(element, bound)).join(' ');
    expect(values).not.toMatch(/host-record|Kettle|nature/);
    expect(Object.keys(boardSvgMarkers(element, bound)).sort()).toEqual([
      'data-labre-id',
      'data-labre-type',
      'data-labre-xywh',
    ]);
  });
});

describe('the export context’s marked groups', () => {
  it('stamps the root, and leaves every group beside the previous one', () => {
    const { ctx, serialize, markRoot, markedGroup } = createSvgContext(100, 50);
    markRoot();
    // The canvas renderer's `renderBoundTo` restores once more than it saves;
    // a balanced draw must close the group just the same.
    markedGroup({ 'data-labre-id': 'a' }, () => {
      ctx.save();
      ctx.fillRect(0, 0, 5, 5);
      ctx.restore();
      ctx.restore();
    });
    markedGroup({ 'data-labre-id': 'b' }, () => {
      ctx.save();
      ctx.fillRect(10, 0, 5, 5);
      ctx.restore();
    });

    const doc = new DOMParser().parseFromString(serialize(), 'image/svg+xml');
    expect(doc.documentElement.getAttribute('data-labre-svg')).toBe(
      BOARD_SVG_MARKER_VERSION
    );
    const [a, b] = Array.from(doc.querySelectorAll('g[data-labre-id]'));
    expect(a.parentNode).toBe(b.parentNode);
    expect(a.contains(b)).toBe(false);
    expect(a.querySelectorAll('rect, path')).toHaveLength(1);
    expect(b.querySelectorAll('rect, path')).toHaveLength(1);
  });
});
