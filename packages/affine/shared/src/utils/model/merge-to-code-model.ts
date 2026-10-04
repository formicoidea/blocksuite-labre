import type { BlockModel } from '@labre/store';
import { Text } from '@labre/store';

export function mergeToCodeModel(models: BlockModel[]) {
  if (models.length === 0) {
    return null;
  }
  const doc = models[0].store;

  const parent = doc.getParent(models[0]);
  if (!parent) {
    return null;
  }
  const index = parent.children.indexOf(models[0]);
  const text = models
    .map(model => {
      if (model.text instanceof Text) {
        return model.text.toString();
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');

  // Add first and delete only once the code block exists: `addBlock` returns
  // an id even when the parent rejected the flavour (a callout only takes
  // paragraphs and lists), and deleting first lost the text (#418).
  const id = doc.addBlock(
    'affine:code',
    { text: new Text(text) },
    parent,
    index
  );
  if (!doc.getModelById(id)) {
    return null;
  }
  models.forEach(model => doc.deleteBlock(model));
  return id;
}
