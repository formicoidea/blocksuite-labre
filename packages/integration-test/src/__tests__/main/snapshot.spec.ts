import type { SurfaceBlockModel } from '@labre/affine/blocks/surface';
import { ConnectorMode, ShapeType } from '@labre/affine/model';
import { AffineSchemas } from '@labre/affine/schemas';
import { ZipTransformer } from '@labre/affine/widgets/linked-doc';
import type { PointLocation } from '@labre/global/gfx';
import { Schema, Transformer } from '@labre/store';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

// The original upstream fixtures (test-snapshot-{1,2}.zip on
// test.affineassets.com) are gone — the domain is dead and no web-archive
// capture exists. Instead of fetching pre-made zips we round-trip locally:
// build a doc with surface elements, export it to a snapshot zip in the same
// format ZipTransformer produces, then import it and verify every element
// field survived. This loses the "documents created by old versions still
// import" coverage the vendored zips gave, but keeps the transformer
// round-trip and element-integrity coverage.

const excludes = new Set([
  'shape-textBound',
  'externalXYWH',
  'connector-text',
  'connector-labelXYWH',
]);

const fieldChecker: Record<string, (value: any) => boolean> = {
  'connector-path': (value: PointLocation[]) => {
    return value.length > 0;
  },
  xywh: (value: string) => {
    return value.match(xywhPattern) !== null;
  },
};

const skipFields = new Set(['_lastXYWH']);

const snapshotTest = async (elementsCount: number) => {
  const workspace = window.editor.doc.workspace;
  const schema = new Schema();
  schema.register(AffineSchemas);

  const job = new Transformer({
    schema,
    blobCRUD: workspace.blobSync,
    docCRUD: {
      create: (id: string) => workspace.createDoc(id).getStore({ id }),
      get: (id: string) => workspace.getDoc(id)?.getStore({ id }) ?? null,
      delete: (id: string) => workspace.removeDoc(id),
    },
  });
  const snapshot = await job.docToSnapshot(window.editor.doc);
  if (!snapshot) {
    throw new Error('Failed to snapshot the source doc');
  }

  const zipped = zipSync({
    'test-doc.snapshot.json': strToU8(JSON.stringify(snapshot)),
  });
  const snapshotFile = new Blob([zipped], { type: 'application/zip' });

  const [newDoc] = await ZipTransformer.importDocs(
    workspace,
    schema,
    snapshotFile
  );

  if (!newDoc) {
    throw new Error('Failed to import snapshot');
  }

  editor.doc = newDoc;
  await wait();

  const surface = newDoc.getModelsByFlavour(
    'affine:surface'
  )[0] as SurfaceBlockModel;
  const surfaceElements = [...surface['_elementModels']].map(
    ([_, { model }]) => model
  );

  expect(surfaceElements.length).toBe(elementsCount);

  surfaceElements.forEach(element => {
    const type = element.type;

    for (const field in element) {
      const value = element[field as keyof typeof element];
      const typeField = `${type}-${field}`;

      if (excludes.has(`${type}-${field}`) || excludes.has(field)) {
        return;
      }

      if (skipFields.has(field)) {
        return;
      }

      if (fieldChecker[typeField] || fieldChecker[field]) {
        const checker = fieldChecker[typeField] || fieldChecker[field];
        expect(checker(value)).toBe(true);
        return;
      }

      expect(
        value,
        `type: ${element.type} field: "${field}"`
      ).not.toBeUndefined();
      expect(value, `type: ${element.type} field: "${field}"`).not.toBeNull();
      expect(value, `type: ${element.type} field: "${field}"`).not.toBeNaN();
    }
  });
};

beforeEach(async () => {
  const cleanup = await setupEditor('edgeless');

  return cleanup;
});

const xywhPattern = /\[(\s*-?\d+(\.\d+)?\s*,){3}(\s*-?\d+(\.\d+)?\s*)\]/;

test('snapshot with mixed surface elements round-trips', async () => {
  const surface = getSurface(window.doc, window.editor).model;

  const shape1 = surface.addElement({
    type: 'shape',
    shapeType: ShapeType.Rect,
    xywh: '[0,0,100,100]',
  });
  const shape2 = surface.addElement({
    type: 'shape',
    shapeType: ShapeType.Ellipse,
    xywh: '[300,300,100,100]',
  });
  surface.addElement({
    type: 'connector',
    mode: ConnectorMode.Orthogonal,
    source: { id: shape1 },
    target: { id: shape2 },
  });
  surface.addElement({
    type: 'brush',
    points: [
      [0, 0],
      [50, 50],
      [100, 0],
    ],
  });
  await wait(100);

  await snapshotTest(4);
});

test('snapshot with many elements round-trips', async () => {
  const surface = getSurface(window.doc, window.editor).model;

  const shapeIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    shapeIds.push(
      surface.addElement({
        type: 'shape',
        shapeType: i % 2 === 0 ? ShapeType.Rect : ShapeType.Diamond,
        xywh: `[${(i % 5) * 200},${Math.floor(i / 5) * 200},100,100]`,
      })
    );
  }
  for (let i = 0; i < 5; i++) {
    surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Curve,
      source: { id: shapeIds[i] },
      target: { id: shapeIds[i + 5] },
    });
  }
  await wait(200);

  await snapshotTest(25);
});
