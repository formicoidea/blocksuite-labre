/**
 * The label editor now edits THREE labels (`docs/adr/0018` phase 2), and every
 * one of its three writes — seed, resize, commit — has to land in the pair of
 * fields the gesture named. This file is the guard on that mapping.
 *
 * It asks the decisions directly instead of mounting the editor: the component
 * needs a live `std`, a dispatcher, a viewport and a rich-text child, and a
 * spec that built all four would be testing the editor's plumbing rather than
 * the one thing that can silently go wrong here — writing the centre label's
 * box under an end label's text.
 *
 * `edgeless-connector-label-editor.ts` imports lit, so the module needs a DOM
 * to load even though nothing below renders.
 *
 * @vitest-environment happy-dom
 */
import { type ConnectorElementModel, ConnectorMode } from '@labre/affine-model';
import {
  CHROME_WORDINGS,
  type ToolbarAction,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import { ConnectorSchema } from '@labre/affine-shared/utils';
import { PointLocation } from '@labre/global/gfx';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  CONNECTOR_LABEL_FIELDS,
  type ConnectorLabelWhich,
  connectorLabelCommitProps,
  connectorLabelFields,
  connectorLabelSeedProps,
} from '../text/edgeless-connector-label-editor.js';
import { connectorToolbarConfig } from '../toolbar/config.js';
import { pickConnectorLabelWhich } from '../view/view.js';

/** A straight connector from (0,0) to (200,0), with no label of any kind. */
function bareConnector(
  overrides: Record<string, unknown> = {}
): ConnectorElementModel {
  const model: Record<string, unknown> = {
    id: 'connector-1',
    mode: ConnectorMode.Straight,
    absolutePath: [new PointLocation([0, 0]), new PointLocation([200, 0])],
    labelOffset: { distance: 0.5 },
    getNearestPoint: (point: [number, number]) => [point[0], 0],
    getOffsetDistanceByPoint: (point: [number, number]) => point[0] / 200,
    ...overrides,
  };

  // The model's own two readers, which the editor's helpers delegate to.
  model.endLabelText = (end: 'source' | 'target') =>
    end === 'source' ? model.sourceLabel : model.targetLabel;
  model.endLabelXYWH = (end: 'source' | 'target') =>
    end === 'source' ? model.sourceLabelXYWH : model.targetLabelXYWH;

  return model as unknown as ConnectorElementModel;
}

/**
 * What a `Y.Text` built with initial content SAYS, which is nothing at all
 * until it is integrated into a document — so the assertion has to put it in
 * one, exactly as `updateElement` does when the editor commits.
 */
function textOf(value: unknown): string {
  const doc = new Y.Doc();
  doc.getMap('labels').set('text', value as Y.Text);
  return (doc.getMap('labels').get('text') as Y.Text).toString();
}

const ENDS = ['source', 'target'] as const;

describe('which fields a label lives in', () => {
  test('the three labels name three disjoint pairs', () => {
    expect(CONNECTOR_LABEL_FIELDS).toEqual({
      center: { text: 'text', xywh: 'labelXYWH' },
      source: { text: 'sourceLabel', xywh: 'sourceLabelXYWH' },
      target: { text: 'targetLabel', xywh: 'targetLabelXYWH' },
    });
  });

  test('no selector means the centre label', () => {
    expect(connectorLabelFields()).toBe(CONNECTOR_LABEL_FIELDS.center);
  });
});

describe('seeding the label a gesture asked for', () => {
  test.each(ENDS)('%s writes its own pair and nothing else', end => {
    const props = connectorLabelSeedProps(bareConnector(), end, [100, 0]);
    if (!props) throw new Error('a bare connector must seed a label');

    const fields = connectorLabelFields(end);
    expect(props[fields.text]).toBeInstanceOf(Y.Text);
    expect(props[fields.xywh]).toHaveLength(4);

    // The centre label is untouched by an end gesture — this is the whole
    // point of the selector.
    expect(Object.keys(props).sort()).toEqual(
      [fields.text, fields.xywh].sort()
    );
  });

  test.each(ENDS)('%s is anchored to its endpoint, not to the pointer', end => {
    // Double-clicked far from the line: an end label ignores where the pointer
    // was, because it belongs to the end and has to follow it.
    const near = connectorLabelSeedProps(bareConnector(), end, [100, 0]);
    const far = connectorLabelSeedProps(bareConnector(), end, [-900, 700]);
    expect(near?.[connectorLabelFields(end).xywh]).toEqual(
      far?.[connectorLabelFields(end).xywh]
    );
  });

  test('the two ends do not seed the same box', () => {
    const source = connectorLabelSeedProps(bareConnector(), 'source');
    const target = connectorLabelSeedProps(bareConnector(), 'target');
    expect(source?.sourceLabelXYWH).not.toEqual(target?.targetLabelXYWH);
  });

  test('the centre label still seeds text, box and offset at the pointer', () => {
    const props = connectorLabelSeedProps(bareConnector(), 'center', [50, 0]);
    if (!props) throw new Error('a bare connector must seed a label');

    expect(Object.keys(props).sort()).toEqual([
      'labelOffset',
      'labelXYWH',
      'text',
    ]);
    expect(props.text).toBeInstanceOf(Y.Text);
    expect(props.labelOffset).toEqual({ distance: 0.25 });
  });

  test('a default `which` is the centre label', () => {
    expect(Object.keys(connectorLabelSeedProps(bareConnector()) ?? {})).toEqual(
      Object.keys(connectorLabelSeedProps(bareConnector(), 'center') ?? {})
    );
  });

  test.each(['center', 'source', 'target'] as ConnectorLabelWhich[])(
    '%s that already exists is not re-seeded',
    which => {
      const connector = bareConnector({
        [connectorLabelFields(which).text]: new Y.Text('written'),
      });
      expect(connectorLabelSeedProps(connector, which, [10, 0])).toBeNull();
    }
  );
});

describe('committing an edited label', () => {
  test.each(ENDS)('%s emptied out removes its pair', end => {
    const fields = connectorLabelFields(end);
    const props = connectorLabelCommitProps('   ', end);

    expect(props).toEqual({
      [fields.text]: undefined,
      [fields.xywh]: undefined,
    });
    // An end label has no offset of its own, so nothing else is unset — least
    // of all the CENTRE label's placement.
    expect(props).not.toHaveProperty('labelOffset');
  });

  test('the centre label emptied out still drops its offset too', () => {
    const props = connectorLabelCommitProps('', 'center');
    expect(Object.keys(props ?? {}).sort()).toEqual([
      'labelOffset',
      'labelXYWH',
      'text',
    ]);
    expect(props).toEqual({
      text: undefined,
      labelXYWH: undefined,
      labelOffset: undefined,
    });
  });

  test.each(['center', 'source', 'target'] as ConnectorLabelWhich[])(
    '%s trims into its own text field',
    which => {
      const props = connectorLabelCommitProps('  0..*  ', which);
      const fields = connectorLabelFields(which);
      expect(Object.keys(props ?? {})).toEqual([fields.text]);
      expect(textOf(props?.[fields.text])).toBe('0..*');
    }
  );

  test('a clean text writes nothing at all', () => {
    expect(connectorLabelCommitProps('0..*', 'source')).toBeNull();
    expect(connectorLabelCommitProps('owns', 'center')).toBeNull();
  });
});

describe('which label a double-click is asking for', () => {
  test('the middle of the line is the centre label', () => {
    expect(pickConnectorLabelWhich(bareConnector(), [100, 0])).toBe('center');
  });

  test('within reach of the source endpoint', () => {
    expect(pickConnectorLabelWhich(bareConnector(), [4, 4])).toBe('source');
  });

  test('within reach of the target endpoint', () => {
    expect(pickConnectorLabelWhich(bareConnector(), [196, -6])).toBe('target');
  });

  test('just outside the grab distance is the centre label again', () => {
    expect(pickConnectorLabelWhich(bareConnector(), [30, 0])).toBe('center');
  });

  test('an existing end label box wins wherever it sits', () => {
    // A box dragged to the middle of the line, far from its own endpoint: the
    // label is edited where it is DRAWN, never re-created at the end.
    const connector = bareConnector({ sourceLabelXYWH: [90, -10, 20, 20] });
    expect(pickConnectorLabelWhich(connector, [100, 0])).toBe('source');
  });

  test('a connector with no path yet answers centre instead of throwing', () => {
    // The degraded connector of PR #90: a vanished endpoint leaves an empty
    // path, and a double-click on its last known bound must still do something
    // sane.
    const degraded = bareConnector({ absolutePath: [] });
    expect(pickConnectorLabelWhich(degraded, [0, 0])).toBe('center');
  });
});

describe('the two end-label entries on the connector row', () => {
  const entry = (id: string) =>
    connectorToolbarConfig.actions.find(action => action.id === id) as
      | ToolbarAction
      | undefined;

  const contextWith = (model: ConnectorElementModel) =>
    ({
      getSurfaceModelsByType: () => [model],
    }) as unknown as ToolbarContext;

  test('both exist, after the caption and its style controls', () => {
    const ids = connectorToolbarConfig.actions.map(action => action.id);
    expect(ids).toContain('h.source-label');
    expect(ids).toContain('h.target-label');
    // The row is sorted by id, so "after `g.text`" is a fact about the ids.
    expect('h.source-label' > 'g.text').toBe(true);
    expect('h.target-label' > 'h.source-label').toBe(true);
  });

  test.each(ENDS)('%s says its word through the catalogue', end => {
    const action = entry(`h.${end}-label`);
    expect(action?.tooltipWording?.[0]).toBe(
      `com.labre.connector.toolbar.${end}-label`
    );
    expect(CHROME_WORDINGS).toContainEqual(action?.tooltipWording);
  });

  test.each(ENDS)('%s is offered only while that end is bare', end => {
    const action = entry(`h.${end}-label`);
    const when = action?.when;
    if (typeof when !== 'function') throw new Error('missing `when`');

    expect(when(contextWith(bareConnector()))).toBe(true);

    const written = bareConnector({
      [connectorLabelFields(end).text]: new Y.Text('0..*'),
    });
    expect(when(contextWith(written))).toBe(false);

    // The OTHER end's label says nothing about this entry.
    const other = end === 'source' ? 'target' : 'source';
    const elsewhere = bareConnector({
      [connectorLabelFields(other).text]: new Y.Text('1'),
    });
    expect(when(contextWith(elsewhere))).toBe(true);
  });
});

describe('end labels are never remembered as last props', () => {
  /**
   * `EditPropsStore.recordLastProps` parses every update through the element's
   * schema, and zod drops what the schema does not name — so the guard is that
   * `ConnectorSchema` names the connector's STYLE and none of its texts. A
   * remembered end label would put the previous association's multiplicity on
   * the next connector the author draws.
   */
  test('the connector schema names no label text or box', () => {
    const keys = Object.keys(ConnectorSchema.removeDefault().shape);

    for (const which of [
      'center',
      'source',
      'target',
    ] as ConnectorLabelWhich[]) {
      const fields = connectorLabelFields(which);
      expect(keys).not.toContain(fields.text);
      expect(keys).not.toContain(fields.xywh);
    }
    // The style of the label IS remembered, and must stay so.
    expect(keys).toContain('labelStyle');
  });
});
